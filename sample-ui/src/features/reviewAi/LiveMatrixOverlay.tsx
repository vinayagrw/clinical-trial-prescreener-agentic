/*
 * LiveMatrixOverlay — F3 criterion verdict overlay for the Review Workbench.
 *
 * Reads `useAiEvaluationStore` (populated by either P5 pipeline runs or this
 * component's own "Run all" button) and derives a compact matrix of live
 * verdicts against the criteria from `useAiDecompositionStore`. When AI Live
 * is ON, this appears alongside the existing static criterion matrix so the
 * reviewer can compare the AI's current verdicts against the hand-written
 * assessments without touching the default read-only path.
 *
 * The overlay is deliberately thin: every heavy piece of rendering (reasoning
 * text, citations, uncertainty reason) already lives in the shared types, so
 * this component just lays them out in a table.
 */

import { useAiDecompositionStore } from "../../stores/aiDecomposition";
import { useAiEvaluationStore } from "../../stores/aiEvaluation";
import { recordOverride } from "../../lib/safety/overrideAudit";
import type { CriterionMatrixEntry } from "../../types/aiFeatures";

function statusClass(status: CriterionMatrixEntry["status"]): string {
  return `review-ai-overlay__status review-ai-overlay__status--${status}`;
}

function freshnessClass(freshness: CriterionMatrixEntry["freshness"]): string {
  return `review-ai-overlay__fresh review-ai-overlay__fresh--${freshness}`;
}

export function LiveMatrixOverlay() {
  const criteria = useAiDecompositionStore((s) => s.view?.criteria ?? []);
  const evalStatus = useAiEvaluationStore((s) => s.status);
  const evaluateAll = useAiEvaluationStore((s) => s.evaluateAll);
  const getEntries = useAiEvaluationStore((s) => s.getEntries);

  const running = evalStatus === "running";
  const entries = getEntries(criteria);

  function handleForceOverride(entry: CriterionMatrixEntry) {
    recordOverride({
      feature: "F3",
      subjectId: `criterion:${entry.id.replace(/^eval-/, "")}`,
      beforeValue: { status: entry.status, reasoning: entry.reasoning },
      afterValue: { status: "pass" as const },
      reason: "Manual coordinator override from Review Workbench AI Live overlay.",
      actor: "coordinator:reviewer",
    });
  }

  return (
    <section className="review-ai-overlay" aria-label="AI Live: F3 verdict overlay">
      <header className="review-ai-overlay__head">
        <div>
          <span className="review-ai-overlay__eyebrow">F3 · Live verdict overlay</span>
          <h3>Criterion evaluation (live)</h3>
          <p className="review-ai-overlay__sub">
            Live verdicts from <code>useAiEvaluationStore</code>, routed through the F3
            safety guard stack (schema → citations → bias → contradiction → negation →
            contraindication → regression). Override propagates to{" "}
            <code>/safety</code> as an audit event.
          </p>
        </div>
        <button
          type="button"
          className="review-ai-overlay__run"
          onClick={() => void evaluateAll(criteria)}
          disabled={running || criteria.length === 0}
        >
          {running
            ? "Evaluating…"
            : criteria.length === 0
              ? "Run F1 first"
              : "Re-run every criterion"}
        </button>
      </header>

      {criteria.length === 0 ? (
        <p className="review-ai-overlay__empty">
          No decomposition is loaded. Run the F1 decomposition panel first, then
          re-run this overlay.
        </p>
      ) : (
        <div className="review-ai-overlay__table-wrap">
          <table className="review-ai-overlay__table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Criterion</th>
                <th>Reasoning</th>
                <th>Citations</th>
                <th>Fresh</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span className={statusClass(entry.status)}>
                      {entry.status.replace(/_/g, " ")}
                    </span>
                    {entry.uncertaintyReason ? (
                      <span className="review-ai-overlay__reason">
                        {entry.uncertaintyReason.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <strong>{entry.label}</strong>
                    <div className="review-ai-overlay__threshold">
                      {entry.thresholdLabel}
                    </div>
                  </td>
                  <td className="review-ai-overlay__reasoning">{entry.reasoning}</td>
                  <td>
                    {entry.citations.length === 0 ? (
                      <span className="review-ai-overlay__no-citations">none</span>
                    ) : (
                      <ul className="review-ai-overlay__citations">
                        {entry.citations.map((c) => (
                          <li key={c.evidenceId}>
                            <code>{c.evidenceId}</code> · {c.source}{" "}
                            <em>{c.sourceDate}</em>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    <span className={freshnessClass(entry.freshness)}>
                      {entry.freshness}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="review-ai-overlay__override"
                      onClick={() => handleForceOverride(entry)}
                      title="Record a forced-pass override in the safety audit log"
                    >
                      override → pass
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
