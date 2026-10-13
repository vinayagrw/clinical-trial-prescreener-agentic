/*
 * citationEnforcer — every factual claim must carry a citation.
 *
 * Two variants, one per shape:
 *
 * 1. `citationEnforcerForVerdict` (F3): a `pass` or `fail` verdict with zero
 *    citations is dangerous — no evidence trail means we can't audit why we
 *    told a coordinator to enroll or exclude a patient. We rewrite such
 *    verdicts to `manual_review` with `uncertaintyReason: "missing_domain"`
 *    so the coordinator picks it up instead of the AI silently deciding.
 *
 * 2. `citationEnforcerForAgent` (F5): the Ask Agent prompt already requires
 *    at least one citation, but if it still comes back empty we downgrade
 *    `groundingStatus` to `ungrounded` and surface an explicit fallback
 *    answer. The prompt-level schema in `schemas.ts` actually enforces
 *    `.min(1)` on citations, so an empty array normally gets caught by Zod
 *    before this check runs — this layer is belt-and-suspenders.
 */

import type { AgentResponse, Verdict } from "../ai/schemas";
import type { SafetyCheck } from "./safetyGuard";
import { tokenize } from "../retrieval/tokenize";
import { EVIDENCE_CORPUS, type EvidenceNote } from "../retrieval/evidenceCorpus";

export function citationEnforcerForVerdict(): SafetyCheck<Verdict> {
  return (verdict) => {
    if (verdict.citations.length > 0) return null;
    // Zero citations on a pass/fail → safety violation.
    if (verdict.status === "pass" || verdict.status === "fail") {
      const rewritten: Verdict = {
        ...verdict,
        status: "manual_review",
        uncertaintyReason: "missing_domain",
        reasoning:
          verdict.reasoning +
          " [safety] Original verdict was demoted to manual_review because no supporting citations were provided.",
      };
      return {
        severity: "warn",
        mode: "citation_missing",
        message: `Verdict with status="${verdict.status}" had 0 citations; demoted to manual_review.`,
        rewritten,
        detail: { originalStatus: verdict.status },
      };
    }
    // Uncertain / manual_review with zero citations is allowed but noted.
    return {
      severity: "info",
      mode: "citation_missing",
      message: `Verdict with status="${verdict.status}" has no citations (allowed for ${verdict.status}).`,
    };
  };
}

export function citationEnforcerForAgent(): SafetyCheck<AgentResponse> {
  return (answer) => {
    if (answer.citations.length > 0) return null;
    const rewritten: AgentResponse = {
      ...answer,
      groundingStatus: "ungrounded",
      answer:
        "I can't answer this from the provided evidence — no citations to ground on. " +
        "Rephrase the question against the current scope or gather more evidence first.",
      citations: [],
    };
    return {
      severity: "warn",
      mode: "citation_missing",
      message:
        "Agent response had zero citations; downgraded groundingStatus to 'ungrounded' with a safe fallback.",
      rewritten,
    };
  };
}

// ---------------------------------------------------------------------------
// Item 15: Citation content verification
// ---------------------------------------------------------------------------

/**
 * Jaccard similarity between two token sets.
 * Returns 0 when both sets are empty, 1 when identical.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Verify that each citation's excerpt actually appears in the source corpus.
 *
 * Returns a list of ungrounded citation IDs — citations whose excerpt text
 * has less than 15% token overlap with the corresponding corpus note.
 */
export function verifyCitationContent(
  citations: Verdict["citations"],
  reasoning: string,
  corpus: EvidenceNote[] = EVIDENCE_CORPUS,
): { ungroundedIds: string[]; totalChecked: number } {
  const ungroundedIds: string[] = [];

  for (const cite of citations) {
    const note = corpus.find((n) => n.id === cite.evidenceId);
    if (!note) {
      // Citation references a note not in the corpus — ungrounded.
      ungroundedIds.push(cite.evidenceId);
      continue;
    }

    const excerptTokens = new Set(tokenize(cite.excerpt));
    const noteTokens = new Set(tokenize(note.text));

    // Check that the excerpt actually comes from the note.
    const similarity = jaccardSimilarity(excerptTokens, noteTokens);
    if (similarity < 0.15) {
      ungroundedIds.push(cite.evidenceId);
    }
  }

  return { ungroundedIds, totalChecked: citations.length };
}

/**
 * Safety check: verify that citation excerpts are grounded in the corpus.
 *
 * If more than 50% of citations are ungrounded (Jaccard < 0.15), the
 * verdict is downgraded to manual_review. Below that threshold, an
 * informational event is logged but the verdict stands.
 */
export function citationContentEnforcerForVerdict(
  corpus?: EvidenceNote[],
): SafetyCheck<Verdict> {
  return (verdict) => {
    if (verdict.citations.length === 0) return null; // handled by existing check

    const { ungroundedIds, totalChecked } = verifyCitationContent(
      verdict.citations,
      verdict.reasoning,
      corpus,
    );

    if (ungroundedIds.length === 0) return null;

    const ungroundedRatio = ungroundedIds.length / totalChecked;

    if (ungroundedRatio > 0.5) {
      // Majority ungrounded → downgrade verdict.
      const rewritten: Verdict = {
        ...verdict,
        status:
          verdict.status === "pass" || verdict.status === "fail"
            ? "manual_review"
            : verdict.status,
        uncertaintyReason: "missing_domain",
        reasoning:
          verdict.reasoning +
          ` [safety] ${ungroundedIds.length}/${totalChecked} citations could not be verified against source evidence — verdict downgraded.`,
      };
      return {
        severity: "warn",
        mode: "citation_content",
        message: `${ungroundedIds.length}/${totalChecked} citations ungrounded (Jaccard < 0.15); verdict downgraded.`,
        rewritten,
        detail: { ungroundedIds },
      };
    }

    // Minority ungrounded → info only.
    return {
      severity: "info",
      mode: "citation_content",
      message: `${ungroundedIds.length}/${totalChecked} citations have low source overlap (Jaccard < 0.15).`,
      detail: { ungroundedIds },
    };
  };
}
