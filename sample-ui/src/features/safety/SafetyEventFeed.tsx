/*
 * SafetyEventFeed — filterable reverse-chronological feed of SafetyEvents.
 *
 * Filters:
 *   - feature chips (F1–F5, all)
 *   - severity chips (info / warn / block, all)
 *   - mode dropdown (one of the 10 modes + all)
 *   - free-text search (matches message + mode + feature)
 *
 * Clicking a row opens a right-docked JSON drawer showing the full event
 * detail + mutation diff. Close with Esc or the × button. The drawer lives
 * inside this component because it's strictly a local concern.
 */

import { useMemo, useState } from "react";
import {
  useSafetyEventsStore,
  type SafetyEvent,
  type SafetyFeature,
  type SafetyMode,
  type SafetySeverity,
} from "../../lib/safety/safetyEvents";

type FeatureFilter = SafetyFeature | "all";
type SeverityFilter = SafetySeverity | "all";
type ModeFilter = SafetyMode | "all";

const FEATURE_CHIPS: { value: FeatureFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "F1", label: "F1" },
  { value: "F2", label: "F2" },
  { value: "F3", label: "F3" },
  { value: "F4", label: "F4" },
  { value: "F5", label: "F5" },
];

const SEVERITY_CHIPS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All severities" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "block", label: "Block" },
];

const MODE_OPTIONS: { value: ModeFilter; label: string }[] = [
  { value: "all", label: "All modes" },
  { value: "schema_validation", label: "Schema validation" },
  { value: "prompt_injection", label: "Prompt injection" },
  { value: "citation_missing", label: "Citation missing" },
  { value: "bias_to_uncertain", label: "Bias to uncertain" },
  { value: "contradiction", label: "Contradiction" },
  { value: "negation", label: "Negation" },
  { value: "contraindication", label: "Contraindication" },
  { value: "biomarker_ontology", label: "Biomarker ontology" },
  { value: "override_audit", label: "Override audit" },
  { value: "model_regression", label: "Model regression" },
];

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function safeJsonString(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function SafetyEventFeed() {
  const events = useSafetyEventsStore((s) => s.events);
  const clear = useSafetyEventsStore((s) => s.clear);

  const [featureFilter, setFeatureFilter] = useState<FeatureFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((ev) => {
      if (featureFilter !== "all" && ev.feature !== featureFilter) return false;
      if (severityFilter !== "all" && ev.severity !== severityFilter) return false;
      if (modeFilter !== "all" && ev.mode !== modeFilter) return false;
      if (!q) return true;
      return (
        ev.message.toLowerCase().includes(q) ||
        ev.mode.toLowerCase().includes(q) ||
        ev.feature.toLowerCase().includes(q)
      );
    });
  }, [events, featureFilter, severityFilter, modeFilter, query]);

  const selected = useMemo<SafetyEvent | undefined>(
    () => events.find((ev) => ev.id === selectedId),
    [events, selectedId],
  );

  return (
    <section className="safety-feed" aria-label="Safety event feed">
      <header className="safety-feed__head">
        <div className="safety-feed__title-row">
          <h3>Event feed</h3>
          <span className="safety-feed__count">
            {filtered.length} of {events.length}
          </span>
          <button
            type="button"
            className="safety-feed__clear"
            onClick={() => clear()}
            disabled={events.length === 0}
            title="Clear feed"
          >
            Clear
          </button>
        </div>
        <div className="safety-feed__filters">
          <div className="safety-feed__chip-row" role="group" aria-label="Feature filter">
            {FEATURE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className={`safety-filter-chip${
                  featureFilter === chip.value ? " safety-filter-chip--on" : ""
                }`}
                onClick={() => setFeatureFilter(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="safety-feed__chip-row" role="group" aria-label="Severity filter">
            {SEVERITY_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className={`safety-filter-chip safety-filter-chip--${chip.value}${
                  severityFilter === chip.value ? " safety-filter-chip--on" : ""
                }`}
                onClick={() => setSeverityFilter(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="safety-feed__controls-row">
            <label className="safety-feed__mode-select">
              <span>Mode</span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
              >
                {MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="search"
              className="safety-feed__search"
              placeholder="Search message, mode, feature…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search safety events"
            />
          </div>
        </div>
      </header>
      <ol className="safety-feed__list">
        {filtered.length === 0 ? (
          <li className="safety-feed__empty">
            No events match the current filter. Run the pipeline on /ai-features or click
            "Run safety fixtures" above to generate events.
          </li>
        ) : (
          filtered.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                className={`safety-event-row safety-event-row--${ev.severity}${
                  ev.id === selectedId ? " safety-event-row--selected" : ""
                }`}
                onClick={() => setSelectedId(ev.id === selectedId ? null : ev.id)}
              >
                <span className="safety-event-row__time">{formatTime(ev.timestamp)}</span>
                <span className={`safety-event-row__severity safety-event-row__severity--${ev.severity}`}>
                  {ev.severity}
                </span>
                <span className="safety-event-row__feature">{ev.feature}</span>
                <span className="safety-event-row__mode">{ev.mode.replace(/_/g, " ")}</span>
                <span className="safety-event-row__message">{ev.message}</span>
              </button>
            </li>
          ))
        )}
      </ol>

      {selected ? (
        <div
          className="safety-json-drawer"
          role="dialog"
          aria-label="Safety event detail"
        >
          <header className="safety-json-drawer__head">
            <div>
              <span className="safety-json-drawer__eyebrow">
                {selected.feature} · {selected.mode.replace(/_/g, " ")} · {selected.severity}
              </span>
              <h4>{selected.message}</h4>
              <span className="safety-json-drawer__time">
                {new Date(selected.timestamp).toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              className="safety-json-drawer__close"
              onClick={() => setSelectedId(null)}
              aria-label="Close event detail"
            >
              ×
            </button>
          </header>
          <div className="safety-json-drawer__body">
            {selected.detail ? (
              <section>
                <h5>detail</h5>
                <pre className="safety-json-drawer__json">
                  {safeJsonString(selected.detail)}
                </pre>
              </section>
            ) : null}
            {selected.mutation ? (
              <section>
                <h5>mutation</h5>
                <div className="safety-json-drawer__mutation">
                  <div>
                    <span className="safety-json-drawer__label">before</span>
                    <pre className="safety-json-drawer__json">{selected.mutation.before}</pre>
                  </div>
                  <div>
                    <span className="safety-json-drawer__label">after</span>
                    <pre className="safety-json-drawer__json">{selected.mutation.after}</pre>
                  </div>
                </div>
              </section>
            ) : null}
            {!selected.detail && !selected.mutation ? (
              <p className="safety-json-drawer__empty">
                This event has no structured detail or mutation payload.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
