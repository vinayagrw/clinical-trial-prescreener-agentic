/*
 * AI features mock data — realistic demo data for the 5 top AI features.
 *
 * Scenario: patient-001 against trial-001 (NCT-CTP-2026-TOR-301), the same match
 * used by the existing review workbench. Every value is fabricated and matches
 * what a production pipeline would emit after ingestion → NLP → evaluation runs.
 */

import type {
  AskAgentFeatureSummary,
  CriterionEvaluationRun,
  ProtocolDecomposition,
  RetrievalRun,
  TemporalReasoningRun,
} from "../types/aiFeatures";

/* ==================================================================
 * F1 — Protocol Criterion Decomposition
 * ================================================================== */

export const mockProtocolDecomposition: ProtocolDecomposition = {
  trialId: "trial-001",
  protocolId: "NCT-CTP-2026-TOR-301",
  protocolTitle:
    "Phase II Study of Novel EGFR-TKI in Previously Treated NSCLC with Actionable Mutations",
  parsedAt: "2026-04-14T06:12:00Z",
  pageCount: 38,
  wallTimeSeconds: 11.7,
  stats: {
    inclusion: 7,
    exclusion: 4,
    deterministic: 6,
    hybrid: 3,
    manual_only: 2,
    flaggedForReview: 1,
  },
  criteria: [
    {
      id: "dc-001",
      label: "Histologically confirmed NSCLC",
      type: "inclusion",
      computability: "deterministic",
      threshold:
        "Histology ∈ {adenocarcinoma, squamous, large-cell, adenosquamous} (ICD-O-3: 8046/3, 8070/3, 8140/3, 8550/3)",
      confidence: "high",
      source: {
        pageRef: "§4.1.1, p.12",
        originalText:
          "Patients must have histologically or cytologically confirmed non-small cell lung cancer (NSCLC) of any subtype (adenocarcinoma, squamous cell carcinoma, large cell carcinoma, or adenosquamous carcinoma).",
      },
      normalizedConcepts: [
        "SNOMED:254637007 Non-small cell lung cancer",
        "ICD-O-3:8046/3 Non-small cell carcinoma",
      ],
    },
    {
      id: "dc-002",
      label: "Actionable EGFR mutation",
      type: "inclusion",
      computability: "deterministic",
      threshold: "EGFR ∈ {exon 19 deletion, L858R, T790M} (HGNC:3236)",
      confidence: "high",
      source: {
        pageRef: "§4.1.2, p.12",
        originalText:
          "Documented EGFR mutation associated with EGFR-TKI sensitivity, including exon 19 deletions, exon 21 L858R, or T790M resistance mutation.",
      },
      normalizedConcepts: [
        "HGNC:3236 EGFR",
        "HGVS:EGFR c.2573T>G (L858R)",
        "HGVS:EGFR exon 19 del",
      ],
    },
    {
      id: "dc-003",
      label: "ECOG 0-1",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ECOG performance status ≤ 1, within 14 days of C1D1",
      confidence: "high",
      source: {
        pageRef: "§4.1.3, p.13",
        originalText:
          "ECOG performance status 0 or 1, documented within 14 days of Cycle 1 Day 1.",
      },
      normalizedConcepts: ["LOINC:89247-1 ECOG performance status"],
    },
    {
      id: "dc-004",
      label: "Measurable disease (RECIST 1.1)",
      type: "inclusion",
      computability: "hybrid",
      threshold:
        "≥ 1 measurable lesion per RECIST 1.1, imaging ≤ 28 days from C1D1",
      confidence: "medium",
      source: {
        pageRef: "§4.1.4, p.13",
        originalText:
          "At least one measurable lesion as defined by RECIST 1.1, with baseline imaging (CT chest/abdomen/pelvis with contrast preferred) performed within 28 days of Cycle 1 Day 1.",
      },
      normalizedConcepts: ["SNOMED:277022003 RECIST"],
      reviewNote:
        "Radiologist confirmation of measurability; image window is hybrid-verified.",
    },
    {
      id: "dc-005",
      label: "ANC ≥ 1500/μL",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ANC ≥ 1500/μL, drawn ≤ 14 days from C1D1",
      confidence: "high",
      source: {
        pageRef: "§4.1.5, p.13",
        originalText:
          "Adequate hematologic function: ANC ≥ 1500/μL, platelets ≥ 100 × 10⁹/L, hemoglobin ≥ 9 g/dL, all within 14 days of enrollment.",
      },
      normalizedConcepts: ["LOINC:26499-4 Absolute neutrophil count"],
      dependsOn: ["dc-006", "dc-007"],
    },
    {
      id: "dc-006",
      label: "Platelets ≥ 100 × 10⁹/L",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Platelets ≥ 100 × 10⁹/L, drawn ≤ 14 days from C1D1",
      confidence: "high",
      source: {
        pageRef: "§4.1.5, p.13",
        originalText:
          "... platelets ≥ 100 × 10⁹/L within 14 days of enrollment ...",
      },
      normalizedConcepts: ["LOINC:26515-7 Platelet count"],
    },
    {
      id: "dc-007",
      label: "Creatinine clearance ≥ 50 mL/min",
      type: "inclusion",
      computability: "deterministic",
      threshold: "CrCl ≥ 50 mL/min (Cockcroft-Gault), drawn ≤ 14 days",
      confidence: "high",
      source: {
        pageRef: "§4.1.6, p.14",
        originalText:
          "Adequate renal function: creatinine clearance ≥ 50 mL/min calculated by Cockcroft-Gault, or serum creatinine ≤ 1.5 × ULN.",
      },
      normalizedConcepts: ["LOINC:2160-0 Creatinine"],
    },
    {
      id: "dc-008",
      label: "No prior EGFR-TKI within 14 days",
      type: "exclusion",
      computability: "hybrid",
      threshold:
        "Last EGFR-TKI dose ≥ 14 days before C1D1 (osimertinib, erlotinib, gefitinib, afatinib)",
      confidence: "medium",
      source: {
        pageRef: "§4.2.1, p.15",
        originalText:
          "No prior therapy with EGFR tyrosine kinase inhibitors within 14 days of Cycle 1 Day 1 (adequate washout required).",
      },
      normalizedConcepts: [
        "RxNorm:1721559 osimertinib",
        "RxNorm:1307014 erlotinib",
        "RxNorm:734497 gefitinib",
      ],
      reviewNote: "Washout dates hybrid-verified against med history + temporal service.",
    },
    {
      id: "dc-009",
      label: "No symptomatic CNS metastases",
      type: "exclusion",
      computability: "hybrid",
      threshold:
        "No symptomatic/untreated CNS mets. Stable asymptomatic mets allowed ≥ 4 wk off steroids.",
      confidence: "medium",
      source: {
        pageRef: "§4.2.2, p.15",
        originalText:
          "Patients with symptomatic CNS metastases are excluded. Patients with stable, asymptomatic, previously treated brain metastases are eligible provided they have been clinically stable for ≥ 4 weeks without steroid use.",
      },
      normalizedConcepts: ["SNOMED:94225008 CNS metastasis"],
      reviewNote: "Symptomatic vs asymptomatic determination requires clinical judgment.",
    },
    {
      id: "dc-010",
      label: "No serious concurrent illness",
      type: "exclusion",
      computability: "manual_only",
      threshold: "PI judgment — any serious concurrent illness impairing participation",
      confidence: "low",
      source: {
        pageRef: "§4.2.3, p.16",
        originalText:
          "Any serious concurrent medical condition that, in the judgment of the investigator, would compromise safety or data integrity.",
      },
      normalizedConcepts: [],
      reviewNote: "PI review only; not automatable.",
    },
    {
      id: "dc-011",
      label: "No active second malignancy",
      type: "exclusion",
      computability: "manual_only",
      threshold: "No active 2nd malignancy requiring therapy (except NMSC or in-situ cervical)",
      confidence: "low",
      source: {
        pageRef: "§4.2.4, p.16",
        originalText:
          "Known active second malignancy requiring concurrent treatment, except non-melanoma skin cancer or adequately treated in situ cervical cancer.",
      },
      normalizedConcepts: [],
      reviewNote: "Manual review; coordinate with patient's other oncologist.",
    },
  ],
};

/* ==================================================================
 * F2 — Hybrid Semantic Evidence Retrieval
 * ================================================================== */

export const mockRetrievalRun: RetrievalRun = {
  id: "retr-001",
  patientId: "patient-001",
  query: {
    criterionId: "dc-005",
    criterionLabel: "ANC ≥ 1500/μL",
    keywordTerms: ["ANC", "absolute neutrophil count", "neutrophils"],
    expandedConcepts: [
      "LOINC:26499-4 (Absolute neutrophil count)",
      "LOINC:751-8 (Neutrophils #)",
      "SNOMED:165517008 (Neutrophil count)",
    ],
    hybridWeights: { bm25: 0.4, embedding: 0.6 },
  },
  wallTimeMs: 47,
  corpusSizeNotes: 12843,
  results: [
    {
      id: "rr-001",
      rank: 1,
      source: "Epic — Lab result",
      sourceSystem: "Epic Hyperspace",
      sourceDate: "2026-04-08",
      author: "CTP Clinical Lab",
      excerpt:
        "CBC with Diff — ANC 2,180/μL (ref 1500-8000), WBC 5.4, Plt 234. Drawn 2026-04-08 09:14, signed 2026-04-08 10:02.",
      highlightSpans: [
        { start: 15, end: 18, term: "ANC" },
        { start: 19, end: 27, term: "2,180/μL" },
      ],
      bm25Score: 0.92,
      embeddingScore: 0.94,
      hybridScore: 0.934,
      rerankerScore: 0.97,
      finalScore: 0.96,
      passesFreshnessGate: true,
    },
    {
      id: "rr-002",
      rank: 2,
      source: "Epic — Oncology note",
      sourceSystem: "Epic Hyperspace",
      sourceDate: "2026-04-10",
      author: "Dr. L. Martinez, Thoracic Oncology",
      excerpt:
        "Patient tolerating prior therapy. Counts recovered: ANC 2.2, plt 234, hgb 12.1. No infectious concerns. Plan to rescreen for clinical trial next week.",
      highlightSpans: [
        { start: 51, end: 54, term: "ANC" },
        { start: 55, end: 58, term: "2.2" },
      ],
      bm25Score: 0.74,
      embeddingScore: 0.88,
      hybridScore: 0.824,
      rerankerScore: 0.91,
      finalScore: 0.88,
      passesFreshnessGate: true,
    },
    {
      id: "rr-003",
      rank: 3,
      source: "Epic — Infusion visit",
      sourceSystem: "Epic Hyperspace",
      sourceDate: "2026-03-22",
      author: "Infusion center",
      excerpt:
        "Pre-treatment labs within range. ANC 1,920, platelets 178. Patient cleared for infusion.",
      highlightSpans: [
        { start: 33, end: 36, term: "ANC" },
        { start: 37, end: 42, term: "1,920" },
      ],
      bm25Score: 0.81,
      embeddingScore: 0.72,
      hybridScore: 0.756,
      rerankerScore: 0.68,
      finalScore: 0.71,
      passesFreshnessGate: false,
    },
    {
      id: "rr-004",
      rank: 4,
      source: "Outside records — St Mary's",
      sourceSystem: "Outside records ingest",
      sourceDate: "2025-12-18",
      author: "St Mary's Hematology",
      excerpt:
        "Hematology consult. Baseline counts: WBC 6.2, neutrophils 4.1, platelets 210. No prior thrombocytopenia or neutropenia.",
      highlightSpans: [
        { start: 49, end: 60, term: "neutrophils" },
        { start: 61, end: 64, term: "4.1" },
      ],
      bm25Score: 0.66,
      embeddingScore: 0.79,
      hybridScore: 0.738,
      rerankerScore: 0.52,
      finalScore: 0.61,
      passesFreshnessGate: false,
    },
    {
      id: "rr-005",
      rank: 5,
      source: "Epic — Triage note",
      sourceSystem: "Epic Hyperspace",
      sourceDate: "2026-04-12",
      author: "RN Triage",
      excerpt:
        "Patient called re scheduling. No acute issues. Neutropenia precautions still in place from prior cycle; next CBC tomorrow.",
      highlightSpans: [{ start: 56, end: 67, term: "Neutropenia" }],
      bm25Score: 0.42,
      embeddingScore: 0.61,
      hybridScore: 0.534,
      rerankerScore: 0.38,
      finalScore: 0.44,
      passesFreshnessGate: true,
    },
  ],
};

/* ==================================================================
 * F3 — Criterion-Level Evaluation Matrix
 * ================================================================== */

export const mockEvaluationRun: CriterionEvaluationRun = {
  matchId: "match-001",
  patientId: "patient-001",
  trialId: "trial-001",
  evaluatedAt: "2026-04-14T06:18:00Z",
  stats: {
    pass: 6,
    fail: 1,
    uncertain: 2,
    manual_review: 2,
    biasToUncertainCount: 2,
  },
  entries: [
    {
      id: "eval-dc-001",
      label: "Histologically confirmed NSCLC",
      bucket: "inclusion",
      status: "pass",
      computability: "deterministic",
      reasoning:
        "Lung adenocarcinoma confirmed by LUL biopsy (2025-11-08). ICD-O-3 code present.",
      citations: [
        {
          evidenceId: "ev-101",
          source: "Path report",
          sourceDate: "2025-11-08",
          excerpt: "Lung adenocarcinoma, poorly differentiated, LUL biopsy.",
        },
      ],
      freshness: "fresh",
      thresholdLabel: "Histology = NSCLC",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: false,
    },
    {
      id: "eval-dc-002",
      label: "Actionable EGFR mutation",
      bucket: "inclusion",
      status: "pass",
      computability: "deterministic",
      reasoning:
        "EGFR exon 19 deletion (c.2235_2249del15) detected at 34% VAF on Caris NGS.",
      citations: [
        {
          evidenceId: "ev-102",
          source: "NGS — Caris",
          sourceDate: "2025-11-14",
          excerpt: "EGFR exon 19 deletion (c.2235_2249del15) detected at 34% VAF.",
        },
      ],
      freshness: "fresh",
      thresholdLabel: "EGFR L858R / ex19 del / T790M",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: false,
    },
    {
      id: "eval-dc-003",
      label: "ECOG 0-1",
      bucket: "inclusion",
      status: "pass",
      computability: "deterministic",
      reasoning:
        "ECOG 1 documented 2026-04-10 (4 days ago) by Dr. Martinez. Within 14-day window.",
      citations: [
        {
          evidenceId: "ev-103",
          source: "Oncology visit",
          sourceDate: "2026-04-10",
          excerpt: "Performance status: ECOG 1. Ambulatory, fatigue limits strenuous activity.",
        },
      ],
      freshness: "fresh",
      thresholdLabel: "ECOG ≤ 1",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: false,
    },
    {
      id: "eval-dc-004",
      label: "Measurable disease (RECIST 1.1)",
      bucket: "inclusion",
      status: "uncertain",
      computability: "hybrid",
      reasoning:
        "Last CT is 2026-03-08 (37 days) — outside the 28-day protocol window. Re-imaging needed.",
      uncertaintyReason: "stale_data",
      citations: [
        {
          evidenceId: "ev-104",
          source: "CT chest/abd/pel",
          sourceDate: "2026-03-08",
          excerpt:
            "LUL mass 3.8 cm (prior 4.1), RUL nodule 1.2 cm. Consistent with treated disease.",
        },
      ],
      freshness: "stale",
      thresholdLabel: "Imaging ≤ 28 days",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: true,
    },
    {
      id: "eval-dc-005",
      label: "ANC ≥ 1500/μL",
      bucket: "inclusion",
      status: "pass",
      computability: "deterministic",
      reasoning:
        "ANC 2,180/μL drawn 2026-04-08 (6 days ago). Within 14-day window, passes threshold.",
      citations: [
        {
          evidenceId: "ev-105",
          source: "CBC with diff",
          sourceDate: "2026-04-08",
          excerpt: "ANC 2,180/μL (ref 1500-8000), WBC 5.4, Plt 234.",
        },
      ],
      freshness: "fresh",
      thresholdLabel: "ANC ≥ 1500/μL",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: false,
    },
    {
      id: "eval-dc-006",
      label: "Platelets ≥ 100 × 10⁹/L",
      bucket: "inclusion",
      status: "pass",
      computability: "deterministic",
      reasoning: "Platelets 234 × 10⁹/L drawn 2026-04-08. Passes threshold.",
      citations: [
        {
          evidenceId: "ev-106",
          source: "CBC with diff",
          sourceDate: "2026-04-08",
          excerpt: "Platelets 234 × 10⁹/L.",
        },
      ],
      freshness: "fresh",
      thresholdLabel: "Plt ≥ 100",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: false,
    },
    {
      id: "eval-dc-007",
      label: "Creatinine clearance ≥ 50 mL/min",
      bucket: "inclusion",
      status: "uncertain",
      computability: "deterministic",
      reasoning:
        "No creatinine within 14-day protocol window. Last value is 25 days old — needs redraw.",
      uncertaintyReason: "missing_domain",
      citations: [
        {
          evidenceId: "ev-107",
          source: "Basic metabolic panel",
          sourceDate: "2026-03-20",
          excerpt: "Creatinine 0.9 mg/dL (prior).",
        },
      ],
      freshness: "stale",
      thresholdLabel: "CrCl ≥ 50 mL/min ≤ 14 days",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: true,
    },
    {
      id: "eval-dc-008",
      label: "No prior EGFR-TKI within 14 days",
      bucket: "exclusion",
      status: "manual_review",
      computability: "hybrid",
      reasoning:
        "Prior osimertinib documented; last dose 2026-04-06. Washout clears 2026-04-20 (6 days from today).",
      uncertaintyReason: "protocol_ambiguity",
      citations: [
        {
          evidenceId: "ev-108",
          source: "Med rec",
          sourceDate: "2026-04-06",
          excerpt: "osimertinib 80 mg daily, last dose 2026-04-06 (discontinued per oncologist).",
        },
      ],
      freshness: "fresh",
      thresholdLabel: "EGFR-TKI washout ≥ 14 days",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: true,
    },
    {
      id: "eval-dc-009",
      label: "No symptomatic CNS metastases",
      bucket: "exclusion",
      status: "manual_review",
      computability: "hybrid",
      reasoning:
        "Prior CNS mets treated with SRS 2025-08-12. No new symptoms but brain MRI is 55 days old.",
      uncertaintyReason: "stale_data",
      citations: [
        {
          evidenceId: "ev-109",
          source: "Brain MRI",
          sourceDate: "2026-02-18",
          excerpt: "Stable post-SRS changes in L frontal lobe. No new enhancing lesions.",
        },
      ],
      freshness: "aging",
      thresholdLabel: "CNS — asymptomatic, stable ≥ 4 wk",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: true,
    },
    {
      id: "eval-dc-010",
      label: "No active second malignancy",
      bucket: "exclusion",
      status: "fail",
      computability: "manual_only",
      reasoning:
        "Active early-stage breast cancer under anastrozole therapy. Outside the NMSC / in-situ cervical exception.",
      citations: [
        {
          evidenceId: "ev-110",
          source: "Breast oncology note",
          sourceDate: "2025-09-15",
          excerpt:
            "Stage I ER+ breast cancer, lumpectomy + adjuvant AI therapy. Currently on anastrozole.",
        },
      ],
      freshness: "aging",
      thresholdLabel: "No active second malignancy",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: true,
    },
    {
      id: "eval-dc-011",
      label: "No serious concurrent illness",
      bucket: "exclusion",
      status: "manual_review",
      computability: "manual_only",
      reasoning: "PI judgment required — no automated verdict possible.",
      citations: [],
      freshness: "fresh",
      thresholdLabel: "PI judgment only",
      lastEvaluatedAt: "2026-04-14T06:18:00Z",
      reviewRequired: true,
    },
  ],
};

/* ==================================================================
 * F4 — Temporal Reasoning & Washout Calculator
 * ================================================================== */

export const mockTemporalRun: TemporalReasoningRun = {
  matchId: "match-001",
  patientId: "patient-001",
  trialId: "trial-001",
  todayIso: "2026-04-14",
  windows: [
    {
      id: "tw-001",
      label: "Prior EGFR-TKI washout",
      startDate: "2026-04-06",
      endDate: "2026-04-20",
      tone: "waiting",
      detail:
        "Last osimertinib dose 2026-04-06. Protocol requires ≥ 14 days washout. Clears 2026-04-20 (6 days from today).",
      daysFromToday: 6,
      computedFrom: ["ev-108"],
    },
    {
      id: "tw-002",
      label: "CNS stability window",
      startDate: "2026-02-18",
      endDate: "2026-03-18",
      tone: "ok",
      detail:
        "4-week stability window after brain MRI 2026-02-18 passed without new CNS symptoms. Satisfies §4.2.2.",
      daysFromToday: -27,
      computedFrom: ["ev-109"],
    },
    {
      id: "tw-003",
      label: "Screening imaging window",
      startDate: "2026-03-17",
      endDate: "2026-04-14",
      tone: "warning",
      detail:
        "Protocol requires imaging ≤ 28 days before C1D1. Last CT is 2026-03-08 — 37 days ago. Re-imaging needed before enrollment.",
      daysFromToday: 0,
      computedFrom: ["ev-104"],
    },
  ],
  labFreshness: [
    {
      id: "lf-001",
      labName: "ANC",
      lastValue: "2,180 /μL",
      lastDrawn: "2026-04-08",
      windowDays: 14,
      freshThrough: "2026-04-22",
      tone: "ok",
      daysUntilStale: 8,
    },
    {
      id: "lf-002",
      labName: "Platelets",
      lastValue: "234 × 10⁹/L",
      lastDrawn: "2026-04-08",
      windowDays: 14,
      freshThrough: "2026-04-22",
      tone: "ok",
      daysUntilStale: 8,
    },
    {
      id: "lf-003",
      labName: "Creatinine",
      lastValue: "0.9 mg/dL (stale)",
      lastDrawn: "2026-03-20",
      windowDays: 14,
      freshThrough: "2026-04-03",
      tone: "blocked",
      daysUntilStale: -11,
    },
    {
      id: "lf-004",
      labName: "LFTs (ALT / AST)",
      lastValue: "ALT 28 / AST 22",
      lastDrawn: "2026-04-08",
      windowDays: 14,
      freshThrough: "2026-04-22",
      tone: "ok",
      daysUntilStale: 8,
    },
  ],
  decision: {
    earliestEnrollmentDate: "2026-04-20",
    windowLabel: "Opens 2026-04-20 (after TKI washout). Closes at next disease progression.",
    blockers: [
      "Prior EGFR-TKI washout clears 2026-04-20 (6 days)",
      "Creatinine must be re-drawn — last value is 25 days old (protocol: ≤ 14 days)",
      "CT imaging must be refreshed — last CT is 37 days old (protocol: ≤ 28 days)",
    ],
    tone: "waiting",
  },
};

/* ==================================================================
 * F5 — Grounded Ask Agent (summary card metadata)
 * ================================================================== */

export const mockAskAgentFeature: AskAgentFeatureSummary = {
  tabs: [
    {
      key: "answer",
      label: "Answer",
      description:
        "Grounded natural-language response scoped to the current patient / trial / queue.",
    },
    {
      key: "evidence",
      label: "Evidence",
      description:
        "Dated, citable spans that back every claim. Never unsupported text.",
    },
    {
      key: "table",
      label: "Table",
      description:
        "Structured pivot over the answer (criterion × status × evidence ref).",
    },
    {
      key: "draft",
      label: "Draft",
      description:
        "Internal outreach brief or coordinator note. Copy, save, attach — never send externally.",
    },
    {
      key: "trace",
      label: "Trace",
      description:
        "Prompt version, model version, retrieval set, and decision path for audit replay.",
    },
  ],
  scopes: [
    {
      route: "/review/:matchId",
      scopeLabel: "This patient and trial",
      examplePrompt: "Why is criterion 7 uncertain?",
    },
    {
      route: "/cockpit",
      scopeLabel: "This queue",
      examplePrompt: "What changed overnight in the thoracic oncology queue?",
    },
    {
      route: "/command-center",
      scopeLabel: "Workspace",
      examplePrompt: "Which trials have the highest uncertain-rate this week?",
    },
    {
      route: "/admin/trials/:trialId",
      scopeLabel: "This trial",
      examplePrompt: "How was criterion 5 normalized from the protocol PDF?",
    },
    {
      route: "/audit/:matchId",
      scopeLabel: "This trace",
      examplePrompt: "Reconstruct the decision path for criterion 8.",
    },
  ],
  guardrails: [
    "Scope-bound by page context — never silently widens",
    "Explain + draft only; no autonomous sends",
    "Every claim carries at least one citation",
    "Prompt pinned, model pinned, one-click rollback",
    "PHI de-identified before leaving the VPC boundary",
  ],
};
