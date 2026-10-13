/*
 * biasToUncertain — if the reasoning refers to an evidence id that is NOT in
 * the citations array, rewrite the verdict to `uncertain`.
 *
 * This is the core of the product thesis in `21-ai-safety-and-success-model.md §2`:
 * when the LLM leans on something we can't actually ground, we refuse to call
 * it a pass (or a fail) and push it to the coordinator. The coordinator
 * routing path is what lets a "conservative AI" still fill trials — the path
 * is visible, manageable, and SLA-tracked in P6.
 *
 * Detection is simple: regex out every `ev-NNN` mention from the reasoning
 * text, then check whether each one appears in `citations[].evidenceId`. If
 * any referenced id is uncited, the verdict is downgraded.
 */

import type { Verdict } from "../ai/schemas";
import type { SafetyCheck } from "./safetyGuard";

const EVIDENCE_ID_PATTERN = /ev-\d+/gi;

export function biasToUncertainForVerdict(): SafetyCheck<Verdict> {
  return (verdict) => {
    // Only actionable on pass / fail — uncertain and manual_review are already safe.
    if (verdict.status !== "pass" && verdict.status !== "fail") return null;
    const mentioned = new Set(
      (verdict.reasoning.match(EVIDENCE_ID_PATTERN) ?? []).map((m) =>
        m.toLowerCase(),
      ),
    );
    if (mentioned.size === 0) return null;
    const cited = new Set(verdict.citations.map((c) => c.evidenceId.toLowerCase()));
    const missing = [...mentioned].filter((id) => !cited.has(id));
    if (missing.length === 0) return null;
    const rewritten: Verdict = {
      ...verdict,
      status: "uncertain",
      uncertaintyReason: "missing_domain",
      reasoning:
        verdict.reasoning +
        ` [safety] Bias-to-uncertain: reasoning referenced ${missing.join(
          ", ",
        )} but no matching citation was supplied.`,
    };
    return {
      severity: "warn",
      mode: "bias_to_uncertain",
      message: `Uncited evidence ids in reasoning (${missing.join(", ")}) — downgraded verdict to uncertain.`,
      rewritten,
      detail: { missingIds: missing, originalStatus: verdict.status },
    };
  };
}
