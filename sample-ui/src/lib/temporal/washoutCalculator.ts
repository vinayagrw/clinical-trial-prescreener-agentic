/*
 * washoutCalculator — computes when a patient clears protocol-required
 * washout windows for prior therapies. Inputs are deterministic: for each
 * drug we know the last dose date and the protocol-required washout days,
 * we add them, and we compare against today.
 *
 * Outputs feed into `decisionAssembler.ts` which turns them into the
 * eligibility decision block on the F4 view.
 */

import type { TemporalTone, TemporalWindow } from "../../types/aiFeatures";
import { addDays, daysBetween } from "./dateMath";

export interface WashoutInput {
  id: string;
  /** Human-readable label (“Prior EGFR-TKI washout”). */
  label: string;
  /** Drug or class the washout applies to (for display). */
  drug: string;
  /** ISO date of the last dose. */
  lastDoseDate: string;
  /** Protocol-required days of washout. */
  washoutDays: number;
  /** Evidence id(s) from the retrieval corpus that support this entry. */
  computedFrom: string[];
}

export interface WashoutResult {
  id: string;
  label: string;
  drug: string;
  lastDoseDate: string;
  washoutDays: number;
  /** ISO date the washout clears (lastDoseDate + washoutDays). */
  clearDate: string;
  /** Days until clearance (negative if already cleared). */
  daysUntilClear: number;
  /** True if washout has not yet elapsed relative to `todayIso`. */
  blocking: boolean;
  computedFrom: string[];
}

/** Compute a single washout result. */
export function computeWashout(
  input: WashoutInput,
  todayIso: string,
): WashoutResult {
  const clearDate = addDays(input.lastDoseDate, input.washoutDays);
  const daysUntilClear = daysBetween(clearDate, todayIso);
  const blocking = daysUntilClear > 0;
  return {
    id: input.id,
    label: input.label,
    drug: input.drug,
    lastDoseDate: input.lastDoseDate,
    washoutDays: input.washoutDays,
    clearDate,
    daysUntilClear,
    blocking,
    computedFrom: input.computedFrom,
  };
}

/** Map a WashoutResult onto the existing F4 `TemporalWindow` shape so the view can render it unchanged. */
export function washoutToWindow(result: WashoutResult): TemporalWindow {
  const tone: TemporalTone = result.blocking ? "waiting" : "ok";
  const detail = result.blocking
    ? `Last ${result.drug} dose ${result.lastDoseDate}. Protocol requires ≥ ${result.washoutDays} days washout. Clears ${result.clearDate} (${result.daysUntilClear} days from today).`
    : `Washout cleared ${result.clearDate}. ${result.drug} last dose ${result.lastDoseDate}.`;
  return {
    id: result.id,
    label: result.label,
    startDate: result.lastDoseDate,
    endDate: result.clearDate,
    tone,
    detail,
    daysFromToday: result.daysUntilClear,
    computedFrom: result.computedFrom,
  };
}
