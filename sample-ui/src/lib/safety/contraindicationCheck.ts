/*
 * contraindicationCheck — hardcoded drug/condition contraindication map.
 *
 * Some combinations should never lead to a `pass` verdict even if the
 * structured evidence technically meets the threshold. Example: a patient
 * who's pregnant is contraindicated for cytotoxic chemotherapy regardless of
 * lab values. The hardcoded map is intentionally small and human-maintained
 * — this is not a pharmacology database, it is a guardrail against known
 * catastrophic failures. The dashboard surfaces any hit.
 */

import type { AgentResponse, Verdict } from "../ai/schemas";
import type { SafetyCheck } from "./safetyGuard";

interface ContraindicationEntry {
  /** Case-insensitive substring patterns that must both appear. */
  triggers: string[];
  message: string;
}

const CONTRAINDICATIONS: ContraindicationEntry[] = [
  {
    triggers: ["pregnan", "cytotoxic"],
    message: "Pregnancy + cytotoxic therapy — absolute contraindication.",
  },
  {
    triggers: ["qtc", "methadone"],
    message: "QTc prolongation + QT-prolonging drug (methadone) — requires review.",
  },
  {
    triggers: ["warfarin", "nsaid"],
    message: "Warfarin + NSAID — bleeding risk, requires review.",
  },
  {
    triggers: ["egfr-tki", "interstitial lung"],
    message: "EGFR-TKI + interstitial lung disease — pulmonary toxicity risk.",
  },
];

function scan(text: string): ContraindicationEntry[] {
  const lower = text.toLowerCase();
  return CONTRAINDICATIONS.filter((entry) =>
    entry.triggers.every((t) => lower.includes(t)),
  );
}

export function contraindicationCheckForVerdict(): SafetyCheck<Verdict> {
  return (verdict) => {
    if (verdict.status !== "pass") return null;
    const haystack =
      verdict.reasoning +
      " " +
      verdict.citations.map((c) => c.excerpt).join(" ");
    const hits = scan(haystack);
    if (hits.length === 0) return null;
    const rewritten: Verdict = {
      ...verdict,
      status: "manual_review",
      uncertaintyReason: "conflicting_evidence",
      reasoning:
        verdict.reasoning +
        " [safety] Contraindication detected: " +
        hits.map((h) => h.message).join(" | ") +
        " Verdict demoted to manual_review.",
    };
    return {
      severity: "block",
      mode: "contraindication",
      message: `Contraindication(s) detected: ${hits.map((h) => h.message).join("; ")}`,
      rewritten,
      detail: { hits: hits.map((h) => h.message) },
    };
  };
}

export function contraindicationCheckForAgent(): SafetyCheck<AgentResponse> {
  return (answer) => {
    const haystack =
      answer.answer + " " + answer.citations.map((c) => c.excerpt).join(" ");
    const hits = scan(haystack);
    if (hits.length === 0) return null;
    return {
      severity: "warn",
      mode: "contraindication",
      message: `Agent answer mentions a contraindication: ${hits
        .map((h) => h.message)
        .join("; ")}`,
      detail: { hits: hits.map((h) => h.message) },
    };
  };
}
