/*
 * decisionAssembler — composes the final F4 "earliest enrollment date"
 * decision block from:
 *   1. washout windows          (washoutCalculator.ts)
 *   2. lab freshness rows       (labFreshness.ts)
 *   3. extra protocol windows   (e.g. imaging re-look, CNS stability)
 *
 * Determinism: same inputs → same output. No LLM, no randomness. The
 * `earliestEnrollmentDate` is the maximum of all blocking clear-dates;
 * `blockers[]` is a prose list of everything that pushed the date out.
 *
 * Output shape matches the existing `TemporalReasoningRun` used by the F4
 * view so the store can drop its result straight into the component props.
 */

import type {
  TemporalEligibilityDecision,
  TemporalLabFreshness,
  TemporalReasoningRun,
  TemporalTone,
  TemporalWindow,
} from "../../types/aiFeatures";
import { addDays, daysBetween } from "./dateMath";
import {
  computeLabFreshnessBatch,
  type LabFreshnessInput,
} from "./labFreshness";
import {
  computeWashout,
  washoutToWindow,
  type WashoutInput,
} from "./washoutCalculator";

export interface ExtraWindowInput {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  tone: TemporalTone;
  detail: string;
  computedFrom: string[];
}

export interface AssembleTemporalInput {
  matchId: string;
  patientId: string;
  trialId: string;
  todayIso: string;
  washouts: WashoutInput[];
  labs: LabFreshnessInput[];
  extraWindows?: ExtraWindowInput[];
}

export function assembleTemporalRun(
  input: AssembleTemporalInput,
): TemporalReasoningRun {
  // ---------- washout windows ----------
  const washoutResults = input.washouts.map((w) =>
    computeWashout(w, input.todayIso),
  );
  const washoutWindows: TemporalWindow[] = washoutResults.map(washoutToWindow);

  // ---------- lab freshness ----------
  const labs = computeLabFreshnessBatch(input.labs, input.todayIso);

  // ---------- extra windows ----------
  const extras: TemporalWindow[] = (input.extraWindows ?? []).map((e) => ({
    id: e.id,
    label: e.label,
    startDate: e.startDate,
    endDate: e.endDate,
    tone: e.tone,
    detail: e.detail,
    daysFromToday: daysBetween(e.endDate, input.todayIso),
    computedFrom: e.computedFrom,
  }));

  const allWindows: TemporalWindow[] = [...washoutWindows, ...extras];

  // ---------- decision ----------
  const decision = computeDecision(allWindows, labs, input.todayIso);

  return {
    matchId: input.matchId,
    patientId: input.patientId,
    trialId: input.trialId,
    todayIso: input.todayIso,
    windows: allWindows,
    labFreshness: labs,
    decision,
  };
}

function computeDecision(
  windows: TemporalWindow[],
  labs: TemporalLabFreshness[],
  todayIso: string,
): TemporalEligibilityDecision {
  const blockers: string[] = [];
  let earliestClear = todayIso;

  // Window blockers (washouts + imaging windows with tone "waiting" / "blocked")
  for (const w of windows) {
    if (w.tone === "waiting" || w.tone === "blocked") {
      // Use endDate as the clear-date for waiting windows (e.g. washout clears on endDate).
      const clear = w.endDate;
      if (clear > earliestClear) earliestClear = clear;
      const daysOut = daysBetween(clear, todayIso);
      if (daysOut > 0) {
        blockers.push(`${w.label} clears ${clear} (${daysOut} days)`);
      } else if (w.tone === "blocked") {
        blockers.push(`${w.label} is blocked — ${w.detail}`);
      }
    } else if (w.tone === "warning") {
      blockers.push(`${w.label} flagged: ${w.detail}`);
    }
  }

  // Lab blockers
  for (const lab of labs) {
    if (lab.tone === "blocked") {
      const needsRedraw = addDays(todayIso, 0); // earliest enrollment can't be before today
      if (needsRedraw > earliestClear) earliestClear = needsRedraw;
      blockers.push(
        `${lab.labName} must be re-drawn — last value is ${
          -lab.daysUntilStale
        } days old (protocol: ≤ ${lab.windowDays} days)`,
      );
    } else if (lab.tone === "warning") {
      blockers.push(
        `${lab.labName} will go stale in ${lab.daysUntilStale} day${
          lab.daysUntilStale === 1 ? "" : "s"
        }`,
      );
    }
  }

  const tone: TemporalTone =
    blockers.length === 0 ? "ok" : blockers.length > 2 ? "blocked" : "waiting";

  const windowLabel =
    tone === "ok"
      ? "Eligibility window open."
      : `Opens ${earliestClear}. Re-check blockers before C1D1.`;

  return {
    earliestEnrollmentDate: earliestClear,
    windowLabel,
    blockers,
    tone,
  };
}
