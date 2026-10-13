/*
 * tokenize — small, deterministic tokenizer used by BM25.
 *
 * Lowercases, splits on non-alphanumeric boundaries, keeps numerics with
 * embedded decimals/commas (`1,500`, `1.2`), drops a tiny English stopword
 * set. No stemming — medical abbreviations (ANC, HER2) must survive intact
 * so BM25 term overlap works on the terms the clinical text actually uses.
 *
 * This is the contract every retrieval caller depends on. If you change it,
 * rebuild the BM25 index — otherwise query terms won't match posting lists.
 */

const STOPWORDS = new Set<string>([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "she",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

/**
 * Tokenize `text` into a normalized list of terms.
 *
 * Rules:
 * - Lowercase.
 * - Split on anything that isn't a letter, digit, period, or comma.
 * - Collapse trailing punctuation on each piece.
 * - Preserve numerics (`1,500`, `0.9`, `2.2`).
 * - Strip tiny English stopwords (see `STOPWORDS`).
 * - Drop empty pieces and single-character noise except digits.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const lowered = text.toLowerCase();
  // Split on whitespace + most punctuation; keep `.` and `,` so `1,500` / `0.9` survive.
  const raw = lowered.split(/[^a-z0-9.,/\-]+/);
  const out: string[] = [];
  for (const piece of raw) {
    // Trim leading/trailing punctuation so "her2," → "her2" and "0.9." → "0.9".
    const trimmed = piece.replace(/^[.,/\-]+|[.,/\-]+$/g, "");
    if (!trimmed) continue;
    if (STOPWORDS.has(trimmed)) continue;
    // Single-letter noise except "a"/"i" (already stopworded) and digits.
    if (trimmed.length === 1 && !/[0-9]/.test(trimmed)) continue;
    out.push(trimmed);
  }
  return out;
}

/**
 * Lightweight query expansion used when `expandedConcepts` are provided to
 * retrieval — adds the expanded terms as extra tokens so BM25 treats them
 * with the same weight as the base query. Uniqueness-preserving.
 */
export function expandQuery(base: string, expansions: string[]): string[] {
  const terms = tokenize(base);
  for (const exp of expansions) {
    for (const t of tokenize(exp)) {
      if (!terms.includes(t)) terms.push(t);
    }
  }
  return terms;
}
