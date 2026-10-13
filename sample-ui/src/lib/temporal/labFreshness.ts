/*
 * labFreshness — deterministic lab-freshness gate.
 *
 * Inputs: last draw date + protocol window (days). Outputs: fresh-through
 * date, days-until-stale, tone. Produces objects matching the existing F4
 * `TemporalLabFreshness` shape so the view renders without changes.
 */

import type { TemporalLabFreshness, TemporalTone } from "../../types/aiFeatures";
import { addDays, daysBetween } from "./dateMath";

export interface LabFreshnessInput {
  id: string;
  labName: string;
  /** Display value for the last result (e.g. "2,180 /μL"). */
  lastValue: string;
  /** ISO date the lab was drawn. */
  lastDrawn: string;
  /** Protocol-required freshness window in days. */
  windowDays: number;
}

/** Compute freshness state and map onto the `TemporalLabFreshness` view shape. */
export function computeLabFreshness(
  input: LabFreshnessInput,
  todayIso: string,
): TemporalLabFreshness {
  const freshThrough = addDays(input.lastDrawn, input.windowDays);
  const daysUntilStale = daysBetween(freshThrough, todayIso);
  // Tone ladder:
  //   > 3 days fresh   → ok
  //   0..3 days fresh  → warning (will stale soon)
  //   <= 0 days        → blocked
  let tone: TemporalTone;
  if (daysUntilStale > 3) tone = "ok";
  else if (daysUntilStale >= 0) tone = "warning";
  else tone = "blocked";

  return {
    id: input.id,
    labName: input.labName,
    lastValue: input.lastValue,
    lastDrawn: input.lastDrawn,
    windowDays: input.windowDays,
    freshThrough,
    tone,
    daysUntilStale,
  };
}

/** Convenience — compute freshness for an array. */
export function computeLabFreshnessBatch(
  inputs: LabFreshnessInput[],
  todayIso: string,
): TemporalLabFreshness[] {
  return inputs.map((i) => computeLabFreshness(i, todayIso));
}
