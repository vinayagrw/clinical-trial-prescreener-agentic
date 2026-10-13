/*
 * ulnTable — upper limit of normal (ULN) reference values for common
 * lab analytes used in clinical trial eligibility criteria.
 *
 * Many trial protocols define thresholds relative to ULN, e.g.,
 * "total bilirubin ≤ 1.5 × ULN" or "AST ≤ 3 × ULN". This table
 * provides institution-standard ULN defaults so the screening engine
 * can resolve these relative thresholds into absolute comparison values.
 *
 * Institutional values are from CTP Clinical Lab reference ranges.
 * These can be overridden per-protocol if a trial specifies different
 * reference ranges.
 */

export interface UlnEntry {
  /** Analyte name (lower-case canonical). */
  analyte: string;
  /** Upper limit of normal. */
  value: number;
  /** Unit the ULN is expressed in. */
  unit: string;
}

const ULN_DEFAULTS: Record<string, UlnEntry> = {
  bilirubin:  { analyte: "bilirubin",  value: 1.2,  unit: "mg/dl" },
  creatinine: { analyte: "creatinine", value: 1.2,  unit: "mg/dl" },
  alt:        { analyte: "alt",        value: 35,   unit: "u/l" },
  ast:        { analyte: "ast",        value: 35,   unit: "u/l" },
  alp:        { analyte: "alp",        value: 120,  unit: "u/l" },
};

/**
 * Resolve a "× ULN" threshold into an absolute value + unit.
 *
 * Example: `resolveUlnThreshold("bilirubin", 1.5)` returns
 * `{ absoluteValue: 1.8, unit: "mg/dl" }` because ULN for
 * bilirubin is 1.2 mg/dL and 1.2 × 1.5 = 1.8.
 *
 * Returns `null` when the analyte has no ULN entry — the caller
 * should route the criterion to manual review.
 */
export function resolveUlnThreshold(
  analyte: string,
  multiplier: number,
): { absoluteValue: number; unit: string } | null {
  const entry = ULN_DEFAULTS[analyte.toLowerCase()];
  if (!entry) return null;
  return {
    absoluteValue: entry.value * multiplier,
    unit: entry.unit,
  };
}

/**
 * Look up the raw ULN value for an analyte.
 * Returns `undefined` if the analyte is not in the table.
 */
export function getUln(analyte: string): UlnEntry | undefined {
  return ULN_DEFAULTS[analyte.toLowerCase()];
}

/**
 * Parse a threshold string for "× ULN" patterns and return the multiplier.
 *
 * Handles:
 * - "1.5 × ULN", "1.5 x ULN", "1.5xULN"
 * - "≤ 3 × ULN", "< 2.5 x ULN"
 * - "3x the ULN", "3 times ULN"
 *
 * Returns `null` if no ULN pattern is found.
 */
export function parseUlnMultiplier(thresholdText: string): number | null {
  const match = thresholdText.match(
    /(\d+(?:\.\d+)?)\s*(?:[x×]|times)\s*(?:the\s+)?ULN/i,
  );
  if (!match) return null;
  const multiplier = parseFloat(match[1]);
  return Number.isNaN(multiplier) ? null : multiplier;
}
