/*
 * F3 — Criterion-Level Evaluation Matrix with Uncertainty Narration.
 *
 * Interactive view:
 * - Pulls the decomposed criterion list from `useAiDecompositionStore` (so
 *   whatever F1 produced flows into F3 without manual plumbing).
 * - Each row has its own per-criterion state from `useAiEvaluationStore` and
 *   its own "Re-evaluate" button. "Evaluate all" kicks a sequential run down
 *   the list so the matrix fills row-by-row and demo mode still feels like a
 *   pipeline.
 *
 * The 5-tile summary is derived from the current `entries` list rather than
 * a separate stats payload — same visual layout as the static mock, but live.
 *
 * The bias-to-uncertain stat is the product thesis: any time evidence is
 * missing / stale / contradictory the verdict is `uncertain`, never a silent
 * pass. That coordinator-routable path is what turns "conservative AI = fewer
 * enrollments" on its head — see `21-ai-safety-and-success-model.md` §2.
 */

import { useMemo } from "react";
import { HumanReviewPanel } from "../HumanReviewPanel";
import { getEffectiveReviewOutput, useAiReviewRunSync } from "../../lib/reviews";
import type {
  CriterionMatrixEntry,
  DecomposedCriterion,
  UncertaintyReason,
} from "../../types/aiFeatures";
import type { MatchStatus } from "../../types/clinical";
import { useAiDecompositionStore } from "../../stores/aiDecomposition";
import { useAiEvaluationStore } from "../../stores/aiEvaluation";

function statusDotClass(status: MatchStatus): string {
  switch (status) {
    case "pass":
      return "aif-matrix-status-dot aif-matrix-status-pass";
    case "fail":
      return "aif-matrix-status-dot aif-matrix-status-fail";
    case "uncertain":
      return "aif-matrix-status-dot aif-matrix-status-uncertain";
    case "manual_review":
      return "aif-matrix-status-dot aif-matrix-status-manual";
  }
}

function statusLabelClass(status: MatchStatus): string {
  switch (status) {
    case "pass":
      return "aif-label aif-matrix-status-pass-label";
    case "fail":
      return "aif-label aif-matrix-status-fail-label";
    case "uncertain":
      return "aif-label aif-matrix-status-uncertain-label";
    case "manual_review":
      return "aif-label aif-matrix-status-manual-label";
  }
}

function statusShortLabel(status: MatchStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "uncertain":
      return "Uncert.";
    case "manual_review":
      return "Manual";
  }
}

function humanizeReason(reason: UncertaintyReason): string {
  switch (reason) {
    case "missing_domain":
      return "missing_domain";
    case "conflicting_evidence":
      return "conflicting_evidence";
    case "protocol_ambiguity":
      return "protocol_ambiguity";
    case "stale_data":
      return "stale_data";
    case "manual_only":
      return "manual_only";
  }
}

interface MatrixRowProps {
  entry: CriterionMatrixEntry;
  criterion: DecomposedCriterion;
  rowStatus: "idle" | "running" | "success" | "error";
  onReevaluate: () => void;
}

function MatrixRow({ entry, criterion, rowStatus, onReevaluate }: MatrixRowProps) {
  const lastEvaluated = entry.lastEvaluatedAt.slice(0, 10);
  return (
    <div className="aif-matrix-row">
      <div className="aif-matrix-status-cell">
        <span className={statusDotClass(entry.status)} aria-hidden="true" />
        <span className={statusLabelClass(entry.status)}>{statusShortLabel(entry.status)}</span>
      </div>

      <div className="aif-matrix-label-cell">
        <div className="aif-matrix-label-title">
          {entry.bucket === "inclusion" ? "IN — " : "EX — "}
          {entry.label}
        </div>
        <div className="aif-matrix-threshold">{entry.thresholdLabel}</div>
        <button
          type="button"
          className="aif-btn aif-btn-ghost"
          onClick={onReevaluate}
          disabled={rowStatus === "running"}
        >
          {rowStatus === "running" ? "Re-evaluating…" : "Re-evaluate"}
        </button>
      </div>

      <div className="aif-matrix-reason">
        {entry.reasoning}
        {entry.uncertaintyReason && (
          <div>
            <span className="aif-matrix-uncertain-reason">
              reason: {humanizeReason(entry.uncertaintyReason)}
            </span>
          </div>
        )}
        {criterion.reviewNote && (
          <div className="aif-matrix-review-note">note: {criterion.reviewNote}</div>
        )}
      </div>

      <div className="aif-matrix-meta-cell">
        <span>freshness: {entry.freshness}</span>
        <span>last eval: {lastEvaluated}</span>
        {entry.citations.length > 0 ? (
          entry.citations.map((citation) => (
            <span key={citation.evidenceId} className="aif-matrix-cite">
              {citation.source} • {citation.sourceDate}
            </span>
          ))
        ) : (
          <span className="aif-matrix-cite">(no citations — manual only)</span>
        )}
      </div>
    </div>
  );
}

export function CriterionEvaluationMatrix() {
  const criteria = useAiDecompositionStore((s) => s.view?.criteria ?? []);
  const rows = useAiEvaluationStore((s) => s.rows);
  const runnerStatus = useAiEvaluationStore((s) => s.status);
  const evaluateCriterion = useAiEvaluationStore((s) => s.evaluateCriterion);
  const evaluateAll = useAiEvaluationStore((s) => s.evaluateAll);

  // Derive the entry list from the current verdicts. We don't call
  // `getEntries` directly here (it's a non-reactive getter) — instead we
  // recompute inline so this component reacts to `rows` changes.
  const entries: CriterionMatrixEntry[] = useMemo(() => {
    return useAiEvaluationStore.getState().getEntries(criteria);
    // We depend on `rows` AND `criteria` to stay reactive to both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, rows]);

  const stats = useMemo(() => {
    const pass = entries.filter((e) => e.status === "pass").length;
    const fail = entries.filter((e) => e.status === "fail").length;
    const uncertain = entries.filter((e) => e.status === "uncertain").length;
    const manual_review = entries.filter((e) => e.status === "manual_review").length;
    const biasToUncertainCount = entries.filter(
      (e) => e.status === "uncertain" && e.uncertaintyReason !== undefined,
    ).length;
    return { pass, fail, uncertain, manual_review, biasToUncertainCount };
  }, [entries]);

  if (criteria.length === 0) {
    return (
      <div className="aif-matrix">
        <div className="aif-retr-empty">
          Run F1 decomposition first — this matrix evaluates the criteria it emits.
        </div>
      </div>
    );
  }

  const reviewRun = useAiReviewRunSync({
    sourceKey: "ai-features:f3:trial-001",
    featureKey: "F3_criterion_evaluation",
    featureLabel: "F3 Criterion evaluation",
    stageKey: "evaluation",
    workspace: "ai_features",
    entityType: "trial_match",
    entityId: "trial-001",
    entityLabel: "Protocol criteria evaluation matrix",
    deepLink: "/ai-features",
    summary: `Evaluated ${entries.length} criteria with ${stats.uncertain + stats.manual_review} requiring manual attention.`,
    promptSnapshot: {
      criterionIds: criteria.map((criterion) => criterion.id),
    },
    inputSnapshot: {
      criteria,
    },
    outputSnapshot: {
      entries,
      stats,
    },
    policy: "required_before_continue",
    allowedActions: [
      "approve_as_is",
      "edit_output",
      "modify_evidence",
      "edit_input_and_rerun",
      "override",
      "reject",
      "escalate_manual_review",
      "revert_to_ai_draft",
    ],
    editableFields: ["inputSnapshot", "outputSnapshot", "citations"],
    requiredFields: ["rationale"],
    citations: entries.flatMap((entry) =>
      entry.citations.map((citation) => ({
        id: `${entry.id}-${citation.evidenceId}`,
        label: `${entry.label} · ${citation.source}`,
        detail: citation.sourceDate,
        quote: citation.excerpt,
        tone:
          entry.status === "uncertain" || entry.status === "manual_review"
            ? "warning"
            : "supporting",
      })),
    ),
    safetyFlags: entries
      .filter((entry) => entry.reviewRequired)
      .map((entry) => ({
        id: `review-${entry.id}`,
        label: `${entry.label} requires reviewer confirmation`,
        detail: entry.reasoning,
        severity: "warning" as const,
      })),
  });
  const displayEvaluation = getEffectiveReviewOutput(reviewRun.run, {
    entries,
    stats,
  });
  const displayEntries = displayEvaluation.entries ?? entries;
  const displayStats = displayEvaluation.stats ?? stats;

  return (
    <div className="aif-matrix">
      <div className="aif-matrix-controls">
        <button
          type="button"
          className="aif-btn aif-btn-primary"
          onClick={() => void evaluateAll(criteria)}
          disabled={runnerStatus === "running"}
        >
          {runnerStatus === "running" ? "Evaluating…" : "Evaluate all criteria"}
        </button>
        <span className="aif-matrix-controls-hint">
          Runs each criterion through F3 sequentially · demo mode uses canned verdicts, live mode
          hits the active provider.
        </span>
      </div>

      <div className="aif-matrix-summary">
        <div className="aif-matrix-stat aif-matrix-stat-pass">
          <span className="aif-label">Pass</span>
          <span className="aif-value">{displayStats.pass}</span>
        </div>
        <div className="aif-matrix-stat aif-matrix-stat-fail">
          <span className="aif-label">Fail</span>
          <span className="aif-value">{displayStats.fail}</span>
        </div>
        <div className="aif-matrix-stat aif-matrix-stat-uncertain">
          <span className="aif-label">Uncertain</span>
          <span className="aif-value">{displayStats.uncertain}</span>
        </div>
        <div className="aif-matrix-stat aif-matrix-stat-review">
          <span className="aif-label">Manual review</span>
          <span className="aif-value">{displayStats.manual_review}</span>
        </div>
        <div className="aif-matrix-stat aif-matrix-stat-bias">
          <span className="aif-label">Bias-to-uncertain</span>
          <span className="aif-value">{displayStats.biasToUncertainCount}</span>
        </div>
      </div>

      <div className="aif-matrix-table">
        <div className="aif-matrix-row aif-matrix-header-row">
          <span>Status</span>
          <span>Criterion</span>
          <span>Reasoning</span>
          <span>Evidence</span>
        </div>
        {displayEntries.map((entry) => {
          const criterion = criteria.find((c) => `eval-${c.id}` === entry.id);
          if (!criterion) return null;
          const rowStatus = rows[criterion.id]?.status ?? "idle";
          return (
            <MatrixRow
              key={entry.id}
              entry={entry}
              criterion={criterion}
              rowStatus={rowStatus}
              onReevaluate={() => void evaluateCriterion(criterion)}
            />
          );
        })}
      </div>

      <HumanReviewPanel
        run={reviewRun.run}
        title="Approve, override, or rerun criterion verdicts"
        compact
        onRerun={async () => {
          await evaluateAll(criteria);
        }}
      />
    </div>
  );
}
