import React from "react";
import type { HeatmapRow } from "@old/types";

export interface HeatmapGridProps {
  rows: HeatmapRow[];
}

function parseSeverity(value: string): "low" | "medium" | "high" {
  const num = parseInt(value, 10);
  if (isNaN(num) || value === "N/A") return "high";
  if (num < 20) return "low";
  if (num <= 40) return "medium";
  return "high";
}

export function HeatmapGrid({ rows }: HeatmapGridProps) {
  return (
    <div
      className="heatmap-grid"
      style={{ gridTemplateColumns: "120px repeat(3, 1fr)" }}
    >
      {/* Header row */}
      <div className="heatmap-grid__header" />
      <div className="heatmap-grid__header">Uncertain Rate</div>
      <div className="heatmap-grid__header">Override Rate</div>
      <div className="heatmap-grid__header">Hotspot</div>

      {/* Data rows */}
      {rows.map((row) => (
        <React.Fragment key={row.family}>
          <div className="heatmap-grid__row-label">{row.family}</div>
          <div
            className={`heatmap-grid__cell heatmap-grid__cell--${parseSeverity(row.uncertainRate)}`}
          >
            {row.uncertainRate}
          </div>
          <div
            className={`heatmap-grid__cell heatmap-grid__cell--${parseSeverity(row.overrideRate)}`}
          >
            {row.overrideRate}
          </div>
          <div className="heatmap-grid__cell heatmap-grid__cell--low">
            {row.hotspot}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
