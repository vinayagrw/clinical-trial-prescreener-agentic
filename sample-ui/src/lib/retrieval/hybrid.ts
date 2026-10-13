/*
 * hybrid — glue layer that blends BM25 (lexical) with embedding (semantic)
 * scores to produce a ranked result list, applies a freshness gate, and
 * returns results in the same shape the existing `HybridRetrievalView`
 * component already knows how to render.
 *
 * Why a hybrid: BM25 alone misses synonyms (ANC vs "absolute neutrophil
 * count"), and embeddings alone lose numerics. Blending catches both.
 *
 * The embedding side runs through `getOrchestrator().embed(...)` so we
 * automatically pick up hash embeddings in demo mode, Gemini/Ollama in
 * live mode. No code change needed to switch modes — just flip the
 * orchestrator flag from `/ai-features` or `/safety`.
 */

import type {
  RetrievalHighlightSpan,
  RetrievalQuery,
  RetrievalResult,
  RetrievalRun,
} from "../../types/aiFeatures";
import { getOrchestrator } from "../ai/providers";
import {
  RERANK_EVIDENCE_FEATURE_KEY,
  RERANK_EVIDENCE_SYSTEM,
  buildRerankEvidenceUserPrompt,
  type RerankCandidate,
} from "../ai/prompts/rerankEvidence";
import { RerankOutputSchema, type RerankOutput } from "../ai/prompts/rerankEvidence";
import { buildBm25Index, normalizeBm25Scores, type Bm25Hit } from "./bm25";
import { cosineSimilarity } from "./cosine";
import { EVIDENCE_CORPUS, toBm25Docs, type EvidenceNote } from "./evidenceCorpus";
import { expandQuery, tokenize } from "./tokenize";

export interface HybridRunOptions {
  /** ISO today date used by the freshness gate. Defaults to system today. */
  todayIso?: string;
  /** Max number of results returned. Defaults to 5 to match the UI. */
  topK?: number;
  /** Maximum note age (in days) before `passesFreshnessGate = false`. */
  freshnessDays?: number;
  /** Override the hybrid weights; defaults to `{ bm25: 0.4, embedding: 0.6 }`. */
  weights?: { bm25: number; embedding: number };
  /** Optionally restrict retrieval to a subset of the corpus. */
  corpus?: EvidenceNote[];
  /** When set, filter corpus to only notes belonging to this patient. */
  patientId?: string;
  /** When true, stale notes are hard-excluded from results (not just flagged). */
  freshnessMandatory?: boolean;
}

const DEFAULT_OPTS: Required<Omit<HybridRunOptions, "corpus" | "patientId" | "freshnessMandatory">> = {
  todayIso: new Date().toISOString().slice(0, 10),
  topK: 5,
  freshnessDays: 21,
  weights: { bm25: 0.4, embedding: 0.6 },
};

/**
 * Run the full hybrid retrieval pipeline: BM25 + embedding + blend +
 * freshness gate. Produces a `RetrievalRun` compatible with the existing
 * F2 view component.
 */
export async function runHybridRetrieval(
  query: Pick<RetrievalQuery, "criterionId" | "criterionLabel"> & {
    keywordTerms?: string[];
    expandedConcepts?: string[];
  },
  options: HybridRunOptions = {},
): Promise<RetrievalRun> {
  const opts = { ...DEFAULT_OPTS, ...options };
  const rawCorpus = options.corpus ?? EVIDENCE_CORPUS;
  // Item 3: patient boundary filter — prevents cross-patient evidence contamination.
  const corpus = options.patientId
    ? rawCorpus.filter((note) => note.patientId === options.patientId)
    : rawCorpus;
  const started = performance.now();

  // ---------- 1. Build BM25 index on this corpus ----------
  const bm25Index = buildBm25Index(toBm25Docs(corpus));

  // ---------- 2. Tokenize query + expansions ----------
  const keywordTerms = query.keywordTerms ?? [];
  const expandedConcepts = query.expandedConcepts ?? [];
  const queryText = [query.criterionLabel, ...keywordTerms].join(" ");
  const queryTokens = expandQuery(queryText, expandedConcepts);

  // ---------- 3. BM25 pass ----------
  const rawBm25 = bm25Index.search(queryTokens, corpus.length);
  const bm25Normalized = normalizeBm25Scores(rawBm25);
  const bm25ByDoc = new Map<string, Bm25Hit>(
    bm25Normalized.map((h) => [h.docId, h]),
  );

  // ---------- 4. Embedding pass ----------
  const orchestrator = getOrchestrator();
  const toEmbed = [queryText, ...corpus.map((n) => n.text)];
  let embeddingByDoc = new Map<string, number>();
  try {
    const embedResult = await orchestrator.embed(toEmbed);
    const [queryVec, ...docVecs] = embedResult.embeddings;
    if (queryVec && docVecs.length === corpus.length) {
      docVecs.forEach((vec, i) => {
        const sim = cosineSimilarity(queryVec, vec);
        embeddingByDoc.set(corpus[i].id, sim);
      });
    }
  } catch {
    // If all embedding providers fail, fall back to zero embedding signal;
    // BM25 alone still returns useful results.
    embeddingByDoc = new Map<string, number>();
  }

  // Normalize embedding scores into [0, 1] so the final blend is bounded.
  const maxEmbed =
    Math.max(0, ...Array.from(embeddingByDoc.values())) || 1;
  const embNormalized = new Map<string, number>(
    Array.from(embeddingByDoc, ([k, v]) => [k, v / maxEmbed]),
  );

  // ---------- 5. Blend + freshness gate ----------
  const freshnessCutoff = addDays(opts.todayIso, -opts.freshnessDays);
  const blended: RetrievalResult[] = corpus.map((note) => {
    const bm25 = bm25ByDoc.get(note.id)?.score ?? 0;
    const emb = embNormalized.get(note.id) ?? 0;
    const hybrid =
      opts.weights.bm25 * bm25 + opts.weights.embedding * emb;
    const passesFreshnessGate = note.sourceDate >= freshnessCutoff;
    const termHits = bm25ByDoc.get(note.id)?.termHits ?? [];
    return {
      id: note.id,
      rank: 0, // filled in after sort
      source: note.source,
      sourceSystem: note.sourceSystem,
      sourceDate: note.sourceDate,
      author: note.author,
      excerpt: note.text,
      highlightSpans: buildHighlightSpans(note.text, termHits),
      bm25Score: clamp01(bm25),
      embeddingScore: clamp01(emb),
      hybridScore: clamp01(hybrid),
      rerankerScore: 0, // set below by reranker or recency boost
      finalScore: 0,     // set below after reranking
      passesFreshnessGate,
    };
  });

  // ---------- 6. Reranker (Item 2): LLM cross-encoder or fallback recency boost ----------
  const rerankerEnabled =
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_RERANKER_ENABLED === "true";

  if (rerankerEnabled && !orchestrator.isDemoMode?.()) {
    try {
      const candidates: RerankCandidate[] = blended
        .sort((a, b) => b.hybridScore - a.hybridScore)
        .slice(0, 10)
        .map((r) => ({
          evidenceId: r.id,
          excerpt: r.excerpt.slice(0, 300),
          sourceDate: r.sourceDate,
        }));
      const rerankResult = await orchestrator.generate<RerankOutput>({
        featureKey: RERANK_EVIDENCE_FEATURE_KEY,
        system: RERANK_EVIDENCE_SYSTEM,
        user: buildRerankEvidenceUserPrompt(query.criterionLabel, candidates),
        schema: RerankOutputSchema,
        temperature: 0.0,
        maxTokens: 512,
      });
      const rerankMap = new Map(
        rerankResult.value.ranked.map((entry) => [entry.evidenceId, entry.score]),
      );
      for (const r of blended) {
        const rerankScore = rerankMap.get(r.id);
        r.rerankerScore = rerankScore != null ? clamp01(rerankScore) : clamp01(r.hybridScore * 0.5);
        r.finalScore = clamp01(r.hybridScore * 0.4 + r.rerankerScore * 0.6);
      }
    } catch {
      // LLM reranker failed — fall back to recency boost
      applyRecencyBoostToAll(blended, opts.todayIso);
    }
  } else {
    // Demo mode or reranker not enabled — use deterministic recency boost.
    applyRecencyBoostToAll(blended, opts.todayIso);
  }

  // ---------- 7. Sort, freshness hard-filter, topK ----------
  blended.sort((a, b) => b.finalScore - a.finalScore);
  // Item 4: hard freshness gate — when enabled, stale notes are excluded entirely.
  const freshnessFiltered = options.freshnessMandatory
    ? blended.filter((r) => r.passesFreshnessGate)
    : blended;
  const topK = freshnessFiltered.slice(0, opts.topK).map((r, i) => ({ ...r, rank: i + 1 }));

  const wallTimeMs = Math.round(performance.now() - started);

  return {
    id: `retr-${Date.now()}`,
    patientId: "patient-001",
    query: {
      criterionId: query.criterionId,
      criterionLabel: query.criterionLabel,
      keywordTerms: keywordTerms.length > 0 ? keywordTerms : tokenize(query.criterionLabel),
      expandedConcepts,
      hybridWeights: opts.weights,
    },
    wallTimeMs,
    corpusSizeNotes: corpus.length,
    results: topK,
  };
}

// ---------- helpers ----------

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Apply recency boost to all blended results (deterministic fallback for reranker). */
function applyRecencyBoostToAll(
  results: RetrievalResult[],
  todayIso: string,
): void {
  for (const r of results) {
    const boost = recencyScore(r.sourceDate, todayIso);
    r.rerankerScore = clamp01(r.hybridScore * 0.7 + boost * 0.3);
    r.finalScore = clamp01(r.hybridScore * 0.6 + r.rerankerScore * 0.4);
  }
}

/** Simple exponential decay — documents older than 60d get near-0. */
function recencyScore(sourceDate: string, todayIso: string): number {
  const diff =
    (new Date(`${todayIso}T00:00:00Z`).getTime() -
      new Date(`${sourceDate}T00:00:00Z`).getTime()) /
    (1000 * 60 * 60 * 24);
  const clamped = Math.max(0, diff);
  return Math.exp(-clamped / 30); // half life ~20 days
}

/** Build highlight spans by finding each matched BM25 term in the excerpt. */
function buildHighlightSpans(
  excerpt: string,
  termHits: string[],
): RetrievalHighlightSpan[] {
  const spans: RetrievalHighlightSpan[] = [];
  const lower = excerpt.toLowerCase();
  for (const term of termHits) {
    let fromIndex = 0;
    while (true) {
      const idx = lower.indexOf(term, fromIndex);
      if (idx === -1) break;
      spans.push({ start: idx, end: idx + term.length, term });
      fromIndex = idx + term.length;
      if (spans.length >= 8) break; // cap for UI
    }
    if (spans.length >= 8) break;
  }
  return spans;
}
