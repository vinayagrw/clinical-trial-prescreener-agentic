/*
 * F5 demo fixtures — canned Ask Agent answers.
 *
 * The Ask Agent is scope-bound: each scope gets a keyed bank of
 * answer fixtures that the demo provider returns when
 * `featureKey === "f5.askAgent"`. Keyed by scope + a very loose
 * hash of the question so we can cover the most common pitch moments
 * without needing an LLM.
 *
 * The picker in demoProvider falls back to `F5_DEMO_DEFAULT` when no
 * specific match is found.
 */

import type { AgentResponse } from "../../schemas.ts";

export const F5_DEMO_PATIENT_ANC: AgentResponse = {
  answer:
    "ANC is in range. The most recent CBC (2026-04-08) shows ANC 2,180/μL, well above the 1,500/μL threshold in §3.1. No neutropenia concerns currently, though neutropenic precautions are still in place from the prior cycle (triage note 2026-04-12).",
  citations: [
    {
      evidenceId: "ev-101",
      source: "Epic — Lab result",
      sourceDate: "2026-04-08",
      excerpt: "CBC with Diff — ANC 2,180/μL (ref 1500-8000).",
    },
    {
      evidenceId: "ev-106",
      source: "Epic — Triage note",
      sourceDate: "2026-04-12",
      excerpt: "Neutropenia precautions still in place from prior cycle.",
    },
  ],
  groundingStatus: "grounded",
};

export const F5_DEMO_PATIENT_WASHOUT: AgentResponse = {
  answer:
    "The patient cannot enroll until 2026-04-20. Last osimertinib dose was 2026-04-06; the protocol requires ≥ 14 days EGFR-TKI washout (§3.2, p.14). That places earliest enrollment 6 days from today.",
  citations: [
    {
      evidenceId: "ev-108",
      source: "Epic — Medication administration",
      sourceDate: "2026-04-06",
      excerpt: "Osimertinib 80 mg PO daily — last dose administered 2026-04-06 08:00.",
    },
  ],
  groundingStatus: "grounded",
};

export const F5_DEMO_PATIENT_BLOCKERS: AgentResponse = {
  answer:
    "Three blockers are currently keeping this patient out of the trial: (1) EGFR-TKI washout clears 2026-04-20, (2) creatinine last drawn 2026-03-20 is outside the 14-day window and needs a fresh draw, and (3) the screening CT is 37 days old vs a 28-day protocol window and must be re-imaged.",
  citations: [
    {
      evidenceId: "ev-108",
      source: "Epic — Medication administration",
      sourceDate: "2026-04-06",
      excerpt: "Osimertinib 80 mg PO daily — last dose administered 2026-04-06 08:00.",
    },
    {
      evidenceId: "ev-107",
      source: "Epic — Lab result",
      sourceDate: "2026-03-20",
      excerpt: "Creatinine 0.9 mg/dL, eGFR 92.",
    },
    {
      evidenceId: "ev-104",
      source: "Epic — CT chest",
      sourceDate: "2026-03-08",
      excerpt: "CT chest with contrast. Stable disease per RECIST 1.1.",
    },
  ],
  groundingStatus: "grounded",
};

export const F5_DEMO_DEFAULT: AgentResponse = {
  answer:
    "I can only answer questions grounded in the current scope. Rephrase your question against this patient's chart, this trial's protocol, or this match's audit trail, and I'll try again with a citation-backed answer.",
  citations: [
    {
      evidenceId: "ev-125",
      source: "Epic — Nursing note",
      sourceDate: "2026-04-11",
      excerpt: "Patient counseled on trial screening process.",
    },
  ],
  groundingStatus: "partial",
};

/**
 * Pick a fixture based on keyword overlap with the question. Deterministic
 * and fast — no LLM. The picker is intentionally naive so demo mode is
 * predictable for pitch replay.
 */
export function pickF5Fixture(question: string): AgentResponse {
  const q = question.toLowerCase();
  if (/anc|neutro/.test(q)) return F5_DEMO_PATIENT_ANC;
  if (/washout|osimertinib|tki/.test(q)) return F5_DEMO_PATIENT_WASHOUT;
  if (/blocker|why|enroll|earliest|when can/.test(q))
    return F5_DEMO_PATIENT_BLOCKERS;
  return F5_DEMO_DEFAULT;
}
