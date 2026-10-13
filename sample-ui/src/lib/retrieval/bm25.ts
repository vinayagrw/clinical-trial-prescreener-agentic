/*
 * bm25 — Okapi BM25 index built in memory, no dependencies.
 *
 * Construction:  buildBm25Index(docs, { k1, b })
 * Search:        index.search(query, k)  →  [{ docId, score, termHits }]
 *
 * Scoring: classic Okapi BM25 per Robertson & Zaragoza (2009):
 *   score(q, d) = Σ_{t ∈ q} idf(t) · (tf(t, d) · (k1 + 1)) / (tf(t, d) + k1 · (1 - b + b · |d|/avgdl))
 *   idf(t) = ln((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
 *
 * Defaults `k1=1.2`, `b=0.75` match the most common clinical-trial retrieval
 * tuning; caller can override.
 */

import { tokenize } from "./tokenize.ts";

export interface Bm25Doc {
  id: string;
  text: string;
}

export interface Bm25Hit {
  docId: string;
  score: number;
  /** Which query terms actually matched this doc (for UI highlighting). */
  termHits: string[];
}

export interface Bm25Options {
  k1?: number;
  b?: number;
}

interface IndexedDoc {
  id: string;
  tf: Map<string, number>;
  length: number;
}

export interface Bm25Index {
  /** Run a tokenized query against the index; returns top-k hits. */
  search(query: string | string[], k?: number): Bm25Hit[];
  /** Total docs in the index. */
  readonly docCount: number;
  /** Average document length (in tokens). */
  readonly avgDocLength: number;
}

export function buildBm25Index(
  docs: Bm25Doc[],
  options: Bm25Options = {},
): Bm25Index {
  const k1 = options.k1 ?? 1.2;
  const b = options.b ?? 0.75;

  const indexed: IndexedDoc[] = [];
  const df = new Map<string, number>(); // term → doc frequency

  for (const raw of docs) {
    const tokens = tokenize(raw.text);
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
    indexed.push({ id: raw.id, tf, length: tokens.length });
  }

  const N = indexed.length;
  const avgdl =
    N > 0 ? indexed.reduce((acc, d) => acc + d.length, 0) / N : 0;

  function idf(term: string): number {
    const dfT = df.get(term) ?? 0;
    // BM25 idf — clamped at 0 via the "+ 1" trick so common terms don't go negative.
    return Math.log((N - dfT + 0.5) / (dfT + 0.5) + 1);
  }

  function search(query: string | string[], k = 10): Bm25Hit[] {
    const terms = Array.isArray(query) ? query : tokenize(query);
    if (terms.length === 0 || N === 0) return [];
    const scores: Bm25Hit[] = [];
    for (const doc of indexed) {
      let score = 0;
      const hits: string[] = [];
      for (const term of terms) {
        const tf = doc.tf.get(term);
        if (!tf) continue;
        const numerator = tf * (k1 + 1);
        const denom = tf + k1 * (1 - b + (b * doc.length) / (avgdl || 1));
        score += idf(term) * (numerator / denom);
        hits.push(term);
      }
      if (score > 0) {
        scores.push({ docId: doc.id, score, termHits: hits });
      }
    }
    scores.sort((a, c) => c.score - a.score);
    return scores.slice(0, k);
  }

  return {
    search,
    docCount: N,
    avgDocLength: avgdl,
  };
}

/**
 * Convert raw BM25 scores (unbounded) into a [0, 1] range for display.
 * Max-norm: divide by the top score in the hit list.
 */
export function normalizeBm25Scores(hits: Bm25Hit[]): Bm25Hit[] {
  if (hits.length === 0) return hits;
  const max = hits[0].score || 1;
  return hits.map((h) => ({ ...h, score: h.score / max }));
}
