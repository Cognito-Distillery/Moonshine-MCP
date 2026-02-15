/**
 * Embedding deserialization and cosine similarity (pure functions).
 * Matches Rust's little-endian f32 format.
 */

export function deserializeEmbedding(blob: Buffer): number[] {
  const floatCount = blob.byteLength / 4;
  const result: number[] = new Array(floatCount);
  for (let i = 0; i < floatCount; i++) {
    result[i] = blob.readFloatLE(i * 4);
  }
  return result;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
