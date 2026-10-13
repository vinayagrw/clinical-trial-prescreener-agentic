/*
 * dateMath — tiny, deterministic date helpers used across the temporal
 * reasoning layer (washoutCalculator, labFreshness, decisionAssembler).
 *
 * Everything here normalizes to UTC midnight so "2026-04-14" means the
 * same calendar day regardless of the browser's local timezone. Dates in
 * and out of this module are always ISO-8601 "YYYY-MM-DD" strings.
 */

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function daysBetween(laterIso: string, earlierIso: string): number {
  const later = parseIso(laterIso);
  const earlier = parseIso(earlierIso);
  // Math.ceil ensures safety-conservative rounding: a fractional day always
  // rounds UP so washout periods are never underestimated.
  return Math.ceil(
    (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function todayIso(): string {
  return toIso(new Date());
}
