/*
 * TrialPortfolioParallel (V8) — replaces the 4-MetricCard quartet in
 * src/pages/CommandCenterPage.tsx that forced the ops lead to chip-toggle
 * through trials one at a time to compare screened / piEscalations /
 * outreachReady / enrolled.
 *
 * Parallel coordinates render every trial simultaneously so outliers pop out
 * ("LU-021 is ahead on screened but lagging on enrolled") without any
 * toggling. The consumer still receives clicks on a trial so the
 * drill-down panel can focus on that trial.
 *
 * Radar was rejected (see 16.2 principle 4): overlapping polygon areas are
 * unreadable. Parallel coordinates scan axis-by-axis instead.
 */

import { useMemo } from "react";
import type { PortfolioStageMetric } from "../../../../types";
import { VizFrame } from "../../../../components/viz/VizFrame";
import {
  ParallelCoordinates,
  type ParallelDimension,
  type ParallelRecord
} from "../../../../components/viz/primitives/ParallelCoordinates";

interface TrialPortfolioParallelProps {
  metrics: readonly PortfolioStageMetric[];
  selectedTrialId?: string;
  onTrialClick?: (trialId: string) => void;
  embedded?: boolean;
}

interface FallbackRow extends Record<string, unknown> {
  trial: string;
  screened: number;
  piEscalations: number;
  outreachReady: number;
  enrolled: number;
  blocker: string;
}

const DIMENSIONS: readonly ParallelDimension[] = [
  { key: "screened", label: "Screened" },
  { key: "piEscalations", label: "PI escalations" },
  { key: "outreachReady", label: "Outreach ready" },
  { key: "enrolled", label: "Enrolled" }
];

export function TrialPortfolioParallel({
  metrics,
  selectedTrialId,
  onTrialClick,
  embedded = false
}: TrialPortfolioParallelProps) {
  const records = useMemo<ParallelRecord[]>(
    () =>
      metrics.map((metric) => ({
        id: metric.trialId,
        label: metric.shortCode,
        sublabel: metric.blocker,
        values: {
          screened: metric.screened,
          piEscalations: metric.piEscalations,
          outreachReady: metric.outreachReady,
          enrolled: metric.enrolled
        }
      })),
    [metrics]
  );

  const fallbackRows = useMemo<FallbackRow[]>(
    () =>
      metrics.map((metric) => ({
        trial: metric.shortCode,
        screened: metric.screened,
        piEscalations: metric.piEscalations,
        outreachReady: metric.outreachReady,
        enrolled: metric.enrolled,
        blocker: metric.blocker
      })),
    [metrics]
  );

  return (
    <section className={`surface ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Trial portfolio</p>
          <h3>Screened → escalated → outreach → enrolled, per trial</h3>
        </div>
      </div>

      <VizFrame<FallbackRow>
        label="Trial portfolio parallel coordinates"
        description="Each line is a trial. Each vertical axis is a stage (screened, PI escalations, outreach-ready, enrolled), normalized to its own range so small and large metrics coexist. Hover or focus a line to highlight the full trajectory."
        data={fallbackRows}
        columns={[
          { key: "trial", header: "Trial" },
          { key: "screened", header: "Screened" },
          { key: "piEscalations", header: "PI escalations" },
          { key: "outreachReady", header: "Outreach ready" },
          { key: "enrolled", header: "Enrolled" },
          { key: "blocker", header: "Primary blocker" }
        ]}
        minHeight={280}
      >
        {({ width, height }) => (
          <ParallelCoordinates
            dimensions={DIMENSIONS}
            records={records}
            width={width}
            height={height}
            selectedId={selectedTrialId}
            onActivate={(record) => onTrialClick?.(record.id)}
          />
        )}
      </VizFrame>
    </section>
  );
}
