import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../db.js';
import { deserializeEmbedding, cosineSimilarity } from '../similarity.js';
import { generateQueryEmbedding, getSearchSettings } from '../embedding.js';
import { logger } from '../logger.js';
import type { Mash, SimilarResult } from '../types.js';

export function registerSearchTools(server: McpServer): void {
  // search_keyword (FTS5 trigram)
  server.tool(
    'search_keyword',
    'Full-text keyword search using FTS5 trigram tokenizer (works well with Korean)',
    {
      query: z.string().min(1).describe('Search query'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
    },
    ({ query, limit }) => {
      const db = getDb();

      const rows = db
        .prepare(
          `SELECT m.id, m.type, m.status, m.summary, m.context, m.memo, m.created_at, m.updated_at
           FROM mashes_fts fts
           JOIN mashes m ON m.rowid = fts.rowid
           WHERE mashes_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(query, limit) as Mash[];

      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  // search_semantic (embedding cosine similarity)
  server.tool(
    'search_semantic',
    'Semantic search using embedding cosine similarity (requires API key in settings)',
    {
      query: z.string().min(1).describe('Search query'),
      threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (default from settings)'),
      top_k: z.number().int().min(1).max(50).optional().describe('Max results (default from settings)'),
    },
    async ({ query, threshold, top_k }) => {
      const db = getDb();
      const defaults = getSearchSettings();
      const effectiveThreshold = threshold ?? defaults.threshold;
      const effectiveTopK = top_k ?? defaults.topK;

      // Generate query embedding
      let queryEmbedding: number[];
      try {
        queryEmbedding = await generateQueryEmbedding(query);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Embedding generation failed:', msg);
        return {
          content: [{ type: 'text' as const, text: `Embedding generation failed: ${msg}` }],
          isError: true,
        };
      }

      // Load all mashes with embeddings
      const rows = db
        .prepare(
          `SELECT id, type, summary, context, memo, embedding
           FROM mashes WHERE embedding IS NOT NULL`,
        )
        .all() as (Pick<Mash, 'id' | 'type' | 'summary' | 'context' | 'memo'> & {
        embedding: Buffer;
      })[];

      // Compute similarities
      const results: SimilarResult[] = [];
      for (const row of rows) {
        const storedEmbedding = deserializeEmbedding(row.embedding);
        const sim = cosineSimilarity(queryEmbedding, storedEmbedding);
        if (sim >= effectiveThreshold) {
          results.push({
            id: row.id,
            type: row.type,
            summary: row.summary,
            context: row.context,
            memo: row.memo,
            similarity: Math.round(sim * 10000) / 10000,
          });
        }
      }

      // Sort by similarity descending, take top_k
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, effectiveTopK);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(topResults, null, 2) }],
      };
    },
  );
}
