/*
 * FunnelPerformance (V1) — replaces the distorted trapezoid funnel grid
 * in src/pages/CommandCenterPage.tsx:71-83.
 *
 * Pipes FunnelMetric[] through the FunnelBar primitive and wraps it with
 * VizFrame so it inherits: measured size, skeleton/empty/error states,
 * sr-only table fallback, <480px visible fallback, and aria labeling.
 *
 * Click on a stage triggers the consumer's `onStageClick` so the ops lead
 * can drill into a funnel stage (e.g. "why did we lose 45 between screened
 * and reviewed?").
 */

import { useMemo } from "react";
import type { FunnelMetric } from "../../../../types";
import { VizFrame } from "../../../../components/viz/VizFrame";
import { FunnelBar, type FunnelBarDatum } from "../../../../components/viz/primitives/FunnelBar";

interface FunnelPerformanceProps {
  funnel: readonly FunnelMetric[];
  recoveredCapacity?: string;
  onStageClick?: (stageLabel: string, value: number) => void;
}

interface FallbackRow extends Record<string, unknown> {
  stage: string;
  value: number;
  dropoff: string;
}

export function FunnelPerformance({
  funnel,
  recoveredCapacity,
  onStageClick
}: FunnelPerformanceProps) {
  const data = useMemo<FunnelBarDatum[]>(
    () =>
      funnel.map((stage, index) => ({
        id: `${stage.label}-${index}`,
        label: stage.label,
        value: stage.value,
        tone: stage.tone
      })),
    [funnel]
  );

  const fallbackRows = useMemo<FallbackRow[]>(() => {
    return funnel.map((stage, index) => {
      const prev = index > 0 ? funnel[index - 1] : null;
      const dropoff =
        prev && prev.value > 0
          ? `${(((prev.value - stage.value) / prev.value) * 100).toFixed(0)}%`
          : "—";
      return {
        stage: stage.label,
        value: stage.value,
        dropoff
      };
    });
  }, [funnel]);

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Enrollment funnel</p>
          <h3>Honest conversion view</h3>
        </div>
        {recoveredCapacity ? (
          <span className="eyebrow-label">{recoveredCapacity}</span>
        ) : null}
      </div>

      <VizFrame<FallbackRow>
        label="Enrollment funnel performance"
        description="Horizontal bars encode the raw count at each stage. Drop-off annotations show the percentage lost between consecutive stages."
        data={fallbackRows}
        columns={[
          { key: "stage", header: "Stage" },
          { key: "value", header: "Count" },
          { key: "dropoff", header: "Drop-off" }
        ]}
        minHeight={Math.max(80, funnel.length * 42 + 40)}
      >
        {({ width, height }) => (
          <FunnelBar
            data={data}
            width={width}
            height={height}
            onActivate={(datum) => onStageClick?.(datum.label, datum.value)}
          />
        )}
      </VizFrame>
    </section>
  );
}
