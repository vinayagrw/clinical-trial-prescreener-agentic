/*
 * scopedNegation — simplified NegEx-style scope-aware negation detection.
 *
 * Clinical text is full of negation cues ("no brain metastases", "denies
 * chest pain", "ruled out PE") that keyword-only detectors misinterpret
 * because they have no notion of *scope*. A trigger like "no" only negates
 * the noun phrase that follows it, not the entire sentence.
 *
 * This module implements the core NegEx algorithm:
 *
 * 1. Identify pre-negation triggers (e.g., "no", "denies")
 * 2. Identify post-negation triggers (e.g., "ruled out", "unlikely")
 * 3. Exclude pseudo-negation phrases (e.g., "no increase", "not only")
 * 4. Scan forward/backward from each trigger up to a termination term
 *    (e.g., "but", "however") or a max token window
 * 5. Check whether the target phrase falls within any negation scope
 *
 * References:
 * - Chapman WW et al., "A Simple Algorithm for Identifying Negated
 *   Findings and Diseases in Discharge Summaries", J Biomed Inform 2001
 * - Harkema H et al., "ConText: An Algorithm for Determining Negation,
 *   Experiencer, and Temporal Status from Clinical Reports", J Biomed
 *   Inform 2009
 */

export interface NegationResult {
  /** Whether the target phrase is negated in the given text. */
  isNegated: boolean;
  /** The text span affected by the negation scope. */
  scope: string;
  /** Which trigger matched (empty if not negated). */
  trigger: string;
  /** Start char offset of the negation scope in the original text. */
  scopeStart: number;
  /** End char offset of the negation scope in the original text. */
  scopeEnd: number;
}

// ---------------------------------------------------------------------------
// Trigger and termination lexicons
// ---------------------------------------------------------------------------

/** Triggers that negate the phrase that FOLLOWS them. */
const PRE_NEGATION: string[] = [
  "no ",
  "not ",
  "denies ",
  "denied ",
  "without ",
  "negative for ",
  "ruled out ",
  "rules out ",
  "absent ",
  "free of ",
  "no evidence of ",
  "no sign of ",
  "no signs of ",
  "no history of ",
  "never had ",
  "never developed ",
];

/** Triggers that negate the phrase that PRECEDES them. */
const POST_NEGATION: string[] = [
  "unlikely",
  "was ruled out",
  "has been ruled out",
  "was excluded",
  "is negative",
  "were negative",
  "not demonstrated",
  "not identified",
  "not seen",
  "not found",
  "not detected",
];

/**
 * Pseudo-negation phrases — look like negation triggers but do NOT actually
 * negate the following concept. Must be checked BEFORE trigger matching.
 */
const PSEUDO_NEGATION: string[] = [
  "no increase",
  "no decrease",
  "no change",
  "no new",
  "not only",
  "not necessarily",
  "not excluded",
  "no longer",
  "no further",
  "not certain",
  "not certain if",
  "no other",
];

/**
 * Termination terms — the negation scope ends when one of these is encountered.
 * They signal a clause boundary where the negation no longer applies.
 */
const TERMINATION: string[] = [
  "but",
  "however",
  "although",
  "except",
  "apart from",
  "aside from",
  "which",
  "nevertheless",
  "still",
  "yet",
  "though",
];

/** Maximum number of tokens a pre/post negation scope extends. */
const MAX_SCOPE_TOKENS = 6;

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Detect whether `targetPhrase` is negated within `text`.
 *
 * The algorithm:
 * 1. Check if any pseudo-negation phrase covers the area — if so, skip.
 * 2. Find pre-negation triggers; for each, scan forward up to
 *    `MAX_SCOPE_TOKENS` tokens or a termination term.
 * 3. Find post-negation triggers; for each, scan backward up to
 *    `MAX_SCOPE_TOKENS` tokens or a termination term.
 * 4. If `targetPhrase` falls within any computed scope, return negated.
 */
export function detectNegation(
  text: string,
  targetPhrase: string,
): NegationResult {
  const lower = text.toLowerCase();
  const targetLower = targetPhrase.toLowerCase();
  const targetStart = lower.indexOf(targetLower);
  const notNegated: NegationResult = {
    isNegated: false,
    scope: "",
    trigger: "",
    scopeStart: 0,
    scopeEnd: 0,
  };

  // Target phrase not found in text at all — can't assess negation.
  if (targetStart === -1) return notNegated;
  const targetEnd = targetStart + targetLower.length;

  // Step 1: check pseudo-negation — if the negation trigger is part of
  // a pseudo-negation phrase, skip it entirely.
  for (const pseudo of PSEUDO_NEGATION) {
    if (lower.includes(pseudo)) {
      // If the pseudo-negation phrase overlaps with where we'd find a
      // trigger, we need to exclude that trigger position.
    }
  }

  // Step 2: pre-negation triggers (negate what follows).
  for (const trigger of PRE_NEGATION) {
    let searchFrom = 0;
    while (true) {
      const triggerStart = lower.indexOf(trigger, searchFrom);
      if (triggerStart === -1) break;
      searchFrom = triggerStart + trigger.length;

      // Check if this trigger is part of a pseudo-negation phrase.
      if (isPseudoNegation(lower, triggerStart, trigger)) continue;

      // Compute scope: from end of trigger forward, up to termination or max tokens.
      const scopeStart = triggerStart + trigger.length;
      const scopeEnd = computeForwardScopeEnd(lower, scopeStart);

      // Does the target fall within this scope?
      if (targetStart >= scopeStart && targetStart < scopeEnd) {
        return {
          isNegated: true,
          scope: text.slice(scopeStart, scopeEnd).trim(),
          trigger: trigger.trim(),
          scopeStart,
          scopeEnd,
        };
      }
    }
  }

  // Step 3: post-negation triggers (negate what precedes).
  for (const trigger of POST_NEGATION) {
    let searchFrom = 0;
    while (true) {
      const triggerStart = lower.indexOf(trigger, searchFrom);
      if (triggerStart === -1) break;
      searchFrom = triggerStart + trigger.length;

      // Compute scope: from trigger backward, up to termination or max tokens.
      const scopeEnd = triggerStart;
      const scopeStart = computeBackwardScopeStart(lower, scopeEnd);

      // Does the target fall within this scope?
      if (targetEnd > scopeStart && targetStart < scopeEnd) {
        return {
          isNegated: true,
          scope: text.slice(scopeStart, scopeEnd).trim(),
          trigger: trigger.trim(),
          scopeStart,
          scopeEnd,
        };
      }
    }
  }

  return notNegated;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Check if a trigger at the given position is part of a pseudo-negation. */
function isPseudoNegation(
  lower: string,
  triggerStart: number,
  trigger: string,
): boolean {
  const window = lower.slice(
    Math.max(0, triggerStart),
    triggerStart + trigger.length + 20,
  );
  return PSEUDO_NEGATION.some((pseudo) => window.startsWith(pseudo));
}

/**
 * Compute the end of a forward negation scope starting at `from`.
 * Stops at a termination term, sentence boundary, or MAX_SCOPE_TOKENS.
 */
function computeForwardScopeEnd(lower: string, from: number): number {
  const remaining = lower.slice(from);

  // Find earliest termination term.
  let terminationIdx = remaining.length;
  for (const term of TERMINATION) {
    const idx = remaining.indexOf(` ${term} `);
    if (idx !== -1 && idx < terminationIdx) terminationIdx = idx;
  }

  // Find sentence boundary.
  const sentenceEnd = remaining.search(/[.;!?\n]/);
  if (sentenceEnd !== -1 && sentenceEnd < terminationIdx) {
    terminationIdx = sentenceEnd;
  }

  // Token-count limit.
  const tokens = remaining.slice(0, terminationIdx).split(/\s+/);
  if (tokens.length > MAX_SCOPE_TOKENS) {
    // Find the char offset of the Nth token boundary.
    let charCount = 0;
    for (let i = 0; i < MAX_SCOPE_TOKENS; i++) {
      charCount += tokens[i].length + 1; // +1 for space
    }
    terminationIdx = Math.min(terminationIdx, charCount);
  }

  return from + terminationIdx;
}

/**
 * Compute the start of a backward negation scope ending at `to`.
 * Stops at a termination term, sentence boundary, or MAX_SCOPE_TOKENS.
 */
function computeBackwardScopeStart(lower: string, to: number): number {
  const preceding = lower.slice(0, to);

  // Find latest termination term.
  let terminationIdx = 0;
  for (const term of TERMINATION) {
    const idx = preceding.lastIndexOf(` ${term} `);
    if (idx !== -1 && idx + term.length + 2 > terminationIdx) {
      terminationIdx = idx + term.length + 2;
    }
  }

  // Find sentence boundary (last one before `to`).
  const sentenceStart = preceding.search(/[.;!?\n][^.;!?\n]*$/);
  if (sentenceStart !== -1 && sentenceStart + 1 > terminationIdx) {
    terminationIdx = sentenceStart + 1;
  }

  // Token-count limit.
  const scopeText = preceding.slice(terminationIdx);
  const tokens = scopeText.trim().split(/\s+/);
  if (tokens.length > MAX_SCOPE_TOKENS) {
    const excess = tokens.length - MAX_SCOPE_TOKENS;
    let charCount = 0;
    for (let i = 0; i < excess; i++) {
      charCount += tokens[i].length + 1;
    }
    terminationIdx += charCount;
  }

  return terminationIdx;
}

// ---------------------------------------------------------------------------
// Enhanced assertion status inference (replaces regex-only version)
// ---------------------------------------------------------------------------

/**
 * Enhanced assertion-status inference that uses scoped negation.
 *
 * This replaces the simple regex-only `inferAssertionStatus()` from
 * prescreenerEngine.ts with scope-aware negation detection. Family
 * history, possibility, and historical-event detection still use
 * regex (those don't benefit from scope analysis).
 */
export function inferAssertionStatusNLP(
  text: string,
): "negated" | "possible" | "family" | "historical" | "present" {
  const lower = text.toLowerCase();

  // Family history — keep regex (scope analysis doesn't help here).
  if (/family history|mother|father|sister|brother/i.test(lower)) {
    return "family";
  }

  // Possibility / indeterminate — keep regex.
  if (/rule out|possible|pending|indeterminate|concerning for/i.test(lower)) {
    return "possible";
  }

  // Historical events — keep regex.
  if (/history of|hospitalization for|completed|prior /i.test(lower)) {
    return "historical";
  }

  // Scope-aware negation: check if the core medical content is negated.
  // Extract candidate noun phrases (simple heuristic: words > 4 chars).
  const medicalTerms = lower
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 4);

  for (const term of medicalTerms) {
    const result = detectNegation(text, term);
    if (result.isNegated) return "negated";
  }

  // Fallback: check classic negation keywords as a safety net.
  if (/\bno\b|\bdenies\b|\bwithout\b|negative for|not consistent with/i.test(lower)) {
    return "negated";
  }

  return "present";
}
