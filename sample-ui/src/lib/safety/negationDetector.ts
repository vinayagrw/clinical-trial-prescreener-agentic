/*
 * negationDetector — catches a verdict whose reasoning has been inverted by
 * stripping or missing a negation.
 *
 * Classic example: patient chart says "no brain metastases" and the LLM
 * returns reasoning "brain metastases present; exclude". Another: "denies
 * chest pain" vs "chest pain present". We scan the reasoning for a handful
 * of negation triggers and also scan each citation excerpt for negation; if
 * the reasoning's polarity differs from the excerpt's polarity on the same
 * topic, we flag it.
 *
 * This is a light heuristic — negation-inversion is a deep NLP problem — but
 * it catches the most common failure and lets the coordinator review the
 * case instead of silently passing or silently failing.
 */

import type { Verdict } from "../ai/schemas";
import type { SafetyCheck } from "./safetyGuard";
import { detectNegation } from "../nlp/scopedNegation";

const NEGATION_TRIGGERS = [
  "no ",
  "not ",
  "without ",
  "negative for",
  "denies",
  "denied",
  "absent",
  "none",
];

/**
 * Detect negation using scope-aware NegEx for specific phrases, with
 * a keyword fallback for general detection.
 *
 * When `targetPhrase` is provided, uses the full scoped NegEx algorithm.
 * Otherwise falls back to the keyword-only heuristic.
 */
function hasNegation(text: string, targetPhrase?: string): boolean {
  if (targetPhrase) {
    return detectNegation(text, targetPhrase).isNegated;
  }
  const lower = text.toLowerCase();
  return NEGATION_TRIGGERS.some((t) => lower.includes(t));
}

/** Tokenize lightly — used to find overlapping medical terms across reasoning + citations. */
function topicTokens(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 4);
  return new Set(cleaned);
}

export function negationDetectorForVerdict(): SafetyCheck<Verdict> {
  return (verdict) => {
    if (verdict.status !== "pass" && verdict.status !== "fail") return null;
    const reasoningNegated = hasNegation(verdict.reasoning);
    const reasoningTokens = topicTokens(verdict.reasoning);
    const conflicts: string[] = [];
    for (const cite of verdict.citations) {
      const excerptTokens = topicTokens(cite.excerpt);
      // Do they share at least one non-trivial token? If not, probably unrelated.
      const overlap = [...reasoningTokens].filter((t) => excerptTokens.has(t));
      if (overlap.length < 2) continue;

      // Use scope-aware negation: check if the shared topic is negated in the
      // excerpt vs. the reasoning. This catches "no brain metastases" being
      // misread as "brain metastases present" more reliably than keyword-only.
      const sharedPhrase = overlap.slice(0, 3).join(" ");
      const excerptNegated = hasNegation(cite.excerpt, sharedPhrase);
      if (excerptNegated === reasoningNegated) continue;

      conflicts.push(cite.evidenceId);
    }
    if (conflicts.length === 0) return null;
    const rewritten: Verdict = {
      ...verdict,
      status: "uncertain",
      uncertaintyReason: "conflicting_evidence",
      reasoning:
        verdict.reasoning +
        ` [safety] Negation polarity mismatch against citation(s) ${conflicts.join(
          ", ",
        )} — downgraded to uncertain for coordinator review.`,
    };
    return {
      severity: "warn",
      mode: "negation",
      message: `Negation polarity mismatch with ${conflicts.join(", ")}.`,
      rewritten,
      detail: { conflicts, originalStatus: verdict.status },
    };
  };
}
