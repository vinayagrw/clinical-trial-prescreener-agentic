/*
 * F6 demo fixtures — canned full-record eligibility assessments.
 *
 * Used by the demo provider when `featureKey === "f6.assessEligibility"`.
 * Shape matches `EligibilityAssessmentSchema` from `lib/ai/schemas.ts`.
 *
 * The primary fixture covers the Angela Brooks (patient-001) × LU-021
 * (trial-001) pair, which is the default pitch scenario. A minimal
 * fallback is returned for any other combination.
 */

import type { EligibilityAssessment } from "../../schemas.ts";

// ---------------------------------------------------------------------------
// Primary fixture — Angela Brooks × LU-021 NSCLC trial
// ---------------------------------------------------------------------------

const F6_PATIENT001_TRIAL001: EligibilityAssessment = {
  patientSummary:
    "52-year-old female with metastatic NSCLC harboring EGFR exon 20 insertion (p.A767_V769dup). Disease progressed on first-line carboplatin/pemetrexed (completed Feb 2026). ECOG PS 1. Indeterminate 4mm right frontal brain lesion under surveillance.",
  trialId: "trial-001",
  overallRecommendation: "requires_review",
  fitScore: 72,
  blockers: [
    "dc-009: Indeterminate brain lesion requires follow-up imaging",
  ],
  rationale:
    "Patient meets most inclusion criteria including confirmed EGFR exon 20 insertion and adequate organ function. Key uncertainty is the indeterminate 4mm brain lesion which may represent early CNS metastasis. Recommend follow-up MRI before final eligibility determination.",
  criterionAssessments: [
    // dc-001 — Histologically confirmed NSCLC
    {
      criterionId: "dc-001",
      label: "Histologically confirmed NSCLC",
      type: "inclusion",
      status: "pass",
      reasoning:
        "Pathology report from Jan 14, 2026 confirms pulmonary adenocarcinoma, moderately differentiated. TTF-1 positive, CK7 positive, Napsin-A positive — consistent with primary lung adenocarcinoma.",
      citations: [
        {
          evidenceId: "record-section-1",
          source: "Pathology Report",
          sourceDate: "2026-01-14",
          excerpt:
            "Diagnosis: Pulmonary adenocarcinoma, moderately differentiated",
        },
      ],
    },
    // dc-002 — EGFR exon 20 insertion
    {
      criterionId: "dc-002",
      label: "EGFR exon 20 insertion",
      type: "inclusion",
      status: "pass",
      reasoning:
        "Tempus xT genomic profiling from Jan 28, 2026 confirms EGFR exon 20 insertion (p.A767_V769dup). This is the targetable alteration required by the protocol.",
      citations: [
        {
          evidenceId: "record-section-2",
          source: "Genomic Profiling — Tempus xT",
          sourceDate: "2026-01-28",
          excerpt:
            "EGFR exon 20 insertion (p.A767_V769dup) — DETECTED",
        },
      ],
    },
    // dc-003 — Age ≥ 18
    {
      criterionId: "dc-003",
      label: "Age ≥ 18",
      type: "inclusion",
      status: "pass",
      reasoning:
        "Patient is 52 years old, exceeding the minimum age requirement of 18.",
      citations: [
        {
          evidenceId: "record-section-0",
          source: "Demographics",
          sourceDate: "2026-04-10",
          excerpt: "Age: 52",
        },
      ],
    },
    // dc-004 — ECOG ≤ 2
    {
      criterionId: "dc-004",
      label: "ECOG ≤ 2",
      type: "inclusion",
      status: "pass",
      reasoning:
        "ECOG Performance Status is 1 per the most recent progress note from Apr 10, 2026.",
      citations: [
        {
          evidenceId: "record-section-4",
          source: "Progress Note — Thoracic Oncology",
          sourceDate: "2026-04-10",
          excerpt: "ECOG Performance Status: 1",
        },
      ],
    },
    // dc-005 — Adequate organ function (with fuzzyResolution)
    {
      criterionId: "dc-005",
      label: "Adequate organ function",
      type: "inclusion",
      status: "pass",
      reasoning:
        "All key lab values from April 8, 2026 meet standard organ function thresholds. ANC 2,180/μL (≥1,500), Platelets 189K/μL (≥100K), Hemoglobin 11.8 g/dL (≥9.0), Creatinine 0.9 mg/dL (≤1.8), Bilirubin 0.6 mg/dL (≤1.8), AST 28 U/L (≤105), ALT 32 U/L (≤105).",
      citations: [
        {
          evidenceId: "record-section-0",
          source: "Laboratory Results",
          sourceDate: "2026-04-08",
          excerpt:
            "ANC: 2,180/μL, Platelets: 189 K/μL, Hemoglobin: 11.8 g/dL, Creatinine: 0.9 mg/dL, Total Bilirubin: 0.6 mg/dL, AST: 28 U/L, ALT: 32 U/L",
        },
      ],
      fuzzyResolution: {
        originalText: "Adequate organ function",
        resolvedThreshold:
          "Standard oncology thresholds: ANC ≥ 1500, Plt ≥ 100K, Hgb ≥ 9.0, Cr ≤ 1.8, Bili ≤ 1.8, AST/ALT ≤ 105",
        labValuesUsed: [
          { name: "ANC", value: 2180, unit: "/μL", meetsThreshold: true },
          { name: "Platelets", value: 189000, unit: "/μL", meetsThreshold: true },
          { name: "Hemoglobin", value: 11.8, unit: "g/dL", meetsThreshold: true },
          { name: "Creatinine", value: 0.9, unit: "mg/dL", meetsThreshold: true },
          { name: "Total Bilirubin", value: 0.6, unit: "mg/dL", meetsThreshold: true },
          { name: "AST", value: 28, unit: "U/L", meetsThreshold: true },
          { name: "ALT", value: 32, unit: "U/L", meetsThreshold: true },
        ],
      },
    },
    // dc-006 — Prior systemic therapy
    {
      criterionId: "dc-006",
      label: "Prior systemic therapy",
      type: "inclusion",
      status: "pass",
      reasoning:
        "Patient completed 4 cycles of carboplatin/pemetrexed (Nov 2025 – Feb 2026) as first-line therapy with subsequent disease progression.",
      citations: [
        {
          evidenceId: "record-section-4",
          source: "Progress Note",
          sourceDate: "2026-04-10",
          excerpt: "completing 4 cycles of carboplatin/pemetrexed",
        },
      ],
    },
    // dc-007 — Measurable disease per RECIST
    {
      criterionId: "dc-007",
      label: "Measurable disease per RECIST",
      type: "inclusion",
      status: "pass",
      reasoning:
        "CT chest from Mar 28, 2026 shows right lower lobe mass measuring 4.1 cm, which exceeds the RECIST 1.1 threshold of 10mm for measurable disease.",
      citations: [
        {
          evidenceId: "record-section-4",
          source: "Progress Note — Imaging",
          sourceDate: "2026-03-28",
          excerpt:
            "progressive right lower lobe mass (3.2 cm → 4.1 cm)",
        },
      ],
    },
    // dc-008 — Washout from prior therapy ≥ 28 days (with temporalAnalysis)
    {
      criterionId: "dc-008",
      label: "Washout from prior therapy ≥ 28 days",
      type: "inclusion",
      status: "pass",
      reasoning:
        "Last dose of carboplatin/pemetrexed was in February 2026. Using Feb 28, 2026 as the last dose date, the interval to screening date Apr 16, 2026 is 47 days, exceeding the 28-day washout requirement.",
      citations: [
        {
          evidenceId: "record-section-0",
          source: "Medications",
          sourceDate: "2026-02-28",
          excerpt:
            "Carboplatin AUC 5 IV — COMPLETED (Nov 2025 – Feb 2026)",
        },
      ],
      temporalAnalysis: {
        relevantDate: "2026-02-28",
        referenceDate: "2026-04-16",
        intervalDays: 47,
        windowDays: 28,
        withinWindow: false,
        arithmetic:
          "Last dose: 2026-02-28. Screening: 2026-04-16. Interval: 47 days. Required washout: ≥ 28 days. 47 ≥ 28 → PASS.",
      },
    },
    // dc-009 — No active brain metastases (with negationAnalysis)
    {
      criterionId: "dc-009",
      label: "No active brain metastases",
      type: "exclusion",
      status: "uncertain",
      reasoning:
        "Brain MRI from Mar 30, 2026 shows an indeterminate 4mm enhancing focus in the right frontal lobe. The radiologist could not definitively characterize it as metastatic vs. vascular artifact. Follow-up MRI recommended in 6 weeks.",
      citations: [
        {
          evidenceId: "record-section-3",
          source: "MRI Brain Report",
          sourceDate: "2026-03-30",
          excerpt:
            "New indeterminate 4mm enhancing focus, right frontal lobe. Cannot definitively characterize as metastatic disease versus artifact",
        },
      ],
      uncertaintyReason: "protocol_ambiguity",
      negationAnalysis: {
        assertionStatus: "possible",
        rawPhrase:
          "indeterminate 4mm enhancing focus... Cannot definitively characterize as metastatic disease versus artifact",
        confidence: "medium",
      },
    },
    // dc-010 — No prior EGFR exon 20 targeted therapy (with negationAnalysis)
    {
      criterionId: "dc-010",
      label: "No prior EGFR exon 20 targeted therapy",
      type: "exclusion",
      status: "pass",
      reasoning:
        "Medication list shows only carboplatin/pemetrexed as prior systemic therapy. No EGFR exon 20-targeted agents (mobocertinib, amivantamab) appear in the record.",
      citations: [
        {
          evidenceId: "record-section-0",
          source: "Medications",
          sourceDate: "2026-04-10",
          excerpt:
            "Carboplatin AUC 5 IV — COMPLETED, Pemetrexed 500 mg/m² IV — COMPLETED",
        },
      ],
      negationAnalysis: {
        assertionStatus: "negated",
        rawPhrase:
          "No EGFR exon 20-targeted therapy in medication list",
        confidence: "high",
      },
    },
    // dc-011 — No active autoimmune disease
    {
      criterionId: "dc-011",
      label: "No active autoimmune disease",
      type: "exclusion",
      status: "pass",
      reasoning:
        "Problem list contains no autoimmune conditions. No mention of autoimmune disease, lupus, rheumatoid arthritis, or similar conditions anywhere in the clinical record.",
      citations: [
        {
          evidenceId: "record-section-0",
          source: "Problem List",
          sourceDate: "2026-04-10",
          excerpt:
            "1. C34.90 — Malignant neoplasm of lung. 2. C79.31 — Secondary malignant neoplasm of brain. 3. Z85.118 — Personal history of malignant neoplasm",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Fallback — minimal assessment for unrecognised patient/trial combos
// ---------------------------------------------------------------------------

const F6_FALLBACK: EligibilityAssessment = {
  patientSummary: "Insufficient data for full assessment.",
  trialId: "unknown",
  overallRecommendation: "requires_review",
  fitScore: 50,
  blockers: [],
  rationale:
    "Unable to perform full assessment with available data. Manual review required.",
  criterionAssessments: [
    {
      criterionId: "dc-000",
      label: "Overall Assessment",
      type: "inclusion",
      status: "manual_review",
      reasoning:
        "Insufficient data for automated assessment. Coordinator review required.",
      citations: [],
      uncertaintyReason: "missing_domain",
    },
  ],
};

// ---------------------------------------------------------------------------
// Public picker
// ---------------------------------------------------------------------------

/**
 * Select the appropriate F6 fixture based on the user prompt.
 *
 * Returns the detailed Angela Brooks × LU-021 assessment when both
 * `patient-001` and `trial-001` appear in the prompt; otherwise returns
 * a minimal fallback.
 */
export function pickF6Fixture(userPrompt: string): EligibilityAssessment {
  const lower = userPrompt.toLowerCase();
  if (lower.includes("patient-001") && lower.includes("trial-001")) {
    return F6_PATIENT001_TRIAL001;
  }
  return F6_FALLBACK;
}
