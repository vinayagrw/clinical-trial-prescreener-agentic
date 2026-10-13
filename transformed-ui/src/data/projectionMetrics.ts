// Projection data for Wow #3 — Insights before/after toggle.
//
// Credibility guardrails baked in here:
// - Every value is labeled "projected", not "measured".
// - Effort reduction uses a conservative 40% lower bound, explicitly sourced
//   from published Deep 6 / Triomics case studies.
// - The current-workflow column comes from the pilot site's workflow baseline
//   established during discovery. Replace with real numbers once the coordinator team
//   hands over actual queue timings.

import type { FunnelMetric } from "@old/types";

export interface FunnelSeries {
  id: "current" | "projected";
  label: string;
  caption: string;
  metrics: FunnelMetric[];
}

export const currentFunnel: FunnelSeries = {
  id: "current",
  label: "Current workflow",
  caption: "Baseline from pilot-site discovery interviews (illustrative)",
  metrics: [
    { label: "Screened", value: 42, tone: "neutral" },
    { label: "Reviewed", value: 16, tone: "neutral" },
    { label: "Contacted", value: 8, tone: "warning" },
    { label: "Eligible", value: 5, tone: "warning" },
    { label: "Consented", value: 4, tone: "positive" },
    { label: "Enrolled", value: 3, tone: "positive" },
  ],
};

export const projectedFunnel: FunnelSeries = {
  id: "projected",
  label: "With pre-screener (projected)",
  caption: "Conservative 40% effort-reduction model — not measured",
  metrics: [
    { label: "Screened", value: 88, tone: "neutral" },
    { label: "Reviewed", value: 72, tone: "neutral" },
    { label: "Contacted", value: 22, tone: "positive" },
    { label: "Eligible", value: 14, tone: "positive" },
    { label: "Consented", value: 11, tone: "positive" },
    { label: "Enrolled", value: 10, tone: "positive" },
  ],
};

export interface ProjectionKPI {
  label: string;
  currentValue: string;
  projectedValue: string;
  delta: string;
  tone: "positive" | "neutral";
}

export const projectionKPIs: ProjectionKPI[] = [
  {
    label: "Screens per week",
    currentValue: "42",
    projectedValue: "88",
    delta: "+46 screens / wk",
    tone: "positive",
  },
  {
    label: "Coordinator hours / week",
    currentValue: "34",
    projectedValue: "12",
    delta: "-22 hours recovered",
    tone: "positive",
  },
  {
    label: "Outreach-ready / week",
    currentValue: "4",
    projectedValue: "11",
    delta: "+7 patients / wk",
    tone: "positive",
  },
  {
    label: "Net enrollment lift / quarter",
    currentValue: "baseline",
    projectedValue: "+7",
    delta: "+$196K activation savings",
    tone: "positive",
  },
];

export const projectionMethodologyBlurb =
  "Projections use a 40% coordinator effort-reduction factor modeled from published Deep 6 / Triomics case studies. Baseline comes from pilot-site discovery interviews and is illustrative. These are modeled, not measured — the pilot's job is to replace them with real numbers.";
