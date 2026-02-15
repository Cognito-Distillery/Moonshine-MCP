import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb, isReadOnly } from '../db.js';
import type { GraphNode, GraphEdge, GraphData, RelationType, EdgeSource } from '../types.js';

const VALID_RELATION_TYPES: RelationType[] = ['RELATED_TO', 'SUPPORTS', 'CONFLICTS_WITH'];
const VALID_EDGE_SOURCES: EdgeSource[] = ['ai', 'human'];

export function registerGraphTools(server: McpServer): void {
  // get_graph
  server.tool(
    'get_graph',
    'Get knowledge graph data (JARRED mashes only) with optional filtering',
    {
      mash_types: z
        .array(z.string())
        .optional()
        .describe('Filter by mash types'),
      relation_types: z
        .array(z.enum(VALID_RELATION_TYPES as [string, ...string[]]))
        .optional()
        .describe('Filter by relation types'),
      sources: z
        .array(z.enum(VALID_EDGE_SOURCES as [string, ...string[]]))
        .optional()
        .describe('Filter edges by source (ai/human)'),
    },
    ({ mash_types, relation_types, sources }) => {
      const db = getDb();

      // Fetch JARRED nodes
      let nodeSql =
        'SELECT id, type, summary, context, memo, created_at, updated_at FROM mashes WHERE status = ?';
      const nodeParams: unknown[] = ['JARRED'];

      if (mash_types && mash_types.length > 0) {
        const placeholders = mash_types.map(() => '?').join(', ');
        nodeSql += ` AND type IN (${placeholders})`;
        nodeParams.push(...mash_types);
      }

      const nodes = db.prepare(nodeSql).all(...nodeParams) as GraphNode[];
      const nodeIds = new Set(nodes.map((n) => n.id));

      // Fetch edges between JARRED nodes
      let edgeSql = `SELECT id, source_id, target_id, relation_type, source, confidence
                     FROM edges WHERE source_id IN (SELECT id FROM mashes WHERE status = 'JARRED')
                     AND target_id IN (SELECT id FROM mashes WHERE status = 'JARRED')`;
      const edgeParams: unknown[] = [];

      if (relation_types && relation_types.length > 0) {
        const placeholders = relation_types.map(() => '?').join(', ');
        edgeSql += ` AND relation_type IN (${placeholders})`;
        edgeParams.push(...relation_types);
      }

      if (sources && sources.length > 0) {
        const placeholders = sources.map(() => '?').join(', ');
        edgeSql += ` AND source IN (${placeholders})`;
        edgeParams.push(...sources);
      }

      const allEdges = db.prepare(edgeSql).all(...edgeParams) as GraphEdge[];

      // Only include edges where both endpoints are in our filtered node set
      const edges =
        mash_types && mash_types.length > 0
          ? allEdges.filter((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id))
          : allEdges;

      const result: GraphData = { nodes, edges };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // get_node_detail
  server.tool(
    'get_node_detail',
    'Get a node with its neighbors and connecting edges',
    { id: z.string().describe('Mash UUID') },
    ({ id }) => {
      const db = getDb();

      const node = db
        .prepare(
          'SELECT id, type, summary, context, memo, created_at, updated_at FROM mashes WHERE id = ?',
        )
        .get(id) as GraphNode | undefined;

      if (!node) {
        return {
          content: [{ type: 'text' as const, text: `Node not found: ${id}` }],
          isError: true,
        };
      }

      // Edges where this node is source or target
      const edges = db
        .prepare(
          `SELECT id, source_id, target_id, relation_type, source, confidence
           FROM edges WHERE source_id = ? OR target_id = ?`,
        )
        .all(id, id) as GraphEdge[];

      // Collect neighbor IDs
      const neighborIds = new Set<string>();
      for (const e of edges) {
        if (e.source_id !== id) neighborIds.add(e.source_id);
        if (e.target_id !== id) neighborIds.add(e.target_id);
      }

      // Fetch neighbor nodes
      let neighbors: GraphNode[] = [];
      if (neighborIds.size > 0) {
        const ids = [...neighborIds];
        const placeholders = ids.map(() => '?').join(', ');
        neighbors = db
          .prepare(
            `SELECT id, type, summary, context, memo, created_at, updated_at
             FROM mashes WHERE id IN (${placeholders})`,
          )
          .all(...ids) as GraphNode[];
      }

      const result = { node, neighbors, edges };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // add_edge
  server.tool(
    'add_edge',
    'Add a relationship edge between two mashes (upsert)',
    {
      source_id: z.string().describe('Source mash UUID'),
      target_id: z.string().describe('Target mash UUID'),
      relation_type: z
        .enum(VALID_RELATION_TYPES as [string, ...string[]])
        .describe('Relation type'),
      source: z
        .enum(VALID_EDGE_SOURCES as [string, ...string[]])
        .default('human')
        .describe('Edge source'),
      confidence: z.number().min(0).max(1).default(0).describe('Confidence score'),
    },
    ({ source_id, target_id, relation_type, source, confidence }) => {
      if (isReadOnly()) {
        return {
          content: [
            { type: 'text' as const, text: 'Cannot add edge: database is in read-only mode' },
          ],
          isError: true,
        };
      }

      const db = getDb();

      // Verify both mashes exist
      const srcExists = db.prepare('SELECT id FROM mashes WHERE id = ?').get(source_id);
      const tgtExists = db.prepare('SELECT id FROM mashes WHERE id = ?').get(target_id);
      if (!srcExists) {
        return {
          content: [{ type: 'text' as const, text: `Source mash not found: ${source_id}` }],
          isError: true,
        };
      }
      if (!tgtExists) {
        return {
          content: [{ type: 'text' as const, text: `Target mash not found: ${target_id}` }],
          isError: true,
        };
      }

      const now = Date.now();
      db.prepare(
        `INSERT INTO edges (source_id, target_id, relation_type, source, confidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_id, target_id)
         DO UPDATE SET relation_type = excluded.relation_type,
                       source = excluded.source,
                       confidence = excluded.confidence,
                       updated_at = excluded.updated_at`,
      ).run(source_id, target_id, relation_type, source, confidence, now, now);

      const edge = db
        .prepare(
          `SELECT id, source_id, target_id, relation_type, source, confidence, created_at, updated_at
           FROM edges WHERE source_id = ? AND target_id = ?`,
        )
        .get(source_id, target_id);

      return { content: [{ type: 'text' as const, text: JSON.stringify(edge, null, 2) }] };
    },
  );

  // update_edge
  server.tool(
    'update_edge',
    'Update an existing edge',
    {
      id: z.number().int().describe('Edge ID'),
      relation_type: z
        .enum(VALID_RELATION_TYPES as [string, ...string[]])
        .optional()
        .describe('New relation type'),
      confidence: z.number().min(0).max(1).optional().describe('New confidence'),
    },
    ({ id, relation_type, confidence }) => {
      if (isReadOnly()) {
        return {
          content: [
            { type: 'text' as const, text: 'Cannot update edge: database is in read-only mode' },
          ],
          isError: true,
        };
      }

      const db = getDb();
      const existing = db.prepare('SELECT id FROM edges WHERE id = ?').get(id);
      if (!existing) {
        return {
          content: [{ type: 'text' as const, text: `Edge not found: ${id}` }],
          isError: true,
        };
      }

      const sets: string[] = [];
      const params: unknown[] = [];

      if (relation_type !== undefined) {
        sets.push('relation_type = ?');
        params.push(relation_type);
      }
      if (confidence !== undefined) {
        sets.push('confidence = ?');
        params.push(confidence);
      }

      if (sets.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No fields to update' }],
          isError: true,
        };
      }

      sets.push('updated_at = ?');
      params.push(Date.now());
      params.push(id);

      db.prepare(`UPDATE edges SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      const edge = db
        .prepare(
          `SELECT id, source_id, target_id, relation_type, source, confidence, created_at, updated_at
           FROM edges WHERE id = ?`,
        )
        .get(id);

      return { content: [{ type: 'text' as const, text: JSON.stringify(edge, null, 2) }] };
    },
  );

  // delete_edge
  server.tool(
    'delete_edge',
    'Delete an edge by ID',
    { id: z.number().int().describe('Edge ID') },
    ({ id }) => {
      if (isReadOnly()) {
        return {
          content: [
            { type: 'text' as const, text: 'Cannot delete edge: database is in read-only mode' },
          ],
          isError: true,
        };
      }

      const db = getDb();
      const existing = db.prepare('SELECT id FROM edges WHERE id = ?').get(id);
      if (!existing) {
        return {
          content: [{ type: 'text' as const, text: `Edge not found: ${id}` }],
          isError: true,
        };
      }

      db.prepare('DELETE FROM edges WHERE id = ?').run(id);
      return { content: [{ type: 'text' as const, text: `Deleted edge: ${id}` }] };
    },
  );
}
