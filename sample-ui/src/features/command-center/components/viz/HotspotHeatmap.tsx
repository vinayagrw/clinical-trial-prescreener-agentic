/*
 * HotspotHeatmap (V2) — replaces the 4-column text table in
 * src/pages/CommandCenterPage.tsx:94-110.
 *
 * The original rendered uncertain rate / override rate as text strings which
 * hid the relationship between the two signals. Encoding them as a heatmap
 * surfaces that relationship instantly: the darker the cell, the hotter the
 * family on that measure.
 *
 * Parses the incoming HeatmapRow percentage strings ("18%", "N/A") into a
 * normalized 0..1 scale for the ordinal color ramp. The original string is
 * preserved as the display label so the cell reads "18%" not "0.18".
 */

import { useMemo } from "react";
import type { HeatmapRow } from "../../../../types";
import { VizFrame } from "../../../../components/viz/VizFrame";
import { Heatmap, type HeatmapCell } from "../../../../components/viz/primitives/Heatmap";

interface HotspotHeatmapProps {
  rows: readonly HeatmapRow[];
  onCellClick?: (family: string, measure: string) => void;
  embedded?: boolean;
}

interface FallbackRow extends Record<string, unknown> {
  family: string;
  uncertain: string;
  override: string;
  hotspot: string;
}

const MEASURES = ["Uncertain rate", "Override rate"] as const;

/** Parse "18%" → 0.18; "N/A" → 0. */
function parsePct(raw: string): number {
  if (!raw || raw === "N/A") return 0;
  const match = raw.match(/([\d.]+)/);
  if (!match) return 0;
  const n = Number.parseFloat(match[1]);
  if (Number.isNaN(n)) return 0;
  return Math.min(Math.max(n / 100, 0), 1);
}

export function HotspotHeatmap({
  rows,
  onCellClick,
  embedded = false
}: HotspotHeatmapProps) {
  const cells = useMemo<HeatmapCell[]>(() => {
    const out: HeatmapCell[] = [];
    for (const row of rows) {
      out.push({
        rowKey: row.family,
        colKey: MEASURES[0],
        value: parsePct(row.uncertainRate),
        displayValue: row.uncertainRate,
        note: row.hotspot
      });
      out.push({
        rowKey: row.family,
        colKey: MEASURES[1],
        value: parsePct(row.overrideRate),
        displayValue: row.overrideRate,
        note: row.hotspot
      });
    }
    return out;
  }, [rows]);

  const rowKeys = useMemo(() => rows.map((r) => r.family), [rows]);

  const fallbackRows = useMemo<FallbackRow[]>(
    () =>
      rows.map((row) => ({
        family: row.family,
        uncertain: row.uncertainRate,
        override: row.overrideRate,
        hotspot: row.hotspot
      })),
    [rows]
  );

  return (
    <section className={`surface ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Criterion hotspots</p>
          <h3>Where uncertainty and override meet</h3>
        </div>
      </div>

      <VizFrame<FallbackRow>
        label="Criterion family hotspot heatmap"
        description="Each row is a criterion family. Darker cells indicate higher uncertain-rate or override-rate. Click a cell to filter the override cluster panel."
        data={fallbackRows}
        columns={[
          { key: "family", header: "Family" },
          { key: "uncertain", header: "Uncertain rate" },
          { key: "override", header: "Override rate" },
          { key: "hotspot", header: "Primary hotspot" }
        ]}
        minHeight={Math.max(160, rowKeys.length * 44 + 48)}
      >
        {({ width, height }) => (
          <Heatmap
            rows={rowKeys}
            columns={MEASURES as unknown as readonly string[]}
            cells={cells}
            width={width}
            height={height}
            onActivate={(cell) => onCellClick?.(cell.rowKey, cell.colKey)}
          />
        )}
      </VizFrame>
    </section>
  );
}
