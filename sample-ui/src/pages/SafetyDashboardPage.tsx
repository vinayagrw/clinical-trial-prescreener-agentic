/*
 * SafetyDashboardPage — full-page `/safety` wrapper.
 *
 * Layout:
 *   [ hero + run-fixtures button  ]
 *   [ SafetyTileGrid (10 tiles)    ]
 *   [ two-column grid:             ]
 *   [   event feed | override + regression ]
 *
 * Every panel is a pure consumer of `useSafetyEventsStore`; the dashboard
 * itself owns no state beyond what the child components track locally
 * (filters, drawer selection, expand-row).
 *
 * Pair with `/ai-features`: every pipeline run writes to the same store,
 * so navigating from the stepper to this page preserves the full event
 * log across route changes (in-memory only — refresh clears it).
 */

import { AppShell } from "../components/AppShell";
import { SafetyTileGrid } from "../features/safety/SafetyTileGrid";
import { SafetyEventFeed } from "../features/safety/SafetyEventFeed";
import { OverrideAuditTable } from "../features/safety/OverrideAuditTable";
import { ModelRegressionPanel } from "../features/safety/ModelRegressionPanel";
import { RunFixturesButton } from "../features/safety/RunFixturesButton";
import { useSafetyEventsStore } from "../lib/safety/safetyEvents";

export function SafetyDashboardPage() {
  const totalEvents = useSafetyEventsStore((s) => s.events.length);
  const counts = useSafetyEventsStore((s) => s.counts);
  const blockCount = useSafetyEventsStore(
    (s) => s.events.filter((e) => e.severity === "block").length,
  );
  const warnCount = useSafetyEventsStore(
    (s) => s.events.filter((e) => e.severity === "warn").length,
  );
  const overrideCount = counts.override_audit;

  return (
    <AppShell
      title="Patient Safety — 10-mode guard dashboard"
      subtitle="Every AI output routes through a pluggable safety pipeline covering schema validation, prompt injection, missing citations, bias to uncertain, contradiction, negation, contraindication, biomarker ontology, override audit, and model regression."
    >
      <div className="safety-page">
        <section className="safety-hero">
          <div className="safety-hero__head">
            <div>
              <h2>Patient Safety live feed</h2>
              <p className="safety-hero__lede">
                The dashboard reads from the same in-memory event store that the
                <code>/ai-features</code> pipeline writes to. Every time a guard check fires
                on the F1 / F3 / F5 path, it appends an event here with the feature, mode,
                severity, full message, and any mutation the check made to the AI output
                (e.g. demoting a pass to <code>manual_review</code>). The fixture deck lets
                you exercise every check end-to-end without touching the pipeline.
              </p>
            </div>
            <div className="safety-hero__kpis">
              <div className="safety-kpi">
                <span className="safety-kpi__label">Events</span>
                <span className="safety-kpi__value">{totalEvents}</span>
              </div>
              <div className="safety-kpi safety-kpi--block">
                <span className="safety-kpi__label">Block</span>
                <span className="safety-kpi__value">{blockCount}</span>
              </div>
              <div className="safety-kpi safety-kpi--warn">
                <span className="safety-kpi__label">Warn</span>
                <span className="safety-kpi__value">{warnCount}</span>
              </div>
              <div className="safety-kpi">
                <span className="safety-kpi__label">Overrides</span>
                <span className="safety-kpi__value">{overrideCount}</span>
              </div>
            </div>
          </div>
        </section>

        <RunFixturesButton />

        <SafetyTileGrid />

        <div className="safety-grid-bottom">
          <div className="safety-grid-bottom__col safety-grid-bottom__col--feed">
            <SafetyEventFeed />
          </div>
          <div className="safety-grid-bottom__col safety-grid-bottom__col--side">
            <OverrideAuditTable />
            <ModelRegressionPanel />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
