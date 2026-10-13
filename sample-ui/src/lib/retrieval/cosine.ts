/*
 * cosine — vector math used by the embedding half of hybrid retrieval.
 *
 * Both `cosineSimilarity` and `l2normalize` assume plain number[] vectors.
 * Callers can pre-normalize their corpus once and then use dot products,
 * but `cosineSimilarity` itself is safe on raw vectors too.
 *
 * Nothing here depends on a specific embedding provider — hash-based demo
 * embeddings, Gemini `text-embedding-004` (768-dim), and Ollama
 * `nomic-embed-text` (768-dim) are all just number[] to this module.
 */

export function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += a[i] * b[i];
  }
  return acc;
}

export function l2norm(v: number[]): number {
  let acc = 0;
  for (const x of v) acc += x * x;
  return Math.sqrt(acc);
}

export function l2normalize(v: number[]): number[] {
  const n = l2norm(v);
  if (n === 0) return v.slice();
  return v.map((x) => x / n);
}

/**
 * Cosine similarity on raw (not necessarily normalized) vectors.
 * Returns 0 when either vector has zero magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const na = l2norm(a);
  const nb = l2norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}
