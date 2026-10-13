import { createHash, randomUUID } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function createDeterministicId(prefix: string, value: string): string {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}-${hash}`;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function uniqueStrings(items: string[]): string[] {
  return unique(
    items
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function buildHashedEmbedding(
  text: string,
  dimensions: number,
  seedTerms: string[] = [],
): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const terms = [...tokenize(text), ...seedTerms.map((term) => term.toLowerCase())];

  for (const term of terms) {
    const hash = createHash("sha256").update(term).digest();
    const bucket = hash.readUInt16BE(0) % dimensions;
    const sign = hash[2] % 2 === 0 ? 1 : -1;
    vector[bucket] += sign * (1 + term.length / 12);
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

export function formatVectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value.toFixed(6))).join(",")}]`;
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

export function startOfWeekIso(reference = new Date()): string {
  const next = new Date(reference);
  const day = next.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + offset);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, (now - then) / (1000 * 60 * 60 * 24));
}

export function chunkText(text: string, maxChars = 1800): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current) {
      chunks.push(current.trim());
      current = sentence;
      continue;
    }

    current = `${current} ${sentence}`.trim();
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
