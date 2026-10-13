/*
 * aiTemporal store — live state for the F4 Temporal Reasoning view.
 *
 * Holds the most recent `TemporalReasoningRun` and the "what-if today"
 * date the user can slide in the UI. Calling `runTemporalAnalysis()`
 * re-runs the deterministic washout / freshness / decision pipeline
 * from `lib/temporal/decisionAssembler.ts`.
 *
 * The default seed matches the static F4 story (today = 2026-04-14,
 * osimertinib last dose 2026-04-06, stale creatinine 2026-03-20, etc.)
 * so the first render looks identical to the pre-P2 mock but is now
 * fully recomputable whenever the user drags `todayIso`.
 */

import { create } from "zustand";
import type { TemporalReasoningRun } from "../types/aiFeatures";
import {
  assembleTemporalRun,
  type ExtraWindowInput,
} from "../lib/temporal/decisionAssembler";
import type { LabFreshnessInput } from "../lib/temporal/labFreshness";
import type { WashoutInput } from "../lib/temporal/washoutCalculator";

export const DEFAULT_TODAY_ISO = "2026-04-14";

export const DEFAULT_WASHOUTS: WashoutInput[] = [
  {
    id: "tw-001",
    label: "Prior EGFR-TKI washout",
    drug: "osimertinib",
    lastDoseDate: "2026-04-06",
    washoutDays: 14,
    computedFrom: ["ev-108"],
  },
];

export const DEFAULT_LABS: LabFreshnessInput[] = [
  {
    id: "lf-001",
    labName: "ANC",
    lastValue: "2,180 /μL",
    lastDrawn: "2026-04-08",
    windowDays: 14,
  },
  {
    id: "lf-002",
    labName: "Platelets",
    lastValue: "234 × 10⁹/L",
    lastDrawn: "2026-04-08",
    windowDays: 14,
  },
  {
    id: "lf-003",
    labName: "Creatinine",
    lastValue: "0.9 mg/dL (stale)",
    lastDrawn: "2026-03-20",
    windowDays: 14,
  },
  {
    id: "lf-004",
    labName: "LFTs (ALT / AST)",
    lastValue: "ALT 28 / AST 22",
    lastDrawn: "2026-04-08",
    windowDays: 14,
  },
];

export const DEFAULT_EXTRA_WINDOWS: ExtraWindowInput[] = [
  {
    id: "tw-002",
    label: "CNS stability window",
    startDate: "2026-02-18",
    endDate: "2026-03-18",
    tone: "ok",
    detail:
      "4-week stability window after brain MRI 2026-02-18 passed without new CNS symptoms. Satisfies §4.2.2.",
    computedFrom: ["ev-109"],
  },
  {
    id: "tw-003",
    label: "Screening imaging window",
    startDate: "2026-03-17",
    endDate: "2026-04-14",
    tone: "warning",
    detail:
      "Protocol requires imaging ≤ 28 days before C1D1. Last CT is 2026-03-08 — 37 days ago. Re-imaging needed before enrollment.",
    computedFrom: ["ev-104"],
  },
];

export type TemporalStatus = "idle" | "running" | "success" | "error";

interface AiTemporalState {
  status: TemporalStatus;
  run: TemporalReasoningRun | null;
  todayIso: string;
  error: string | null;
  washouts: WashoutInput[];
  labs: LabFreshnessInput[];
  extraWindows: ExtraWindowInput[];
  setTodayIso: (iso: string) => void;
  runTemporalAnalysis: () => void;
  reset: () => void;
}

function compute(
  todayIso: string,
  washouts: WashoutInput[],
  labs: LabFreshnessInput[],
  extras: ExtraWindowInput[],
): TemporalReasoningRun {
  return assembleTemporalRun({
    matchId: "match-001",
    patientId: "patient-001",
    trialId: "trial-001",
    todayIso,
    washouts,
    labs,
    extraWindows: extras,
  });
}

export const useAiTemporalStore = create<AiTemporalState>((set, get) => ({
  status: "success",
  run: compute(
    DEFAULT_TODAY_ISO,
    DEFAULT_WASHOUTS,
    DEFAULT_LABS,
    DEFAULT_EXTRA_WINDOWS,
  ),
  todayIso: DEFAULT_TODAY_ISO,
  error: null,
  washouts: DEFAULT_WASHOUTS,
  labs: DEFAULT_LABS,
  extraWindows: DEFAULT_EXTRA_WINDOWS,
  setTodayIso: (iso) => {
    const state = get();
    try {
      const run = compute(iso, state.washouts, state.labs, state.extraWindows);
      set({ todayIso: iso, run, status: "success", error: null });
    } catch (err) {
      set({
        status: "error",
        error: (err as Error).message,
      });
    }
  },
  runTemporalAnalysis: () => {
    const state = get();
    set({ status: "running" });
    try {
      const run = compute(
        state.todayIso,
        state.washouts,
        state.labs,
        state.extraWindows,
      );
      set({ run, status: "success", error: null });
    } catch (err) {
      set({
        status: "error",
        error: (err as Error).message,
      });
    }
  },
  reset: () =>
    set({
      status: "success",
      todayIso: DEFAULT_TODAY_ISO,
      washouts: DEFAULT_WASHOUTS,
      labs: DEFAULT_LABS,
      extraWindows: DEFAULT_EXTRA_WINDOWS,
      run: compute(
        DEFAULT_TODAY_ISO,
        DEFAULT_WASHOUTS,
        DEFAULT_LABS,
        DEFAULT_EXTRA_WINDOWS,
      ),
      error: null,
    }),
}));
