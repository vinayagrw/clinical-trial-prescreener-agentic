import React, { useState } from "react";
import { heatmapRows } from "../data/index";
import {
  currentFunnel,
  projectedFunnel,
  projectionKPIs,
  projectionMethodologyBlurb,
} from "../data/projectionMetrics";
import { FilterBar, type FilterBarValue } from "../components/insights/FilterBar";
import { FunnelChart } from "../components/insights/FunnelChart";
import { HeatmapGrid } from "../components/insights/HeatmapGrid";
import { TrialHealthBar } from "../components/insights/TrialHealthBar";
import { VelocitySparklines } from "../components/insights/VelocitySparklines";
import { ProjectionToggle } from "../components/insights/ProjectionToggle";

/** Shared empty-state placeholder for insight widgets that may end up with no data
 *  once filters are applied. Today the mock data never triggers these, but the
 *  defensive guard keeps the page from silently rendering empty charts. */
function InsightsEmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "var(--space-5)",
        textAlign: "center",
        color: "var(--ink-muted)",
        fontSize: "var(--text-small)",
        fontStyle: "italic",
      }}
    >
      {label}
    </div>
  );
}

export default function InsightsPage() {
  const [view, setView] = useState<"current" | "projected">("current");
  const [filters, setFilters] = useState<FilterBarValue>({
    timeRange: "7",
    trial: "all",
    diseaseArea: "all",
  });
  const activeSeries = view === "current" ? currentFunnel : projectedFunnel;
  const baselineSeries = view === "projected" ? currentFunnel : undefined;
  const trialFilterId = filters.trial === "all" ? undefined : filters.trial;

  return (
    <div className="insights">
      <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: "var(--space-3)" }}>
        Operations Insights
      </h2>

      <FilterBar value={filters} onChange={setFilters} />

      {/* Projection KPI Strip (Wow #3) */}
      <div className="projection-kpis metric-heroes">
        {projectionKPIs.map((kpi) => (
          <div key={kpi.label} className="glass-surface--card metric-hero">
            <div className="metric-hero__label">{kpi.label}</div>
            <div className="metric-hero__row">
              <span className="metric-hero__value">
                {view === "current" ? kpi.currentValue : kpi.projectedValue}
              </span>
              <span
                className={
                  "metric-hero__delta" +
                  (view === "projected"
                    ? " metric-hero__delta--up"
                    : " metric-hero__delta--neutral")
                }
              >
                {view === "projected" ? kpi.delta : "baseline"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column charts */}
      <div className="insights__charts">
        <div className="glass-surface--card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              padding: "var(--space-4) var(--space-4) 0",
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-semibold)",
                margin: 0,
              }}
            >
              Screening Funnel
            </h3>
            <ProjectionToggle value={view} onChange={setView} />
          </div>
          <div
            style={{
              padding: "var(--space-2) var(--space-4) 0",
              fontSize: "var(--text-micro)",
              color: "var(--ink-muted)",
              fontStyle: "italic",
            }}
          >
            {activeSeries.caption}
          </div>
          {activeSeries.metrics.length > 0 ? (
            <FunnelChart
              metrics={activeSeries.metrics}
              comparisonBaseline={baselineSeries?.metrics}
            />
          ) : (
            <InsightsEmptyState label="No funnel data for this filter" />
          )}
          {view === "projected" && (
            <div
              style={{
                padding: "var(--space-3) var(--space-4) var(--space-4)",
                fontSize: "var(--text-micro)",
                color: "var(--ink-muted)",
                borderTop: "1px dashed var(--slate-200)",
                margin: "var(--space-3) var(--space-4) 0",
              }}
            >
              <strong style={{ color: "var(--amber-500)" }}>Methodology: </strong>
              {projectionMethodologyBlurb}
            </div>
          )}
        </div>
        <div className="glass-surface--card" style={{ padding: "var(--space-4)" }}>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              marginBottom: "var(--space-3)",
            }}
          >
            Criterion Family Heatmap
          </h3>
          {heatmapRows.length > 0 ? (
            <HeatmapGrid rows={heatmapRows} />
          ) : (
            <InsightsEmptyState label="No heatmap data for this filter" />
          )}
        </div>
      </div>

      {/* Full-width Trial Health */}
      <div className="glass-surface--card" style={{ marginTop: "var(--space-5)" }}>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-body)",
            fontWeight: "var(--weight-semibold)",
            padding: "var(--space-4) var(--space-4) 0",
          }}
        >
          Trial Health
        </h3>
        <TrialHealthBar trialId={trialFilterId} />
      </div>

      {/* Velocity Sparklines */}
      <div className="glass-surface--card" style={{ marginTop: "var(--space-5)" }}>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-body)",
            fontWeight: "var(--weight-semibold)",
            padding: "var(--space-4) var(--space-4) 0",
          }}
        >
          Queue Velocity
        </h3>
        <VelocitySparklines />
      </div>
    </div>
  );
}
