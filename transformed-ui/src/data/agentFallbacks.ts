// Canned fallback responses used when the live Claude call fails or the
// API key is missing. Each entry matches a scripted demo question by
// substring (case-insensitive). Fallbacks are shaped to be indistinguishable
// from a live response — same citations, same table, same confidenceNote.
//
// These are intentionally grounded on the Angela Brooks / LU-021 mock data.

import type { AgentCitation, AgentTableData } from "../types/extended";

export interface FallbackResponse {
  id: string;
  keywords: string[];
  content: string;
  table?: AgentTableData;
  citations?: AgentCitation[];
  confidenceNote?: string;
}

export const agentFallbacks: FallbackResponse[] = [
  // Wow #1 scripted question — cardiac / MI exclusion walk-through
  {
    id: "fallback-cardiac",
    keywords: [
      "cardiac",
      "mi ",
      "nstemi",
      "myocardial",
      "heart",
      "exclusion timeline",
      "why the cardiac",
      "152",
      "180",
    ],
    content:
      "Angela Brooks had an **NSTEMI on November 5, 2025** at Lakeside General Hospital [cite:evidence-005]. Trial LU-021 v4.2 §5.3 excludes patients with myocardial infarction within **6 months (180 days)** of screening.\n\nThe planned screening date of **April 6, 2026** is **152 days** after the event — **28 days inside** the 6-month exclusion window, so criterion-003 is currently marked **fail** [cite:evidence-006].\n\nCardiology follow-up on Jan 12, 2026 showed stable recovery with no recurrent chest pain [cite:evidence-006], but LU-021 v4.2 contains **no borderline exemption** for cases inside the lookback. If pursuing, escalate to Dr. Shah with this bundle and request PI interpretation.",
    table: {
      headers: ["EVENT", "DATE", "DAYS TO SCREENING", "THRESHOLD"],
      rows: [
        ["NSTEMI admission", "Nov 5, 2025", "152 days", "180 days required"],
        ["Cardiology follow-up", "Jan 12, 2026", "84 days", "—"],
        ["Planned screening", "Apr 6, 2026", "0 (today)", "—"],
        ["Exclusion window ends", "May 4, 2026", "28 days from now", "180 days from event"],
      ],
    },
    citations: [
      {
        id: "evidence-005",
        label: "Lakeside General Discharge Summary",
        sourceDate: "Nov 5, 2025",
        tone: "supporting",
      },
      {
        id: "evidence-006",
        label: "Cardiology Office Note",
        sourceDate: "Jan 12, 2026",
        tone: "context",
      },
    ],
    confidenceNote:
      "High confidence. Dates are deterministic from structured outside records. Recommended action: PI escalation for exemption review (no automatic waiver available).",
  },

  // Wow #1 scripted question — CNS contradiction
  {
    id: "fallback-cns",
    keywords: [
      "cns",
      "contradict",
      "conflict",
      "brain",
      "mri",
      "punctate",
      "frontal lobe",
      "criterion 4",
      "criterion-004",
    ],
    content:
      "Two sources disagree on the CNS criterion.\n\nThe **Mar 30, 2026 MRI Brain** reports a new punctate enhancing focus in the right frontal lobe, described as indeterminate but concerning for early metastatic disease [cite:evidence-007]. The **Apr 1, 2026 oncology follow-up note** by Dr. Shah states there is **no active CNS disease requiring therapy** and that the MRI finding will be reviewed at tumor board [cite:evidence-008].\n\nBecause the evidence conflicts, criterion-004 is flagged **uncertain** per policy — I do not adjudicate ambiguous CNS findings. Recommended next action: hold the case in needs_pi_review until tumor board review on Apr 9 resolves the wording conflict.",
    citations: [
      {
        id: "evidence-007",
        label: "MRI Brain with Contrast",
        sourceDate: "Mar 30, 2026",
        tone: "contradicting",
      },
      {
        id: "evidence-008",
        label: "Thoracic Oncology Follow-up",
        sourceDate: "Apr 1, 2026",
        tone: "supporting",
      },
    ],
    confidenceNote:
      "Contradiction between radiology impression and clinical note. Uncertainty is intentional — PI judgment required before any disposition change.",
  },

  // Wow #1 scripted question — draft PI escalation
  {
    id: "fallback-escalation",
    keywords: [
      "draft",
      "escalation",
      "pi summary",
      "handoff",
      "pi packet",
      "escalate",
      "dr. shah",
    ],
    content:
      "**PI escalation packet for Angela Brooks / LU-021**\n\nRequest: PI interpretation required on two open items before the Apr 9 consult.\n\n1. **Cardiac exclusion (criterion-003)** — NSTEMI Nov 5, 2025; screening Apr 6, 2026 → 152 days, which is 28 days inside the 6-month lookback [cite:evidence-005]. Cardiology office note Jan 12 documents stable recovery on dual antiplatelet therapy [cite:evidence-006]. Question: does LU-021 v4.2 §5.3 permit a borderline exemption given stable follow-up?\n\n2. **CNS contradiction (criterion-004)** — MRI Mar 30 describes a new punctate enhancing focus in the right frontal lobe [cite:evidence-007]; Apr 1 oncology note states no active CNS disease [cite:evidence-008]. Question: how should the wording conflict be resolved for eligibility purposes?\n\nSupporting evidence bundle and temporal math are preserved in the audit trail and will attach to the PI handoff when saved.",
    citations: [
      {
        id: "evidence-005",
        label: "Lakeside General Discharge Summary",
        sourceDate: "Nov 5, 2025",
        tone: "supporting",
      },
      {
        id: "evidence-006",
        label: "Cardiology Office Note",
        sourceDate: "Jan 12, 2026",
        tone: "context",
      },
      {
        id: "evidence-007",
        label: "MRI Brain with Contrast",
        sourceDate: "Mar 30, 2026",
        tone: "contradicting",
      },
      {
        id: "evidence-008",
        label: "Thoracic Oncology Follow-up",
        sourceDate: "Apr 1, 2026",
        tone: "supporting",
      },
    ],
    confidenceNote:
      "Draft — ready for coordinator review before sending. Draft never leaves the application without explicit coordinator approval.",
  },

  // Mission Control question — queue-wide blockers
  {
    id: "fallback-queue-blockers",
    keywords: [
      "blockers",
      "queue",
      "main blockers",
      "action in the next",
      "need action",
      "who has been waiting",
      "changed overnight",
      "overnight",
    ],
    content:
      "Across your active queue today the dominant blockers are **temporal exclusions** and **missing outside records**, not scientific fit.\n\nAngela Brooks is the most urgent: a rescreen fired at 7:14 AM after an outside cardiology discharge summary imported overnight, flipping criterion-003 from uncertain to fail [cite:evidence-005]. A second MRI wording conflict on criterion-004 remains open [cite:evidence-007]. Robert Hale is blocked on missing outside pathology and a stale activation feed on GI-118. Diane Foster is the only match ready for outreach today — fresh CBC on Apr 1 cleared the last lab-window blocker [cite:evidence-009].",
    table: {
      headers: ["BLOCKER TYPE", "PATIENTS AFFECTED", "STATUS"],
      rows: [
        ["MI within 6 months (temporal)", "1", "Fail — 28 days short"],
        ["CNS disease wording conflict", "1", "Uncertain — PI review pending"],
        ["Missing outside pathology", "1", "Blocked — awaiting document"],
        ["Trial activation unverified", "1", "Blocked — feed stale 19h"],
        ["Manual-only PI judgment", "1", "Expected human review"],
      ],
    },
    citations: [
      {
        id: "evidence-005",
        label: "Lakeside General Discharge Summary",
        sourceDate: "Nov 5, 2025",
        tone: "supporting",
      },
      {
        id: "evidence-007",
        label: "MRI Brain with Contrast",
        sourceDate: "Mar 30, 2026",
        tone: "contradicting",
      },
      {
        id: "evidence-009",
        label: "CBC with Differential",
        sourceDate: "Apr 1, 2026",
        tone: "supporting",
      },
    ],
    confidenceNote:
      "Based on 10 evidence sources across 4 patient-trial matches. 2 sources conflict on CNS disease status — see Angela Brooks deep review.",
  },
];

// Generic fallback when nothing matches — still plausible, still grounded.
export const genericFallback: FallbackResponse = {
  id: "fallback-generic",
  keywords: [],
  content:
    "I can answer questions grounded in the evidence on screen — patient charts, trial protocols, criterion assessments, and the audit trail. Try asking about a specific criterion, a temporal exclusion, a contradiction between sources, or what changed overnight. For the current case, the two open items are the cardiac exclusion (criterion-003) and the CNS wording conflict (criterion-004).",
};

/**
 * Lookup a fallback response by substring-matching the user query against
 * each fallback's keywords. Returns the first match, or the generic fallback.
 */
export function lookupFallback(query: string): FallbackResponse {
  const q = query.toLowerCase();
  for (const fb of agentFallbacks) {
    if (fb.keywords.some((kw) => q.includes(kw.toLowerCase()))) {
      return fb;
    }
  }
  return genericFallback;
}
