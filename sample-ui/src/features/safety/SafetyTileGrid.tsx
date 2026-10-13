/*
 * SafetyTileGrid — 10-mode overview tiles for /safety.
 *
 * One tile per `SafetyMode` from `21-ai-safety-and-success-model.md §3`.
 * Each tile shows:
 *   - current count (from `useSafetyEventsStore.counts`)
 *   - latest event timestamp + severity
 *   - a 20-event sparkline (vertical bars) colored by severity
 *   - a block/warn/info tally under the sparkline
 *
 * The grid is a pure consumer of the events store — no effects, no timers.
 */

import { useMemo } from "react";
import {
  useSafetyEventsStore,
  type SafetyEvent,
  type SafetyMode,
  type SafetySeverity,
} from "../../lib/safety/safetyEvents";

interface ModeMeta {
  mode: SafetyMode;
  label: string;
  blurb: string;
}

const MODE_META: ModeMeta[] = [
  {
    mode: "schema_validation",
    label: "Schema validation",
    blurb: "Structured outputs parsed against Zod shapes.",
  },
  {
    mode: "prompt_injection",
    label: "Prompt injection",
    blurb: "Pre-flight sanitizer on protocol + agent input.",
  },
  {
    mode: "citation_missing",
    label: "Citation missing",
    blurb: "Verdicts without an evidence citation → manual review.",
  },
  {
    mode: "bias_to_uncertain",
    label: "Bias to uncertain",
    blurb: "Reasoning cites evidence not in the citations array.",
  },
  {
    mode: "contradiction",
    label: "Contradiction",
    blurb: "Numeric claims in reasoning contradict threshold comparison.",
  },
  {
    mode: "negation",
    label: "Negation inversion",
    blurb: "Verdict inverts the negation polarity of its citation.",
  },
  {
    mode: "contraindication",
    label: "Contraindication",
    blurb: "Pregnancy / drug / condition hard blocks.",
  },
  {
    mode: "biomarker_ontology",
    label: "Biomarker ontology",
    blurb: "HER2 / HER-2/neu / erbb2 → canonical HGNC code.",
  },
  {
    mode: "override_audit",
    label: "Override audit",
    blurb: "Coordinator overrides logged with before / after diff.",
  },
  {
    mode: "model_regression",
    label: "Model regression",
    blurb: "Drift between consecutive runs of the same input.",
  },
  {
    mode: "citation_content",
    label: "Citation content",
    blurb: "Verifies cited excerpts match source evidence via token overlap.",
  },
];

const SEVERITY_CLASS: Record<SafetySeverity, string> = {
  info: "safety-tile-bar--info",
  warn: "safety-tile-bar--warn",
  block: "safety-tile-bar--block",
};

function severityTone(event: SafetyEvent | undefined): string {
  if (!event) return "safety-tile--idle";
  return `safety-tile--${event.severity}`;
}

function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SafetyTileGrid() {
  const events = useSafetyEventsStore((s) => s.events);
  const counts = useSafetyEventsStore((s) => s.counts);

  const grouped = useMemo(() => {
    const map: Record<SafetyMode, SafetyEvent[]> = {
      schema_validation: [],
      prompt_injection: [],
      citation_missing: [],
      bias_to_uncertain: [],
      contradiction: [],
      negation: [],
      contraindication: [],
      biomarker_ontology: [],
      override_audit: [],
      model_regression: [],
      citation_content: [],
      temporal_arithmetic: [],
      cross_criterion_consistency: [],
      recommendation_consistency: [],
      fitscore_consistency: [],
    };
    for (const ev of events) {
      map[ev.mode].push(ev);
    }
    return map;
  }, [events]);

  return (
    <section
      className="safety-grid"
      aria-label="Safety failure-mode tiles"
    >
      {MODE_META.map((meta) => {
        const modeEvents = grouped[meta.mode];
        const latest = modeEvents[0];
        const sparkline = modeEvents.slice(0, 20).slice().reverse();
        const warn = modeEvents.filter((e) => e.severity === "warn").length;
        const block = modeEvents.filter((e) => e.severity === "block").length;
        const info = modeEvents.filter((e) => e.severity === "info").length;
        return (
          <article
            key={meta.mode}
            className={`safety-tile ${severityTone(latest)}`}
          >
            <header className="safety-tile__head">
              <span className="safety-tile__label">{meta.label}</span>
              <span className="safety-tile__count">{counts[meta.mode]}</span>
            </header>
            <p className="safety-tile__blurb">{meta.blurb}</p>
            <div className="safety-tile__sparkline" aria-hidden="true">
              {sparkline.length === 0 ? (
                <span className="safety-tile__sparkline-empty">no events yet</span>
              ) : (
                sparkline.map((ev) => (
                  <span
                    key={ev.id}
                    className={`safety-tile-bar ${SEVERITY_CLASS[ev.severity]}`}
                    title={`${ev.feature} · ${ev.severity}`}
                  />
                ))
              )}
            </div>
            <footer className="safety-tile__foot">
              <span className="safety-tile__tally">
                <span className="safety-tile__tally-dot safety-tile__tally-dot--block" />
                {block} block
              </span>
              <span className="safety-tile__tally">
                <span className="safety-tile__tally-dot safety-tile__tally-dot--warn" />
                {warn} warn
              </span>
              <span className="safety-tile__tally">
                <span className="safety-tile__tally-dot safety-tile__tally-dot--info" />
                {info} info
              </span>
              <span className="safety-tile__latest">
                last {formatTimestamp(latest?.timestamp)}
              </span>
            </footer>
          </article>
        );
      })}
    </section>
  );
}
