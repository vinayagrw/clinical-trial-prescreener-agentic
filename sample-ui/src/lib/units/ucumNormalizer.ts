/*
 * ucumNormalizer — lightweight UCUM-subset unit conversion for common
 * clinical lab values.
 *
 * Rather than pulling in a full UCUM library, we maintain conversion
 * tables for the lab analytes that matter for trial eligibility
 * screening. Each entry maps a source unit to a canonical unit with a
 * multiplication factor.
 *
 * The converter is intentionally conservative: it returns `null` when
 * a requested conversion is not in the table rather than guessing.
 */

interface ConversionEntry {
  /** Analyte this conversion applies to (e.g., "creatinine"). */
  analyte: string;
  /** Normalized alias for the source unit. */
  fromUnit: string;
  /** Normalized alias for the target unit. */
  toUnit: string;
  /** Multiply the source value by this factor to get the target value. */
  factor: number;
}

// ---------------------------------------------------------------------------
// Conversion table
//
// Sources: UCUM, UpToDate unit conversion tables, CTP lab reference.
// Each pair is listed in both directions so lookups are symmetric.
// ---------------------------------------------------------------------------
const CONVERSIONS: ConversionEntry[] = [
  // Creatinine
  { analyte: "creatinine", fromUnit: "umol/l",   toUnit: "mg/dl",  factor: 0.0113 },
  { analyte: "creatinine", fromUnit: "mg/dl",    toUnit: "umol/l", factor: 88.42 },

  // Hemoglobin
  { analyte: "hemoglobin", fromUnit: "g/l",      toUnit: "g/dl",   factor: 0.1 },
  { analyte: "hemoglobin", fromUnit: "g/dl",     toUnit: "g/l",    factor: 10 },

  // Bilirubin (total)
  { analyte: "bilirubin",  fromUnit: "umol/l",   toUnit: "mg/dl",  factor: 0.0585 },
  { analyte: "bilirubin",  fromUnit: "mg/dl",    toUnit: "umol/l", factor: 17.1 },

  // ANC (absolute neutrophil count)
  { analyte: "anc",        fromUnit: "x10^9/l",  toUnit: "x10^3/ul", factor: 1 },
  { analyte: "anc",        fromUnit: "10^9/l",   toUnit: "x10^3/ul", factor: 1 },
  { analyte: "anc",        fromUnit: "/ul",       toUnit: "x10^3/ul", factor: 0.001 },
  { analyte: "anc",        fromUnit: "cells/ul",  toUnit: "x10^3/ul", factor: 0.001 },
  { analyte: "anc",        fromUnit: "/mm3",      toUnit: "x10^3/ul", factor: 0.001 },
  { analyte: "anc",        fromUnit: "x10^3/ul",  toUnit: "/ul",      factor: 1000 },

  // Platelets
  { analyte: "platelets",  fromUnit: "x10^9/l",  toUnit: "x10^3/ul", factor: 1 },
  { analyte: "platelets",  fromUnit: "10^9/l",   toUnit: "x10^3/ul", factor: 1 },
  { analyte: "platelets",  fromUnit: "/ul",       toUnit: "x10^3/ul", factor: 0.001 },
  { analyte: "platelets",  fromUnit: "x10^3/ul",  toUnit: "/ul",      factor: 1000 },

  // ALT / AST (same units in practice, but cover the common alias)
  { analyte: "alt",        fromUnit: "u/l",       toUnit: "iu/l",    factor: 1 },
  { analyte: "alt",        fromUnit: "iu/l",      toUnit: "u/l",     factor: 1 },
  { analyte: "ast",        fromUnit: "u/l",       toUnit: "iu/l",    factor: 1 },
  { analyte: "ast",        fromUnit: "iu/l",      toUnit: "u/l",     factor: 1 },

  // ALP (alkaline phosphatase)
  { analyte: "alp",        fromUnit: "u/l",       toUnit: "iu/l",    factor: 1 },
  { analyte: "alp",        fromUnit: "iu/l",      toUnit: "u/l",     factor: 1 },
];

/**
 * Normalize a unit string into a canonical, lower-case form so that
 * "μmol/L", "umol/L", and "UMOL/L" all match.
 */
function normalizeUnitAlias(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\u00b5/g, "u") // μ → u
    .replace(/micro/g, "u")
    .replace(/\s+/g, "")
    .replace(/litre/g, "l")
    .replace(/liter/g, "l")
    .replace(/decilitre/g, "dl")
    .replace(/deciliter/g, "dl");
}

/**
 * Find a conversion factor for the given analyte + unit pair.
 *
 * Returns `null` when no conversion is known — the caller should
 * fall back to using the raw value and flagging the result as
 * needing manual review.
 */
export function findConversionFactor(
  analyte: string,
  fromUnit: string,
  toUnit: string,
): number | null {
  const normFrom = normalizeUnitAlias(fromUnit);
  const normTo = normalizeUnitAlias(toUnit);

  // Identity conversion — no math needed.
  if (normFrom === normTo) return 1;

  const entry = CONVERSIONS.find(
    (c) =>
      c.analyte === analyte.toLowerCase() &&
      c.fromUnit === normFrom &&
      c.toUnit === normTo,
  );
  return entry?.factor ?? null;
}

/**
 * Convert a lab value from one unit to a target unit for the given analyte.
 *
 * Returns `null` when the conversion is unknown — the caller should
 * treat this as an uncertain comparison rather than silently passing
 * or failing the criterion.
 */
export function normalizeToCanonical(
  value: number,
  analyte: string,
  fromUnit: string,
  targetUnit: string,
): number | null {
  const factor = findConversionFactor(analyte, fromUnit, targetUnit);
  if (factor === null) return null;
  return value * factor;
}
