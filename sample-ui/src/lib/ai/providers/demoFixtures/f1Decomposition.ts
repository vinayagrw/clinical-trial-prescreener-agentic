/*
 * F1 demo fixture — canned decomposition output.
 *
 * Used by the demo provider when `featureKey === "f1.decomposeProtocol"`.
 * Shape matches `DecompositionResponseSchema` from `lib/ai/schemas.ts`.
 *
 * The content mirrors the story told in `mockProtocolDecomposition`
 * (see `src/data/aiFeaturesData.ts`) so demo mode and static mode produce
 * a consistent pitch. Keyed by a simple protocol-text hash so we can ship
 * multiple variants later without breaking the key space.
 */

import type { DecompositionResponse } from "../../schemas.ts";

export const F1_DEMO_DECOMPOSITION: DecompositionResponse = {
  criteria: [
    {
      id: "dc-001",
      label: "Histologically confirmed NSCLC, Stage IIIB/IV",
      type: "inclusion",
      computability: "hybrid",
      threshold: "NSCLC AJCC Stage IIIB or IV",
      confidence: "high",
      source: {
        pageRef: "§3.1, p.11",
        originalText:
          "Histologically or cytologically confirmed non-small cell lung cancer, AJCC 8th edition Stage IIIB or IV.",
      },
      normalizedConcepts: [
        "SNOMED:254637007 (NSCLC)",
        "AJCC8:Stage IIIB",
        "AJCC8:Stage IV",
      ],
    },
    {
      id: "dc-002",
      label: "EGFR activating mutation (L858R or exon 19 del)",
      type: "inclusion",
      computability: "deterministic",
      threshold: "L858R OR exon 19 deletion, confirmed molecular report",
      confidence: "high",
      source: {
        pageRef: "§3.1, p.11",
        originalText:
          "Documented EGFR activating mutation (exon 19 deletion or L858R) from a CLIA-certified molecular report.",
      },
      normalizedConcepts: ["HGNC:3236 (EGFR)", "HGVS:NM_005228.5:c.2573T>G"],
    },
    {
      id: "dc-003",
      label: "ECOG performance status 0–1",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ECOG PS ≤ 1",
      confidence: "high",
      source: {
        pageRef: "§3.1, p.12",
        originalText: "ECOG performance status of 0 or 1 at screening.",
      },
      normalizedConcepts: ["LOINC:89247-1 (ECOG PS)"],
    },
    {
      id: "dc-004",
      label: "Age ≥ 18 years",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Age ≥ 18",
      confidence: "high",
      source: {
        pageRef: "§3.1, p.11",
        originalText: "Adult patients aged 18 years or older at the time of informed consent.",
      },
      normalizedConcepts: [],
    },
    {
      id: "dc-005",
      label: "ANC ≥ 1500/μL",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ANC ≥ 1,500/μL",
      confidence: "high",
      source: {
        pageRef: "§3.1, p.12",
        originalText: "Absolute neutrophil count ≥ 1500 /μL at screening.",
      },
      normalizedConcepts: [
        "LOINC:26499-4 (Absolute neutrophil count)",
      ],
    },
    {
      id: "dc-006",
      label: "Platelets ≥ 100 × 10⁹/L",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Platelets ≥ 100,000/μL",
      confidence: "high",
      source: {
        pageRef: "§3.1, p.12",
        originalText: "Platelet count ≥ 100,000/μL at screening.",
      },
      normalizedConcepts: ["LOINC:777-3 (Platelets)"],
    },
    {
      id: "dc-007",
      label: "Creatinine ≤ 1.5 × ULN",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Creatinine ≤ 1.5 × ULN within 14 days of C1D1",
      confidence: "high",
      source: {
        pageRef: "§3.1, p.13",
        originalText: "Serum creatinine ≤ 1.5 × institutional upper limit of normal, drawn within 14 days before first dose.",
      },
      normalizedConcepts: ["LOINC:2160-0 (Creatinine serum)"],
    },
    {
      id: "dc-008",
      label: "Prior EGFR-TKI washout ≥ 14 days",
      type: "exclusion",
      computability: "deterministic",
      threshold: "≥ 14 days since last EGFR-TKI dose",
      confidence: "high",
      source: {
        pageRef: "§3.2, p.14",
        originalText: "Any prior EGFR tyrosine kinase inhibitor within 14 days of Cycle 1 Day 1 is prohibited.",
      },
      normalizedConcepts: [
        "SNOMED:429961003 (EGFR TKI)",
        "RxNorm:1721559 (osimertinib)",
      ],
    },
    {
      id: "dc-009",
      label: "No active / symptomatic brain metastases",
      type: "exclusion",
      computability: "hybrid",
      threshold: "Asymptomatic or treated + stable for ≥ 4 weeks",
      confidence: "medium",
      source: {
        pageRef: "§3.2, p.14",
        originalText:
          "Active or symptomatic brain metastases are excluded. Patients with treated brain metastases are eligible if clinically stable for at least 4 weeks without steroids.",
      },
      normalizedConcepts: ["SNOMED:94225008 (Secondary malignant neoplasm of brain)"],
      reviewNote: "Coordinator must confirm 4-week stability window and steroid status.",
    },
    {
      id: "dc-010",
      label: "Screening imaging ≤ 28 days before C1D1",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Baseline CT ≤ 28 days before first dose",
      confidence: "high",
      source: {
        pageRef: "§4.1, p.18",
        originalText: "Baseline tumor imaging must be performed within 28 days before Cycle 1 Day 1.",
      },
      normalizedConcepts: ["LOINC:30746-2 (CT chest with contrast)"],
    },
    {
      id: "dc-011",
      label: "Investigator judgement of clinical appropriateness",
      type: "inclusion",
      computability: "manual_only",
      threshold: "Investigator discretion",
      confidence: "low",
      source: {
        pageRef: "§3.1, p.13",
        originalText:
          "In the investigator's opinion, the patient is clinically appropriate for enrollment and able to comply with study procedures.",
      },
      normalizedConcepts: [],
      reviewNote: "Always requires coordinator + PI sign-off.",
    },
  ],
};

/** Key this fixture by a stable id so the demo provider can look it up. */
export const F1_DEMO_DECOMPOSITION_KEY = "f1.decomposeProtocol:default" as const;
