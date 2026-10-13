/*
 * OvernightDeltaSlope (V5) — replaces the text "Changed overnight: N cases"
 * metric on CockpitPage with a slope chart that answers the coordinator's
 * actual first question: "which cases got worse or better since I last looked?"
 *
 * Each line is one match; y-axis is fit score; left = yesterday, right = today.
 * Up-slopes are painted as pass-color (good news), down-slopes as fail-color
 * (new blocker), flat as manual-color (no meaningful movement).
 *
 * Click/Enter a line activates the consumer's callback so the coordinator
 * can jump straight into the review workbench for that case.
 */

import { useMemo } from "react";
import type { OvernightChange } from "../../../../data/mockData";
import { VizFrame } from "../../../../components/viz/VizFrame";
import { SlopeChart, type SlopeDatum } from "../../../../components/viz/primitives/SlopeChart";

interface OvernightDeltaSlopeProps {
  changes: readonly OvernightChange[];
  onCaseClick?: (matchId: string) => void;
}

interface FallbackRow extends Record<string, unknown> {
  match: string;
  before: number;
  after: number;
  delta: string;
  reason: string;
}

export function OvernightDeltaSlope({
  changes,
  onCaseClick
}: OvernightDeltaSlopeProps) {
  const data = useMemo<SlopeDatum[]>(
    () =>
      changes.map((c) => ({
        id: c.matchId,
        label: c.label,
        before: c.before,
        after: c.after,
        reason: c.reason
      })),
    [changes]
  );

  const fallbackRows = useMemo<FallbackRow[]>(
    () =>
      changes.map((c) => {
        const delta = c.after - c.before;
        return {
          match: c.label,
          before: c.before,
          after: c.after,
          delta: delta > 0 ? `+${delta}` : String(delta),
          reason: c.reason
        };
      }),
    [changes]
  );

  const up = changes.filter((c) => c.after - c.before >= 0.5).length;
  const down = changes.filter((c) => c.after - c.before <= -0.5).length;

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Overnight delta</p>
          <h3>
            {up} improved, {down} regressed
          </h3>
        </div>
        <span className="eyebrow-label">Fit score · yesterday vs today</span>
      </div>

      <VizFrame<FallbackRow>
        label="Overnight case-by-case delta slope chart"
        description="One line per case from yesterday's score to today's. Up-sloping lines are improvements; down-sloping lines are regressions. Hover or focus a line to read the reason."
        data={fallbackRows}
        columns={[
          { key: "match", header: "Case" },
          { key: "before", header: "Yesterday" },
          { key: "after", header: "Today" },
          { key: "delta", header: "Delta" },
          { key: "reason", header: "Why" }
        ]}
        minHeight={Math.max(180, changes.length * 28 + 80)}
      >
        {({ width, height }) => (
          <SlopeChart
            data={data}
            width={width}
            height={height}
            onActivate={(datum) => onCaseClick?.(datum.id)}
          />
        )}
      </VizFrame>
    </section>
  );
}
