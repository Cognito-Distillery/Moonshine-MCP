import { getDb } from './db.js';
import { logger } from './logger.js';
import type { EmbeddingProvider } from './types.js';

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  model: string;
}

function getEmbeddingConfig(): EmbeddingConfig {
  const db = getDb();
  const getSetting = (key: string): string | undefined => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  };

  const provider = (getSetting('embedding_provider') || 'openai') as EmbeddingProvider;
  let apiKey: string;
  let model: string;

  if (provider === 'gemini') {
    apiKey = getSetting('gemini_api_key') || '';
    model = getSetting('embedding_model') || 'gemini-embedding-001';
  } else {
    apiKey = getSetting('openai_api_key') || '';
    model = getSetting('embedding_model') || 'text-embedding-3-small';
  }

  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  return { provider, apiKey, model };
}

async function generateOpenAIEmbedding(
  text: string,
  apiKey: string,
  model: string,
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text, model }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embedding API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

async function generateGeminiEmbedding(
  text: string,
  apiKey: string,
  model: string,
): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini embedding API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const config = getEmbeddingConfig();
  logger.debug(`Generating embedding with ${config.provider}/${config.model}`);

  if (config.provider === 'gemini') {
    return generateGeminiEmbedding(query, config.apiKey, config.model);
  }
  return generateOpenAIEmbedding(query, config.apiKey, config.model);
}

export function getSearchSettings(): { threshold: number; topK: number } {
  const db = getDb();
  const getSetting = (key: string): string | undefined => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  };

  return {
    threshold: parseFloat(getSetting('pipeline_threshold') || '0.3'),
    topK: parseInt(getSetting('pipeline_top_k') || '5', 10),
  };
}
