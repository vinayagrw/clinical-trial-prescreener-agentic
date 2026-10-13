/*
 * aiEvaluation store — live state for the F3 Criterion Evaluation view.
 *
 * Each decomposed criterion gets its own per-row verdict slot. Calling
 * `evaluateCriterion(criterion)` sends one F3 prompt through the orchestrator
 * with `VerdictSchema` — in demo mode this returns the canned F3 fixture
 * keyed by `dc-XXX` from the user prompt; in live mode Gemini / Groq / Ollama
 * produces the same shape validated by Zod.
 *
 * The store keeps per-row status (so the matrix can show "re-evaluating" on a
 * single row while others are untouched) and a derived `entries`
 * `CriterionMatrixEntry[]` list that `CriterionEvaluationMatrix.tsx` can
 * render without understanding schemas.
 *
 * Evidence: by default the store pulls the full `EVIDENCE_CORPUS` from the
 * P2 retrieval layer and feeds it to every prompt. Higher layers (P5 pipeline
 * stepper) will swap this for per-criterion retrieval hits from `aiRetrieval`.
 */

import { create } from "zustand";
import { getOrchestrator } from "../lib/ai/providers";
import type { ProviderName } from "../lib/ai/providers";
import {
  VerdictSchema,
  type Verdict,
  type DecomposedCriterionAI,
} from "../lib/ai/schemas";
import {
  EVALUATE_CRITERION_FEATURE_KEY,
  EVALUATE_CRITERION_SYSTEM,
  buildEvaluateCriterionUserPrompt,
  type EvaluationEvidence,
} from "../lib/ai/prompts/evaluateCriterion";
import { getEvaluationGuard } from "../lib/safety/guards/evaluation";
import { SafetyBlockError } from "../lib/safety/safetyGuard";
import { EVIDENCE_CORPUS } from "../lib/retrieval/evidenceCorpus";
import type {
  CriterionMatrixEntry,
  DecomposedCriterion,
} from "../types/aiFeatures";
import type { Freshness, MatchStatus } from "../types/clinical";

export type EvaluationStatus = "idle" | "running" | "success" | "error";

interface EvaluationRowState {
  status: EvaluationStatus;
  verdict: Verdict | null;
  error: string | null;
  provider: ProviderName | null;
  model: string | null;
  wallTimeMs: number | null;
  lastRunAt: string | null;
}

interface AiEvaluationState {
  /** Overall runner state (true once any row is running). */
  status: EvaluationStatus;
  /** Per-row verdicts keyed by criterion id. */
  rows: Record<string, EvaluationRowState>;
  /** Bulk error, if the orchestrator fully failed. */
  error: string | null;
  /** ISO timestamp of the last run-all. */
  lastRunAt: string | null;
  /** Kick a single-row evaluation. */
  evaluateCriterion: (
    criterion: DecomposedCriterion,
    evidence?: EvaluationEvidence[],
  ) => Promise<void>;
  /** Kick a run across every provided criterion in sequence (so demo mode feels like a pipeline). */
  evaluateAll: (
    criteria: DecomposedCriterion[],
    evidence?: EvaluationEvidence[],
  ) => Promise<void>;
  /** Read the verdicts as `CriterionMatrixEntry[]` for the F3 matrix UI. */
  getEntries: (criteria: DecomposedCriterion[]) => CriterionMatrixEntry[];
  reset: () => void;
}

/** Convert the UI DecomposedCriterion back to the AI schema shape for the prompt. */
function toAiCriterion(c: DecomposedCriterion): DecomposedCriterionAI {
  return {
    id: c.id,
    label: c.label,
    type: c.type,
    computability: c.computability,
    threshold: c.threshold,
    confidence: c.confidence,
    source: {
      pageRef: c.source.pageRef,
      originalText: c.source.originalText,
    },
    normalizedConcepts: [...c.normalizedConcepts],
    reviewNote: c.reviewNote,
  };
}

/** Default evidence deck — every canned chart note from the P2 retrieval corpus. */
function defaultEvidence(): EvaluationEvidence[] {
  return EVIDENCE_CORPUS.map((note) => ({
    evidenceId: note.id,
    source: note.source,
    sourceDate: note.sourceDate,
    excerpt: note.text.slice(0, 240),
  }));
}

/** Derive a coarse freshness bucket from the most recent citation date. */
function freshnessFromCitations(verdict: Verdict): Freshness {
  if (verdict.citations.length === 0) return "missing";
  const today = new Date("2026-04-14T00:00:00Z").getTime();
  const newest = verdict.citations
    .map((c) => new Date(`${c.sourceDate}T00:00:00Z`).getTime())
    .reduce((a, b) => Math.max(a, b), 0);
  if (!Number.isFinite(newest) || newest === 0) return "missing";
  const days = Math.floor((today - newest) / (24 * 60 * 60 * 1000));
  if (days <= 14) return "fresh";
  if (days <= 28) return "aging";
  return "stale";
}

function statusToMatch(status: Verdict["status"]): MatchStatus {
  return status;
}

/** Convert a schema-valid verdict to the existing `CriterionMatrixEntry` shape. */
function toMatrixEntry(
  criterion: DecomposedCriterion,
  row: EvaluationRowState,
): CriterionMatrixEntry {
  const verdict = row.verdict;
  const now = row.lastRunAt ?? new Date().toISOString();
  if (!verdict) {
    return {
      id: `eval-${criterion.id}`,
      label: criterion.label,
      bucket: criterion.type,
      status:
        criterion.computability === "manual_only" ? "manual_review" : "uncertain",
      computability: criterion.computability,
      reasoning:
        row.status === "running"
          ? "Evaluating…"
          : row.error
            ? `Evaluation failed: ${row.error}`
            : "Not yet evaluated.",
      uncertaintyReason:
        criterion.computability === "manual_only" ? "manual_only" : "missing_domain",
      citations: [],
      freshness: "missing",
      thresholdLabel: criterion.threshold,
      lastEvaluatedAt: now,
      reviewRequired: true,
    };
  }
  return {
    id: `eval-${criterion.id}`,
    label: criterion.label,
    bucket: criterion.type,
    status: statusToMatch(verdict.status),
    computability: criterion.computability,
    reasoning: verdict.reasoning,
    uncertaintyReason: verdict.uncertaintyReason,
    citations: verdict.citations.map((c) => ({
      evidenceId: c.evidenceId,
      source: c.source,
      sourceDate: c.sourceDate,
      excerpt: c.excerpt,
    })),
    freshness: freshnessFromCitations(verdict),
    thresholdLabel: criterion.threshold,
    lastEvaluatedAt: now,
    reviewRequired:
      verdict.status === "manual_review" || verdict.status === "uncertain",
  };
}

const idleRow: EvaluationRowState = {
  status: "idle",
  verdict: null,
  error: null,
  provider: null,
  model: null,
  wallTimeMs: null,
  lastRunAt: null,
};

export const useAiEvaluationStore = create<AiEvaluationState>((set, get) => ({
  status: "idle",
  rows: {},
  error: null,
  lastRunAt: null,

  evaluateCriterion: async (criterion, evidence) => {
    const ev = evidence ?? defaultEvidence();
    set((state) => ({
      status: "running",
      error: null,
      rows: {
        ...state.rows,
        [criterion.id]: {
          ...idleRow,
          ...state.rows[criterion.id],
          status: "running",
          error: null,
        },
      },
    }));
    try {
      const result = await getOrchestrator().generate<Verdict>({
        featureKey: EVALUATE_CRITERION_FEATURE_KEY,
        system: EVALUATE_CRITERION_SYSTEM,
        user: buildEvaluateCriterionUserPrompt(toAiCriterion(criterion), ev),
        schema: VerdictSchema,
        temperature: 0.1,
        maxTokens: 1024,
      });
      // F3 guard stack: schemaValidator → citationEnforcer → biasToUncertain
      // → contradictionDetector → negationDetector → contraindicationCheck
      // → modelRegression. Rewrites propagate; `block` severity throws
      // SafetyBlockError, which we convert to an error row below.
      const guardedVerdict = getEvaluationGuard().run(result.value, {
        feature: "F3",
        featureKey: EVALUATE_CRITERION_FEATURE_KEY,
        provider: result.provider,
        model: result.model,
      });
      set((state) => ({
        status: "success",
        rows: {
          ...state.rows,
          [criterion.id]: {
            status: "success",
            verdict: guardedVerdict,
            error: null,
            provider: result.provider,
            model: result.model,
            wallTimeMs: result.wallTimeMs,
            lastRunAt: new Date().toISOString(),
          },
        },
        lastRunAt: new Date().toISOString(),
      }));
    } catch (err) {
      const message =
        err instanceof SafetyBlockError
          ? `Safety guard blocked F3 verdict: ${err.message}`
          : (err as Error).message;
      set((state) => ({
        status: "error",
        error: message,
        rows: {
          ...state.rows,
          [criterion.id]: {
            ...(state.rows[criterion.id] ?? idleRow),
            status: "error",
            error: message,
          },
        },
      }));
    }
  },

  evaluateAll: async (criteria, evidence) => {
    const ev = evidence ?? defaultEvidence();
    set({ status: "running", error: null });
    // Sequential so the matrix fills row-by-row in demo mode (feels like a pipeline).
    for (const criterion of criteria) {
      // eslint-disable-next-line no-await-in-loop
      await get().evaluateCriterion(criterion, ev);
    }
    set({ status: "success", lastRunAt: new Date().toISOString() });
  },

  getEntries: (criteria) => {
    const rows = get().rows;
    return criteria.map((c) => toMatrixEntry(c, rows[c.id] ?? idleRow));
  },

  reset: () =>
    set({ status: "idle", rows: {}, error: null, lastRunAt: null }),
}));
