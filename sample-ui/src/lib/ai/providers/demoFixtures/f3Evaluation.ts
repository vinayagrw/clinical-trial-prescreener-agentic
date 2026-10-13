/*
 * F3 demo fixtures — canned per-criterion verdicts.
 *
 * Used by the demo provider when `featureKey === "f3.evaluateCriterion"`.
 * Keyed by criterion id from the F1 decomposition fixture so the F3 view
 * can look up "the right verdict for this criterion" without needing an
 * LLM in demo mode. Each verdict matches `VerdictSchema`.
 *
 * The contents mirror the story on the static mockEvaluationRun:
 * - dc-005 ANC passes
 * - dc-007 Creatinine is uncertain (stale data)
 * - dc-008 Prior EGFR-TKI washout is currently failing (last dose 2026-04-06)
 * - dc-009 Brain mets is manual_review
 * - dc-010 Imaging is uncertain (stale data)
 */

import type { Verdict } from "../../schemas.ts";

export const F3_DEMO_EVALUATIONS: Record<string, Verdict> = {
  "dc-001": {
    status: "pass",
    reasoning:
      "Pathology confirms EGFR L858R NSCLC, stage IIIB, per CTP Pathology 2025-08-22 (ev-113).",
    citations: [
      {
        evidenceId: "ev-113",
        source: "Epic — Pathology",
        sourceDate: "2025-08-22",
        excerpt:
          "Non-small cell lung carcinoma, adenocarcinoma. EGFR mutation detected: L858R exon 21.",
      },
    ],
  },
  "dc-002": {
    status: "pass",
    reasoning:
      "EGFR L858R (exon 21) confirmed on CLIA molecular report 2025-08-22. Meets activating-mutation requirement (ev-113).",
    citations: [
      {
        evidenceId: "ev-113",
        source: "Epic — Pathology",
        sourceDate: "2025-08-22",
        excerpt: "EGFR mutation detected: L858R exon 21. ALK, ROS1, KRAS negative.",
      },
    ],
  },
  "dc-003": {
    status: "pass",
    reasoning: "Most recent vitals document ECOG PS 1 on 2026-04-10 (ev-112).",
    citations: [
      {
        evidenceId: "ev-112",
        source: "Epic — Vitals",
        sourceDate: "2026-04-10",
        excerpt: "BP 128/78, HR 82, SpO2 97%. ECOG PS 1.",
      },
    ],
  },
  "dc-005": {
    status: "pass",
    reasoning:
      "ANC 2,180/μL on 2026-04-08 exceeds the ≥ 1,500 threshold (ev-101). Counts confirmed recovered in oncology note 2026-04-10 (ev-102).",
    citations: [
      {
        evidenceId: "ev-101",
        source: "Epic — Lab result",
        sourceDate: "2026-04-08",
        excerpt:
          "CBC with Diff — ANC 2,180/μL (ref 1500-8000), WBC 5.4, Plt 234.",
      },
      {
        evidenceId: "ev-102",
        source: "Epic — Oncology note",
        sourceDate: "2026-04-10",
        excerpt: "Counts recovered: ANC 2.2, plt 234, hgb 12.1.",
      },
    ],
  },
  "dc-006": {
    status: "pass",
    reasoning:
      "Platelets 234 × 10⁹/L on 2026-04-08 well above the ≥ 100,000/μL threshold (ev-101).",
    citations: [
      {
        evidenceId: "ev-101",
        source: "Epic — Lab result",
        sourceDate: "2026-04-08",
        excerpt: "CBC with Diff — ANC 2,180/μL, WBC 5.4, Plt 234.",
      },
    ],
  },
  "dc-007": {
    status: "uncertain",
    reasoning:
      "Creatinine 0.9 mg/dL is within range but the last draw is 2026-03-20 — 25 days before today (2026-04-14), exceeding the 14-day window. A fresh draw is required before C1D1.",
    citations: [
      {
        evidenceId: "ev-107",
        source: "Epic — Lab result",
        sourceDate: "2026-03-20",
        excerpt: "Creatinine 0.9 mg/dL (ref 0.6-1.2), eGFR 92.",
      },
    ],
    uncertaintyReason: "stale_data",
  },
  "dc-008": {
    status: "fail",
    reasoning:
      "Last osimertinib dose 2026-04-06 (ev-108). Protocol requires ≥ 14 days washout, so this criterion fails until 2026-04-20.",
    citations: [
      {
        evidenceId: "ev-108",
        source: "Epic — Medication administration",
        sourceDate: "2026-04-06",
        excerpt: "Osimertinib 80 mg PO daily — last dose administered 2026-04-06 08:00.",
      },
    ],
  },
  "dc-009": {
    status: "manual_review",
    reasoning:
      "Brain MRI 2026-02-18 shows no intracranial metastases, but the criterion is hybrid and requires coordinator confirmation of symptom-free status and 4-week steroid-free window per §3.2. No active CNS symptoms documented (ev-109, ev-114).",
    citations: [
      {
        evidenceId: "ev-109",
        source: "Epic — MRI brain",
        sourceDate: "2026-02-18",
        excerpt: "No intracranial metastases. No enhancing lesions. CNS stable.",
      },
      {
        evidenceId: "ev-114",
        source: "Epic — Problem list",
        sourceDate: "2026-01-02",
        excerpt: "No active CNS symptoms, no seizures, on no steroids.",
      },
    ],
    uncertaintyReason: "manual_only",
  },
  "dc-010": {
    status: "uncertain",
    reasoning:
      "Last CT chest 2026-03-08 (ev-104) is 37 days before today (2026-04-14), exceeding the 28-day screening window. Re-imaging is required before enrollment.",
    citations: [
      {
        evidenceId: "ev-104",
        source: "Epic — CT chest",
        sourceDate: "2026-03-08",
        excerpt:
          "CT chest with contrast. RUL primary mass stable at 3.2 cm. Stable disease per RECIST 1.1.",
      },
    ],
    uncertaintyReason: "stale_data",
  },
  "dc-011": {
    status: "manual_review",
    reasoning:
      "Criterion is manual_only — requires coordinator and PI judgement. Nursing note 2026-04-11 documents patient counselling and comprehension (ev-125).",
    citations: [
      {
        evidenceId: "ev-125",
        source: "Epic — Nursing note",
        sourceDate: "2026-04-11",
        excerpt:
          "Patient counseled on trial screening process. Patient verbalized understanding.",
      },
    ],
    uncertaintyReason: "manual_only",
  },
};

/** Fallback verdict for criteria we haven't keyed. */
export const F3_DEMO_FALLBACK: Verdict = {
  status: "manual_review",
  reasoning:
    "Demo mode has no canned verdict for this criterion yet. Coordinator review required.",
  citations: [
    {
      evidenceId: "ev-125",
      source: "Epic — Nursing note",
      sourceDate: "2026-04-11",
      excerpt: "Patient counseled on trial screening process.",
    },
  ],
  uncertaintyReason: "manual_only",
};
