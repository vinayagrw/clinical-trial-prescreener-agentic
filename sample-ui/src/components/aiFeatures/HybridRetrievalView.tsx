/*
 * F2 — Hybrid Semantic Evidence Retrieval (P2 live version).
 *
 * Drives off `useAiRetrievalStore` which runs the real BM25 + embedding
 * + rerank pipeline from `lib/retrieval/hybrid.ts`. A criterion selector
 * lets the pitch team switch between canned queries (ANC, Creatinine,
 * EGFR L858R, etc.) and watch the result list recompute live.
 *
 * The same component still renders the query panel, keyword/concept chips,
 * score bars, and freshness-gate pill — only the data source changed.
 */

import { useEffect } from "react";
import { HumanReviewPanel } from "../HumanReviewPanel";
import { getEffectiveReviewOutput, useAiReviewRunSync } from "../../lib/reviews";
import type { RetrievalResult } from "../../types/aiFeatures";
import {
  RETRIEVAL_CRITERIA,
  useAiRetrievalStore,
} from "../../stores/aiRetrieval";

function ScoreBar({
  label,
  value,
  fillClass,
}: {
  label: string;
  value: number;
  fillClass: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="aif-retr-score-row">
      <span className="aif-retr-score-label">{label}</span>
      <span className="aif-retr-bar">
        <span
          className={`aif-retr-bar-fill ${fillClass}`}
          style={{ width: `${(clamped * 100).toFixed(1)}%` }}
        />
      </span>
      <span className="aif-retr-score-val">{value.toFixed(2)}</span>
    </div>
  );
}

function RetrievalResultCard({ result }: { result: RetrievalResult }) {
  return (
    <article className="aif-retr-result">
      <header className="aif-retr-result-head">
        <span className="aif-retr-rank">#{result.rank}</span>
        <div className="aif-retr-source">
          <span className="aif-retr-source-title">{result.source}</span>
          <span className="aif-retr-source-meta">
            {result.sourceSystem} • {result.author} • {result.sourceDate}
          </span>
        </div>
        <span
          className={`aif-retr-gate ${
            result.passesFreshnessGate ? "aif-retr-gate-pass" : "aif-retr-gate-fail"
          }`}
        >
          {result.passesFreshnessGate ? "fresh" : "stale / out-of-window"}
        </span>
      </header>

      <p className="aif-retr-excerpt">{result.excerpt}</p>

      <div className="aif-retr-scores">
        <ScoreBar label="Final" value={result.finalScore} fillClass="aif-retr-bar-fill-final" />
        <ScoreBar label="BM25" value={result.bm25Score} fillClass="aif-retr-bar-fill-bm25" />
        <ScoreBar
          label="Embedding"
          value={result.embeddingScore}
          fillClass="aif-retr-bar-fill-emb"
        />
        <ScoreBar
          label="Reranker"
          value={result.rerankerScore}
          fillClass="aif-retr-bar-fill-rerank"
        />
      </div>
    </article>
  );
}

export function HybridRetrievalView() {
  const {
    status,
    run,
    error,
    selectedCriterionId,
    runRetrieval,
    setSelectedCriterion,
  } = useAiRetrievalStore();

  // Kick an initial run on first mount so the view doesn't start empty.
  useEffect(() => {
    if (!run && status === "idle") {
      void runRetrieval();
    }
  }, [run, status, runRetrieval]);

  const reviewRun = useAiReviewRunSync(
    run
      ? {
          sourceKey: `ai-features:f2:${run.query.criterionId}`,
          featureKey: "F2_hybrid_retrieval",
          featureLabel: "F2 Hybrid retrieval",
          stageKey: "retrieval",
          workspace: "ai_features",
          entityType: "criterion_evidence_query",
          entityId: run.query.criterionId,
          entityLabel: run.query.criterionLabel,
          deepLink: "/ai-features",
          summary: `Ranked ${run.results.length} evidence hits for ${run.query.criterionLabel}.`,
          promptSnapshot: {
            criterionId: run.query.criterionId,
            criterionLabel: run.query.criterionLabel,
          },
          inputSnapshot: run.query,
          outputSnapshot: run,
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
          citations: run.results.map((result) => ({
            id: result.id,
            label: `${result.source} · ${result.sourceDate}`,
            detail: `Final ${result.finalScore.toFixed(2)} | ${result.sourceSystem}`,
            quote: result.excerpt,
            tone: result.passesFreshnessGate ? "supporting" : "warning",
          })),
          safetyFlags: [
            ...(run.results.length === 0
              ? [
                  {
                    id: "retrieval-empty",
                    label: "No evidence retrieved",
                    detail: "A reviewer should confirm the query terms or broaden the search before downstream evaluation continues.",
                    severity: "warning" as const,
                  },
                ]
              : []),
            ...run.results
              .filter((result) => !result.passesFreshnessGate)
              .map((result) => ({
                id: `stale-${result.id}`,
                label: "Freshness gate failed",
                detail: `${result.source} is outside the freshness window and should be explicitly accepted or removed by a reviewer.`,
                severity: "warning" as const,
              })),
          ],
        }
      : null,
  );
  const displayRun = getEffectiveReviewOutput(reviewRun.run, run);
  const query = displayRun?.query;
  const isRunning = status === "running";

  return (
    <div className="aif-retr">
      <div className="aif-retr-controls">
        <label className="aif-label" htmlFor="aif-retr-criterion">
          Criterion
        </label>
        <select
          id="aif-retr-criterion"
          className="aif-retr-select"
          value={selectedCriterionId}
          onChange={(e) => {
            setSelectedCriterion(e.target.value);
            void runRetrieval(e.target.value);
          }}
          disabled={isRunning}
        >
          {RETRIEVAL_CRITERIA.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="aif-btn aif-btn-primary"
          onClick={() => void runRetrieval()}
          disabled={isRunning}
        >
          {isRunning ? "Running…" : "Run retrieval"}
        </button>
      </div>

      {query && (
        <div className="aif-retr-query">
          <div className="aif-retr-query-head">
            <span className="aif-retr-query-title">
              Query · {query.criterionLabel} ({query.criterionId})
            </span>
          </div>

          <div className="aif-retr-terms-row">
            <span className="aif-label">Keyword terms</span>
            {query.keywordTerms.map((term) => (
              <span key={term} className="aif-retr-term">
                {term}
              </span>
            ))}
          </div>

          <div className="aif-retr-terms-row">
            <span className="aif-label">Expanded concepts</span>
            {query.expandedConcepts.map((concept) => (
              <span key={concept} className="aif-retr-term aif-retr-term-concept">
                {concept}
              </span>
            ))}
          </div>

          <div className="aif-retr-meta">
            <span>
              Hybrid weights: <strong>BM25 {query.hybridWeights.bm25.toFixed(2)}</strong>
              {" / "}
              <strong>Embedding {query.hybridWeights.embedding.toFixed(2)}</strong>
            </span>
            <span>
              Wall time: <strong>{displayRun?.wallTimeMs ?? "–"} ms</strong>
            </span>
            <span>
              Corpus: <strong>{displayRun?.corpusSizeNotes ?? "–"} notes</strong>
            </span>
            <span>
              Patient: <strong>{displayRun?.patientId ?? "–"}</strong>
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="aif-retr-error">
          Retrieval failed: {error}
        </div>
      )}

      {displayRun && displayRun.results.length > 0 && (
        <>
          <p className="aif-section-subhead">
            Top {displayRun.results.length} results (post-rerank)
          </p>
          <div className="aif-retr-list">
            {displayRun.results.map((result) => (
              <RetrievalResultCard key={result.id} result={result} />
            ))}
          </div>
        </>
      )}

      {!isRunning && displayRun && displayRun.results.length === 0 && (
        <p className="aif-retr-empty">
          No matching evidence in the corpus for this query. Try a different criterion.
        </p>
      )}

      {displayRun ? (
        <HumanReviewPanel
          run={reviewRun.run}
          title="Review evidence before criterion evaluation"
          compact
          onRerun={async (editedInput) => {
            const next =
              typeof editedInput === "object" &&
              editedInput &&
              "criterionId" in editedInput &&
              typeof (editedInput as { criterionId?: unknown }).criterionId === "string"
                ? (editedInput as { criterionId: string }).criterionId
                : selectedCriterionId;
            setSelectedCriterion(next);
            await runRetrieval(next);
          }}
        />
      ) : null}
    </div>
  );
}
