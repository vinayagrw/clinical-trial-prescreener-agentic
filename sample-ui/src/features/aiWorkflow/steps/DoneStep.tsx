/*
 * DoneStep — final step summary + deep-links.
 *
 * Shows the summary of the full run (criteria count, verdict breakdown,
 * earliest enrollment date, safety event count) and points the user at
 * the /safety dashboard and /review workbench for follow-up.
 */

import { Link } from "react-router-dom";
import { useAiDecompositionStore } from "../../../stores/aiDecomposition";
import { useAiEvaluationStore } from "../../../stores/aiEvaluation";
import { useAiTemporalStore } from "../../../stores/aiTemporal";
import { useSafetyEventsStore } from "../../../lib/safety/safetyEvents";
import { useAiPipelineStore } from "../../../stores/aiPipeline";
import { StepShell } from "./StepShell";

export function DoneStep() {
  const criteria = useAiDecompositionStore((s) => s.view?.criteria ?? []);
  const rows = useAiEvaluationStore((s) => s.rows);
  const temporal = useAiTemporalStore((s) => s.run);
  const safetyEvents = useSafetyEventsStore((s) => s.events);
  const reset = useAiPipelineStore((s) => s.reset);

  const statuses = criteria.map((c) => rows[c.id]?.verdict?.status ?? "uncertain");
  const pass = statuses.filter((s) => s === "pass").length;
  const fail = statuses.filter((s) => s === "fail").length;
  const review = statuses.filter(
    (s) => s === "manual_review" || s === "uncertain",
  ).length;

  return (
    <StepShell step="done" runLabel="Mark complete">
      <div className="aif-done-step">
        <div className="aif-done-step__grid">
          <div className="aif-done-tile">
            <span className="aif-done-tile__label">Criteria decomposed</span>
            <span className="aif-done-tile__value">{criteria.length}</span>
            <span className="aif-done-tile__hint">F1 output</span>
          </div>
          <div className="aif-done-tile">
            <span className="aif-done-tile__label">Verdicts</span>
            <span className="aif-done-tile__value">
              {pass}/{fail}/{review}
            </span>
            <span className="aif-done-tile__hint">pass / fail / review</span>
          </div>
          <div className="aif-done-tile">
            <span className="aif-done-tile__label">Earliest enrollment</span>
            <span className="aif-done-tile__value">
              {temporal?.decision.earliestEnrollmentDate ?? "—"}
            </span>
            <span className="aif-done-tile__hint">F4 decision</span>
          </div>
          <div className="aif-done-tile">
            <span className="aif-done-tile__label">Safety events</span>
            <span className="aif-done-tile__value">{safetyEvents.length}</span>
            <span className="aif-done-tile__hint">
              {safetyEvents.filter((e) => e.severity === "block").length} block ·{" "}
              {safetyEvents.filter((e) => e.severity === "warn").length} warn
            </span>
          </div>
        </div>
        <div className="aif-done-step__links">
          <Link to="/safety" className="aif-btn-primary">
            Open Safety Dashboard
          </Link>
          <Link to="/review/match-001" className="aif-btn-ghost">
            Open Review Workbench (match-001)
          </Link>
          <button type="button" className="aif-btn-ghost" onClick={() => reset()}>
            Reset pipeline
          </button>
        </div>
      </div>
    </StepShell>
  );
}
