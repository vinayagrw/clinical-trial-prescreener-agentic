/*
 * dateExtractor — extracts dates from clinical free text.
 *
 * Clinical narrative contains dates in many forms:
 * - ISO: "2026-04-15"
 * - US: "04/15/2026", "4/15/26"
 * - Prose: "April 15, 2026", "Apr 2026", "15 Apr 2026"
 * - Relative: "3 weeks ago", "last month", "2 years prior"
 * - Clinical: "diagnosed in 2023", "started chemo on 3/1/2025"
 *
 * Each extracted date comes with a confidence level:
 * - "exact": unambiguous full date (year+month+day)
 * - "approximate": month+year only, or relative date resolved from reference
 * - "inferred": year-only or highly ambiguous
 */

export interface ExtractedDate {
  /** ISO "YYYY-MM-DD" resolved date. */
  date: string;
  /** How confident we are in this extraction. */
  confidence: "exact" | "approximate" | "inferred";
  /** The original text that was matched. */
  originalText: string;
  /** Character offset in the source text where the match starts. */
  charOffset: number;
}

// ---------------------------------------------------------------------------
// Month name lookup
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9, sept: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** ISO 8601 date: 2026-04-15 */
const ISO_PATTERN = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

/** US date: 04/15/2026, 4/15/26 */
const US_PATTERN = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;

/** Prose: "April 15, 2026", "Apr 2026", "15 Apr 2026" */
const PROSE_MDY = new RegExp(
  `\\b(${Object.keys(MONTH_MAP).join("|")})\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?\\b`,
  "gi",
);
const PROSE_DMY = new RegExp(
  `\\b(\\d{1,2})\\s+(${Object.keys(MONTH_MAP).join("|")})(?:\\s+(\\d{4}))?\\b`,
  "gi",
);
const PROSE_MY = new RegExp(
  `\\b(${Object.keys(MONTH_MAP).join("|")})\\s+(\\d{4})\\b`,
  "gi",
);

/** Relative: "3 weeks ago", "2 years prior", "6 months before" */
const RELATIVE_PATTERN =
  /\b(\d+)\s+(days?|weeks?|months?|years?)\s+(?:ago|prior|before|earlier)\b/gi;

/** Year-only in clinical context: "in 2023", "since 2024" */
const YEAR_ONLY =
  /\b(?:in|since|from|during)\s+(20\d{2})\b/gi;

// ---------------------------------------------------------------------------
// Core extractor
// ---------------------------------------------------------------------------

/**
 * Extract all dates from clinical free text.
 *
 * @param text           The clinical narrative to extract from.
 * @param referenceDate  ISO "YYYY-MM-DD" used to resolve relative dates.
 * @returns              Extracted dates sorted by charOffset.
 */
export function extractDatesFromText(
  text: string,
  referenceDate: string,
): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const seen = new Set<string>(); // deduplicate by offset+date

  // ISO dates
  for (const match of text.matchAll(ISO_PATTERN)) {
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    if (isValidDate(date)) {
      addResult(results, seen, date, "exact", match[0], match.index ?? 0);
    }
  }

  // US dates
  for (const match of text.matchAll(US_PATTERN)) {
    const year = normalizeYear(match[3]);
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    if (isValidDate(date)) {
      addResult(results, seen, date, "exact", match[0], match.index ?? 0);
    }
  }

  // Prose: Month Day, Year
  for (const match of text.matchAll(PROSE_MDY)) {
    const monthNum = MONTH_MAP[match[1].toLowerCase()];
    if (!monthNum) continue;
    const day = match[2].padStart(2, "0");
    const year = match[3] ?? referenceDate.slice(0, 4);
    const confidence = match[3] ? "exact" : "approximate";
    const date = `${year}-${String(monthNum).padStart(2, "0")}-${day}`;
    if (isValidDate(date)) {
      addResult(results, seen, date, confidence, match[0], match.index ?? 0);
    }
  }

  // Prose: Day Month Year
  for (const match of text.matchAll(PROSE_DMY)) {
    const day = match[1].padStart(2, "0");
    const monthNum = MONTH_MAP[match[2].toLowerCase()];
    if (!monthNum) continue;
    const year = match[3] ?? referenceDate.slice(0, 4);
    const confidence = match[3] ? "exact" : "approximate";
    const date = `${year}-${String(monthNum).padStart(2, "0")}-${day}`;
    if (isValidDate(date)) {
      addResult(results, seen, date, confidence, match[0], match.index ?? 0);
    }
  }

  // Prose: Month Year (no day → use 1st of month)
  for (const match of text.matchAll(PROSE_MY)) {
    const monthNum = MONTH_MAP[match[1].toLowerCase()];
    if (!monthNum) continue;
    const date = `${match[2]}-${String(monthNum).padStart(2, "0")}-01`;
    if (isValidDate(date)) {
      addResult(results, seen, date, "approximate", match[0], match.index ?? 0);
    }
  }

  // Relative dates
  for (const match of text.matchAll(RELATIVE_PATTERN)) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase().replace(/s$/, "");
    const resolved = resolveRelative(referenceDate, amount, unit);
    if (resolved) {
      addResult(results, seen, resolved, "approximate", match[0], match.index ?? 0);
    }
  }

  // Year-only
  for (const match of text.matchAll(YEAR_ONLY)) {
    const date = `${match[1]}-01-01`;
    addResult(results, seen, date, "inferred", match[0], match.index ?? 0);
  }

  // Sort by charOffset.
  results.sort((a, b) => a.charOffset - b.charOffset);
  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addResult(
  results: ExtractedDate[],
  seen: Set<string>,
  date: string,
  confidence: ExtractedDate["confidence"],
  originalText: string,
  charOffset: number,
): void {
  const key = `${charOffset}:${date}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push({ date, confidence, originalText, charOffset });
}

function normalizeYear(raw: string): string {
  if (raw.length === 4) return raw;
  const num = parseInt(raw, 10);
  // Two-digit year: 00–50 → 2000s, 51–99 → 1900s.
  return num <= 50 ? `20${raw.padStart(2, "0")}` : `19${raw}`;
}

function isValidDate(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function resolveRelative(
  referenceDate: string,
  amount: number,
  unit: string,
): string | null {
  const ref = new Date(`${referenceDate}T00:00:00Z`);
  if (isNaN(ref.getTime())) return null;

  switch (unit) {
    case "day":
      ref.setUTCDate(ref.getUTCDate() - amount);
      break;
    case "week":
      ref.setUTCDate(ref.getUTCDate() - amount * 7);
      break;
    case "month":
      ref.setUTCMonth(ref.getUTCMonth() - amount);
      break;
    case "year":
      ref.setUTCFullYear(ref.getUTCFullYear() - amount);
      break;
    default:
      return null;
  }

  return ref.toISOString().slice(0, 10);
}
