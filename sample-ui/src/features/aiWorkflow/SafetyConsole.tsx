/*
 * SafetyConsole — right-rail live feed of the most recent safety events.
 *
 * Reads straight from `useSafetyEventsStore`, the same store every
 * `SafetyCheck` writes to via `logSafetyEvent(...)`. Events stream in as
 * the pipeline runs, color-coded by severity, with mode + feature chips.
 * The full dashboard lives on `/safety` (P6) — this is the compact
 * in-pipeline view that coordinators see while the workflow is executing.
 */

import {
  useSafetyEventsStore,
  type SafetyEvent,
  type SafetyMode,
} from "../../lib/safety/safetyEvents";

const MODE_SHORT: Record<SafetyMode, string> = {
  schema_validation: "schema",
  prompt_injection: "injection",
  citation_missing: "citation",
  bias_to_uncertain: "bias",
  contradiction: "contradict",
  negation: "negation",
  contraindication: "contra",
  biomarker_ontology: "ontology",
  override_audit: "override",
  model_regression: "regression",
  citation_content: "cite-content",
  temporal_arithmetic: "temporal",
  cross_criterion_consistency: "x-criterion",
  recommendation_consistency: "recommend",
  fitscore_consistency: "fitscore",
};

function severityTone(sev: SafetyEvent["severity"]): string {
  if (sev === "block") return "bad";
  if (sev === "warn") return "warn";
  return "ok";
}

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 1_000) return "now";
  if (delta < 60_000) return `${Math.round(delta / 1_000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  return `${Math.round(delta / 3_600_000)}h ago`;
}

export function SafetyConsole() {
  const events = useSafetyEventsStore((s) => s.events);
  const counts = useSafetyEventsStore((s) => s.counts);
  const clear = useSafetyEventsStore((s) => s.clear);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const blockCount = events.filter((e) => e.severity === "block").length;
  const warnCount = events.filter((e) => e.severity === "warn").length;

  return (
    <section className="aif-safety-console" aria-label="Safety event feed">
      <header className="aif-safety-console__head">
        <div>
          <span className="aif-safety-console__eyebrow">Safety console</span>
          <h3>Live events</h3>
        </div>
        <button
          type="button"
          className="aif-btn-ghost aif-btn-ghost--tight"
          onClick={() => clear()}
          disabled={events.length === 0}
        >
          Clear
        </button>
      </header>
      <div className="aif-safety-console__summary">
        <span className="aif-safety-metric">
          <strong>{total}</strong> total
        </span>
        <span className="aif-safety-metric aif-safety-metric--warn">
          <strong>{warnCount}</strong> warn
        </span>
        <span className="aif-safety-metric aif-safety-metric--bad">
          <strong>{blockCount}</strong> block
        </span>
      </div>
      <ul className="aif-safety-feed" role="list">
        {events.length === 0 ? (
          <li className="aif-safety-feed__empty">
            No events yet. Run a step to see schema / citation / ontology
            checks stream in.
          </li>
        ) : (
          events.slice(0, 40).map((ev) => (
            <li
              key={ev.id}
              className={`aif-safety-event aif-safety-event--${severityTone(ev.severity)}`}
            >
              <div className="aif-safety-event__head">
                <span className="aif-safety-event__feature">{ev.feature}</span>
                <span className="aif-safety-event__mode">{MODE_SHORT[ev.mode]}</span>
                <span className="aif-safety-event__time">{timeAgo(ev.timestamp)}</span>
              </div>
              <p className="aif-safety-event__message">{ev.message}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
