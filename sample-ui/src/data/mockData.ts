import type {
  AlertItem,
  AuditEvent,
  CriterionAssessment,
  EvidenceSnippet,
  FunnelMetric,
  HeatmapRow,
  MatchContextOption,
  MatchRecommendation,
  NormalizedCriterion,
  Patient,
  PatientOption,
  QueueItem,
  TimelineEvent,
  Trial,
  TrialOption,
  TrialVersion
} from "../types/index.ts";
import {
  getImportedCriteriaForTrial,
  getImportedTrialByTrialId,
  getImportedTrialOptions,
  getImportedTrialVersionsForTrial,
  getScreenableImportedTrialOptions,
} from "../stores/importedTrials.ts";
import {
  getInstitutionalNormalizedCriteriaForTrial,
  getInstitutionalTrialById,
  getInstitutionalTrialOptions,
  getInstitutionalTrialVersionsForTrial,
  getScreenableInstitutionalTrialOptions,
  useInstitutionalTrialsStore,
} from "../stores/institutionalTrials.ts";
import { getPatientById, isPatientVisible } from "../stores/patientCatalog.ts";
import { seedPatients } from "./patientSeedData.ts";

export const alerts: AlertItem[] = [
  {
    id: "alert-001",
    tone: "action",
    title: "Continuous rescreening moved 3 patients to the top of queue",
    detail: "New thoracic oncology notes and one outside cardiology import landed at 7:14 AM.",
    timestamp: "7:18 AM"
  },
  {
    id: "alert-002",
    tone: "warning",
    title: "Trial LU-021 local activation status needs verification",
    detail: "Activation feed has not refreshed in 19 hours. Matching remains read-only.",
    timestamp: "6:42 AM"
  }
];

export const patients: Patient[] = seedPatients;

export const trials: Trial[] = [
  {
    id: "trial-001",
    shortCode: "LU-021",
    title: "Phase 2 EGFR exon20 targeted therapy after platinum failure",
    diseaseArea: "Thoracic Oncology",
    phase: "Phase 2",
    localStatus: "active",
    activationState: "Open to accrual at Clinical Trial Pre-Screener",
    protocolVersion: "Protocol v4.2",
    pi: "Dr. Maya Shah",
    screeningWindow: "Labs within 14 days, cardiac history lookback 6 months",
    releaseState: "Released to pilot queue"
  },
  {
    id: "trial-002",
    shortCode: "GI-118",
    title: "FGFR2 basket study for biliary tract cancers",
    diseaseArea: "GI Oncology",
    phase: "Phase 2",
    localStatus: "review",
    activationState: "Activation under verification",
    protocolVersion: "Protocol v2.1",
    pi: "Dr. Nina Patel",
    screeningWindow: "Central pathology required within 30 days",
    releaseState: "Shadow mode only"
  },
  {
    id: "trial-003",
    shortCode: "BC-077",
    title: "IO combination trial for metastatic TNBC",
    diseaseArea: "Breast Oncology",
    phase: "Phase 1b/2",
    localStatus: "active",
    activationState: "Open with biomarker enrichment arm",
    protocolVersion: "Protocol v3.0",
    pi: "Dr. Elise Warren",
    screeningWindow: "Tissue block plus fresh CBC within 7 days",
    releaseState: "Released to pilot queue"
  },
  {
    id: "trial-004",
    shortCode: "EN-094",
    title: "Phase 2 anti-PD-1 for recurrent MSI-high endometrial cancer",
    diseaseArea: "Gynecologic Oncology",
    phase: "Phase 2",
    localStatus: "active",
    activationState: "Open at Clinical Trial Pre-Screener gynecologic service",
    protocolVersion: "Protocol v1.3",
    pi: "Dr. Rachel Kim",
    screeningWindow: "Labs within 21 days, MSI confirmation required",
    releaseState: "Released to pilot queue"
  },
  {
    id: "trial-005",
    shortCode: "PT-052",
    title: "Pan-tumor basket study for MMR-deficient solid tumors",
    diseaseArea: "Pan-tumor",
    phase: "Phase 2",
    localStatus: "active",
    activationState: "Open to all disease groups",
    protocolVersion: "Protocol v2.0",
    pi: "Dr. Nina Patel",
    screeningWindow: "MMR status within 90 days, labs within 14 days",
    releaseState: "Released to pilot queue"
  }
];

export const queueItems: QueueItem[] = [
  {
    matchId: "match-001",
    patientId: "patient-001",
    trialId: "trial-001",
    priority: "critical",
    urgencyLabel: "Consult in 72h",
    owner: "Lena Ortiz",
    nextStep: "needs_pi_review",
    score: 92,
    trialCount: 3,
    reviewState: "PI review needed",
    lastUpdated: "12 minutes ago",
    flags: ["Temporal exclusion", "Contradiction", "Rescreened"],
    taskModes: ["today", "clinic_prep", "needs_pi_review", "watchlist"],
    whyNow: "New outside cardiology evidence and a same-week consult moved this case to the top.",
    recommendedAction: "Open the PI handoff and preserve the CNS conflict context.",
    storyId: "story-004",
    timeInQueue: "2h 18m",
    changedOvernight: true
  },
  {
    matchId: "match-002",
    patientId: "patient-002",
    trialId: "trial-002",
    priority: "high",
    urgencyLabel: "Outside pathology missing",
    owner: "Avery Quinn",
    nextStep: "protocol_question",
    score: 84,
    trialCount: 2,
    reviewState: "Awaiting document pull",
    lastUpdated: "28 minutes ago",
    flags: ["Missing records", "Activation check"],
    taskModes: ["today", "watchlist"],
    whyNow: "FGFR2 biology is compelling, but action is blocked by missing pathology and a stale site-status check.",
    recommendedAction: "Keep the case on watchlist and route the missing packet to the outside-records team.",
    storyId: "story-003",
    timeInQueue: "1d 3h",
    changedOvernight: false
  },
  {
    matchId: "match-003",
    patientId: "patient-003",
    trialId: "trial-003",
    priority: "high",
    urgencyLabel: "Fresh labs today",
    owner: "Lena Ortiz",
    nextStep: "candidate_for_outreach",
    score: 88,
    trialCount: 2,
    reviewState: "Ready for outreach",
    lastUpdated: "41 minutes ago",
    flags: ["High confidence", "Fast follow-up"],
    taskModes: ["today", "clinic_prep", "ready_for_outreach"],
    whyNow: "Fresh CBC cleared the last lab-window blocker before the next visit.",
    recommendedAction: "Draft the internal outreach brief and lock the coordinator follow-up.",
    storyId: "story-001",
    timeInQueue: "34m",
    changedOvernight: true
  },
  {
    matchId: "match-004",
    patientId: "patient-004",
    trialId: "trial-001",
    priority: "watch",
    urgencyLabel: "Manual-only criterion",
    owner: "Samuel Ross",
    nextStep: "reviewed_not_actionable",
    score: 55,
    trialCount: 1,
    reviewState: "Hold for hematology review",
    lastUpdated: "2 hours ago",
    flags: ["Manual review", "Stale marrow"],
    taskModes: ["watchlist"],
    whyNow: "The case illustrates the manual-only boundary and should not clutter the same-day queue.",
    recommendedAction: "Keep visible on watchlist while the hematology reviewer refreshes the marrow context.",
    storyId: "story-007",
    timeInQueue: "2d 5h",
    changedOvernight: false
  },
  {
    matchId: "match-005a",
    patientId: "patient-005",
    trialId: "trial-004",
    priority: "high",
    urgencyLabel: "Ready for outreach",
    owner: "Lena Ortiz",
    nextStep: "candidate_for_outreach",
    score: 91,
    trialCount: 2,
    reviewState: "Ready for outreach",
    lastUpdated: "18 minutes ago",
    flags: ["High confidence", "MSI confirmed"],
    taskModes: ["today", "ready_for_outreach"],
    whyNow: "MSI-high confirmation via immunohistochemistry landed overnight and cleared the final inclusion gate.",
    recommendedAction: "Draft outreach packet and contact before the Apr 11 visit.",
    storyId: "story-008a",
    timeInQueue: "45m",
    changedOvernight: true
  },
  {
    matchId: "match-005b",
    patientId: "patient-005",
    trialId: "trial-005",
    priority: "moderate",
    urgencyLabel: "Cross-trial backup",
    owner: "Lena Ortiz",
    nextStep: "candidate_for_outreach",
    score: 86,
    trialCount: 2,
    reviewState: "Secondary option noted",
    lastUpdated: "22 minutes ago",
    flags: ["Pan-tumor basket", "Cross-trial match"],
    taskModes: ["clinic_prep", "ready_for_outreach"],
    whyNow: "Pan-tumor MMR-d basket surfaces automatically as an alternate if EN-094 enrollment closes.",
    recommendedAction: "Mention as backup during the Priya outreach conversation.",
    storyId: "story-008b",
    timeInQueue: "45m",
    changedOvernight: false
  },
  {
    matchId: "match-006",
    patientId: "patient-006",
    trialId: "trial-005",
    priority: "watch",
    urgencyLabel: "Outside records pending",
    owner: "Samuel Ross",
    nextStep: "protocol_question",
    score: 42,
    trialCount: 1,
    reviewState: "Incomplete profile",
    lastUpdated: "3 hours ago",
    flags: ["Missing records", "MSI status unknown"],
    taskModes: ["watchlist"],
    whyNow: "Cannot confirm MMR/MSI status until outside pathology lands.",
    recommendedAction: "Continue monitoring and reconfirm after outside records import.",
    storyId: "story-009",
    timeInQueue: "4d 2h",
    changedOvernight: false
  }
];

export const matches: MatchRecommendation[] = [
  {
    id: "match-001",
    patientId: "patient-001",
    trialId: "trial-001",
    recommendation: "uncertain",
    fitScore: 92,
    owner: "Lena Ortiz",
    assignedQueue: "Thoracic Oncology Queue",
    nextStep: "needs_pi_review",
    rationale: "Strong genomic and line-of-therapy fit, but one exclusion criterion remains unresolved because of a recent cardiac event and conflicting CNS language.",
    blockers: ["No MI within 6 months", "Active CNS disease wording conflict"],
    continuousTracking: "Rescreened after outside discharge summary import",
    criterionIds: [
      "criterion-001",
      "criterion-002",
      "criterion-003",
      "criterion-004",
      "criterion-005",
      "criterion-006"
    ],
    auditIds: ["audit-001", "audit-002", "audit-003", "audit-004"],
    whatChangedSinceLastReview: [
      "Outside cardiology discharge summary arrived and converted criterion 003 from uncertain to fail.",
      "MRI conflict remains open after the overnight rescreen.",
      "The case rose into the clinic-prep and PI-review task modes."
    ],
    blockingReasonPrimary:
      "Two blockers remain: one deterministic exclusion and one contradiction that needs PI judgment.",
    nextRecommendedAction:
      "Use the PI handoff packet, then keep the case in internal-only review until the contradiction resolves.",
    handoffStatus: "PI escalation packet prepared for morning huddle",
    unresolvedQuestionCount: 2,
    lastReviewer: "Lena Ortiz",
    evidenceFreshnessSummary:
      "Fresh pathology, genomics, and CBC; outside cardiology packet still incomplete.",
    visitContext: "Thoracic consult in 72 hours with tumor board review pending.",
    watchlistTrigger: "Outside NSTEMI import and MRI wording conflict",
    comparisonRankReason:
      "Best genomic fit in the released thoracic pilot scope, but blocked operationally.",
    missingDomains: ["Tumor board interpretation note", "Full outside cardiology packet"],
    contradictionSummary:
      "MRI wording conflicts with the oncologist's assessment of active CNS disease.",
    managerMetric: "Median PI resolution time",
    taskModes: ["today", "clinic_prep", "needs_pi_review", "watchlist"],
    storyCategory: "PI escalation"
  },
  {
    id: "match-002",
    patientId: "patient-002",
    trialId: "trial-002",
    recommendation: "uncertain",
    fitScore: 84,
    owner: "Avery Quinn",
    assignedQueue: "GI Oncology Queue",
    nextStep: "protocol_question",
    rationale: "Target biomarker is present, but the local activation state and outside pathology timing need confirmation.",
    blockers: ["Central pathology pending", "Activation status verification"],
    continuousTracking: "Watching for pathology upload",
    criterionIds: [
      "criterion-007",
      "criterion-008",
      "criterion-009",
      "criterion-010",
      "criterion-011",
      "criterion-012"
    ],
    auditIds: ["audit-005", "audit-006", "audit-007", "audit-008"],
    whatChangedSinceLastReview: [
      "No new pathology packet landed overnight.",
      "Activation feed remains older than the pilot SLA."
    ],
    blockingReasonPrimary:
      "Operational guardrails, not scientific fit, are holding the case.",
    nextRecommendedAction:
      "Keep the match visible, but do not route to outreach or PI review until the missing packet and activation check clear.",
    handoffStatus: "Waiting on document pull and trial admin confirmation",
    unresolvedQuestionCount: 2,
    lastReviewer: "Avery Quinn",
    evidenceFreshnessSummary:
      "Structured oncology data are current; outside pathology and site-state refresh are not.",
    visitContext: "GI follow-up later this week; no same-day action until records land.",
    watchlistTrigger: "Missing outside pathology",
    comparisonRankReason:
      "Strong biomarker fit but still in shadow mode because activation is not released.",
    missingDomains: ["Outside pathology packet", "Current activation refresh"],
    contradictionSummary: "No contradiction; this is a missing-domain hold.",
    managerMetric: "Outside-record turnaround",
    taskModes: ["today", "watchlist"],
    storyCategory: "Missing data"
  },
  {
    id: "match-003",
    patientId: "patient-003",
    trialId: "trial-003",
    recommendation: "pass",
    fitScore: 88,
    owner: "Lena Ortiz",
    assignedQueue: "Breast Oncology Queue",
    nextStep: "candidate_for_outreach",
    rationale: "High confidence match with fresh labs and no active exclusion criteria.",
    blockers: [],
    continuousTracking: "Stable",
    criterionIds: [
      "criterion-013",
      "criterion-014",
      "criterion-015",
      "criterion-016",
      "criterion-017",
      "criterion-018"
    ],
    auditIds: ["audit-009", "audit-010", "audit-011", "audit-012"],
    whatChangedSinceLastReview: [
      "Fresh CBC cleared the protocol lab window.",
      "The case moved from watchlist to ready_for_outreach."
    ],
    blockingReasonPrimary: "No active blocker remains.",
    nextRecommendedAction:
      "Prepare the outreach brief, keep the evidence bundle attached, and move the case into contacted tracking.",
    handoffStatus: "Coordinator-owned follow-up",
    unresolvedQuestionCount: 0,
    lastReviewer: "Lena Ortiz",
    evidenceFreshnessSummary: "All required evidence domains are fresh for outreach prep.",
    visitContext: "Breast oncology follow-up tomorrow afternoon.",
    watchlistTrigger: "Fresh CBC completed this morning",
    comparisonRankReason: "Strong fit with current release state and no open exclusions.",
    missingDomains: [],
    contradictionSummary: "No active contradiction.",
    managerMetric: "Same-day outreach conversion",
    taskModes: ["today", "clinic_prep", "ready_for_outreach"],
    storyCategory: "Easy match"
  },
  {
    id: "match-004",
    patientId: "patient-004",
    trialId: "trial-001",
    recommendation: "fail",
    fitScore: 55,
    owner: "Samuel Ross",
    assignedQueue: "Hematologic Malignancies Queue",
    nextStep: "reviewed_not_actionable",
    rationale:
      "Marcus surfaced because FLT3-ITD AML overlapped with the released thoracic pilot scope, but the disease-fit criterion fails immediately. The case is held on watchlist so hematology can rescreen after the induction cycle.",
    blockers: [
      "Disease mismatch (AML versus NSCLC)",
      "Recent induction chemotherapy inside 30-day washout",
      "Stale marrow biopsy"
    ],
    continuousTracking: "Monitor for post-induction response and fresh marrow",
    criterionIds: [
      "criterion-019",
      "criterion-020",
      "criterion-021",
      "criterion-022",
      "criterion-023",
      "criterion-024"
    ],
    auditIds: ["audit-013", "audit-014", "audit-015", "audit-016"],
    whatChangedSinceLastReview: [
      "Cycle 2 induction administered Mar 15, 2026 — anchors the 30-day washout window until Apr 14.",
      "Marrow biopsy dated Feb 10, 2026 flagged as stale by freshness monitor.",
      "Case remained in watchlist with no clinical change overnight."
    ],
    blockingReasonPrimary:
      "Disease-fit criterion fails outright, compounded by chemotherapy washout still open.",
    nextRecommendedAction:
      "Keep case in watchlist and rescreen after washout window closes on May 5.",
    handoffStatus: "Hematology reviewer keeping case on watchlist",
    unresolvedQuestionCount: 1,
    lastReviewer: "Samuel Ross",
    evidenceFreshnessSummary: "Recent infusion records are fresh; marrow biopsy is stale.",
    visitContext: "No same-day action while patient is in induction cycle.",
    watchlistTrigger: "Induction chemotherapy inside 30-day washout",
    comparisonRankReason: "Weak operational fit and blocked by a hard disease mismatch.",
    missingDomains: ["Refreshed marrow biopsy", "Post-induction response assessment"],
    contradictionSummary: "No contradiction; this is a hard exclusion by disease type.",
    managerMetric: "Watchlist hygiene — keep inappropriate cases out of the same-day queue",
    taskModes: ["watchlist"],
    storyCategory: "Appropriate watch hold"
  },
  {
    id: "match-005a",
    patientId: "patient-005",
    trialId: "trial-004",
    recommendation: "pass",
    fitScore: 91,
    owner: "Lena Ortiz",
    assignedQueue: "Gynecologic Oncology Queue",
    nextStep: "candidate_for_outreach",
    rationale:
      "MSI-high confirmed via immunohistochemistry and PCR. Disease fit is strong, all inclusion criteria pass with fresh evidence, and no exclusions trigger.",
    blockers: [],
    continuousTracking: "Stable — all labs fresh",
    criterionIds: [
      "criterion-025",
      "criterion-026",
      "criterion-027",
      "criterion-028",
      "criterion-029",
      "criterion-030"
    ],
    auditIds: ["audit-017", "audit-018", "audit-019", "audit-020"],
    whatChangedSinceLastReview: [
      "IHC confirmation of MLH1 loss finalized overnight.",
      "Case rose from watchlist to ready_for_outreach."
    ],
    blockingReasonPrimary: "No active blocker.",
    nextRecommendedAction:
      "Draft outreach packet and contact coordinator before Apr 11 visit.",
    handoffStatus: "Coordinator-owned follow-up",
    unresolvedQuestionCount: 0,
    lastReviewer: "Lena Ortiz",
    evidenceFreshnessSummary: "All required evidence is fresh.",
    visitContext: "Gynecologic oncology follow-up Apr 11 morning.",
    watchlistTrigger: "MSI-high confirmation landed overnight",
    comparisonRankReason: "Strongest fit for EN-094's MSI-high enrichment arm.",
    missingDomains: [],
    contradictionSummary: "No active contradiction.",
    managerMetric: "Same-day outreach conversion",
    taskModes: ["today", "ready_for_outreach"],
    storyCategory: "Cross-trial comparison"
  },
  {
    id: "match-005b",
    patientId: "patient-005",
    trialId: "trial-005",
    recommendation: "pass",
    fitScore: 86,
    owner: "Lena Ortiz",
    assignedQueue: "Gynecologic Oncology Queue",
    nextStep: "candidate_for_outreach",
    rationale:
      "Pan-tumor MMR-deficient basket also accepts MSI-high endometrial. Operational preference is EN-094, but PT-052 remains a strong alternate if that slot closes.",
    blockers: [],
    continuousTracking: "Monitor for EN-094 slot availability",
    criterionIds: [
      "criterion-031",
      "criterion-032",
      "criterion-033",
      "criterion-034",
      "criterion-035"
    ],
    auditIds: ["audit-021", "audit-022", "audit-023", "audit-024"],
    whatChangedSinceLastReview: [
      "Cross-match surfaced when MSI-high status confirmed.",
      "PT-052 offers identical MMR-d logic with broader inclusion."
    ],
    blockingReasonPrimary: "No blocker; secondary to EN-094.",
    nextRecommendedAction: "Mention as backup during outreach conversation.",
    handoffStatus: "Secondary option noted in outreach brief",
    unresolvedQuestionCount: 0,
    lastReviewer: "Lena Ortiz",
    evidenceFreshnessSummary: "Same fresh evidence pool as EN-094 match.",
    visitContext: "Same visit covers both trials.",
    watchlistTrigger: "Cross-trial match surfaced automatically",
    comparisonRankReason: "Second-best fit; rank trails EN-094 on disease-area match.",
    missingDomains: [],
    contradictionSummary: "No active contradiction.",
    managerMetric: "Cross-trial matching coverage",
    taskModes: ["clinic_prep", "ready_for_outreach"],
    storyCategory: "Cross-trial comparison"
  },
  {
    id: "match-006",
    patientId: "patient-006",
    trialId: "trial-005",
    recommendation: "manual_review",
    fitScore: 42,
    owner: "Samuel Ross",
    assignedQueue: "Melanoma Queue",
    nextStep: "protocol_question",
    rationale:
      "Possible fit for the pan-tumor MMR-d basket, but outside pathology and MSI/MMR testing have not landed yet. Cannot finalize without structured evidence.",
    blockers: [
      "Outside pathology missing",
      "MMR/MSI status unknown",
      "Staging incomplete"
    ],
    continuousTracking: "Pending outside records import",
    criterionIds: [
      "criterion-036",
      "criterion-037",
      "criterion-038",
      "criterion-039"
    ],
    auditIds: ["audit-025", "audit-026", "audit-027", "audit-028"],
    whatChangedSinceLastReview: [
      "No new records imported overnight.",
      "Case remains in watchlist with unresolved profile."
    ],
    blockingReasonPrimary: "Missing upstream data blocks evaluation entirely.",
    nextRecommendedAction:
      "Page the outside-records team and hold for a completed profile.",
    handoffStatus: "Waiting on outside document pull",
    unresolvedQuestionCount: 3,
    lastReviewer: "Samuel Ross",
    evidenceFreshnessSummary:
      "Almost all required domains are missing or incomplete.",
    visitContext: "No visit scheduled inside the actionable window.",
    watchlistTrigger: "Incomplete records since initial intake",
    comparisonRankReason:
      "Low confidence because too much data is missing to score.",
    missingDomains: [
      "Outside pathology",
      "Staging assessment",
      "MMR/MSI testing"
    ],
    contradictionSummary: "No contradictions — just missing data.",
    managerMetric: "Outside-record turnaround",
    taskModes: ["watchlist"],
    storyCategory: "Incomplete data hold"
  }
];

export const assessments: CriterionAssessment[] = [
  {
    id: "criterion-001",
    label: "Histologically confirmed metastatic NSCLC with EGFR exon20 insertion",
    bucket: "Disease fit",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Pathology and genomic panel both support disease fit.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Final pathology from CTP plus Tempus genomic report confirm metastatic adenocarcinoma with EGFR exon20 insertion.",
    evidenceIds: ["evidence-001", "evidence-002"],
    thresholdLabel: "Pathology confirmation plus genomic confirmation",
    lastEvaluatedAt: "Apr 6, 2026 | 7:12 AM"
  },
  {
    id: "criterion-002",
    label: "Progressed after platinum-based chemotherapy",
    bucket: "Line of therapy",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "hybrid",
    summary: "Progression documented after carboplatin and pemetrexed.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Oncology note dated Mar 28 documents radiographic progression after 4 cycles of platinum doublet.",
    evidenceIds: ["evidence-003", "evidence-004"],
    thresholdLabel: "Progression after platinum-based chemotherapy",
    lastEvaluatedAt: "Apr 6, 2026 | 7:13 AM"
  },
  {
    id: "criterion-003",
    label: "No myocardial infarction within 6 months before screening",
    bucket: "Temporal exclusion",
    status: "fail",
    confidenceLabel: "Needs reviewer attention",
    computability: "deterministic",
    summary: "Outside discharge summary suggests NSTEMI 153 days before planned screening.",
    reviewRequired: true,
    freshness: "fresh",
    reasoning: "Outside hospitalization on Nov 5, 2025 includes NSTEMI diagnosis. Planned screening date Apr 6, 2026 is within the 6-month exclusion window.",
    evidenceIds: ["evidence-005", "evidence-006"],
    thresholdLabel: "180-day lookback from planned screening date",
    lastEvaluatedAt: "Apr 6, 2026 | 7:14 AM"
  },
  {
    id: "criterion-004",
    label: "No active CNS metastases requiring therapy",
    bucket: "Contradiction",
    status: "uncertain",
    confidenceLabel: "Conflicting chart evidence",
    computability: "hybrid",
    summary: "Oncology note says no active CNS disease, but latest MRI mentions a new punctate enhancing focus.",
    reviewRequired: true,
    freshness: "aging",
    reasoning: "The note and MRI impression disagree on whether the new lesion represents active metastatic disease.",
    unresolvedReason: "Requires PI interpretation of MRI wording versus clinical note context.",
    evidenceIds: ["evidence-007", "evidence-008"],
    thresholdLabel: "No active CNS disease requiring therapy",
    lastEvaluatedAt: "Apr 6, 2026 | 7:15 AM"
  },
  {
    id: "criterion-005",
    label: "Adequate organ function defined as ANC >= 1.5 and platelets >= 100 within 14 days",
    bucket: "Lab threshold",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Latest CBC is within the required screening window and meets thresholds.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "ANC 2.4 and platelets 214 on Apr 1 satisfy protocol thresholds within 14 days.",
    evidenceIds: ["evidence-009"],
    thresholdLabel: "ANC >= 1.5 and platelets >= 100 within 14 days",
    lastEvaluatedAt: "Apr 6, 2026 | 7:12 AM"
  },
  {
    id: "criterion-006",
    label: "Investigator judges patient appropriate for study participation",
    bucket: "Manual-only",
    status: "manual_review",
    confidenceLabel: "Clinical judgment required",
    computability: "manual_only",
    summary: "Performance status and logistics suggest likely fit, but PI judgment remains required.",
    reviewRequired: true,
    freshness: "fresh",
    reasoning: "This criterion is intentionally not auto-scored beyond context support.",
    unresolvedReason: "Manual-only criterion.",
    evidenceIds: ["evidence-010"],
    thresholdLabel: "PI judgment only",
    lastEvaluatedAt: "Apr 6, 2026 | 7:16 AM"
  },
  // --- Robert Hale (match-002, trial-002 GI-118) ---
  {
    id: "criterion-007",
    label: "Advanced cholangiocarcinoma with FGFR2 fusion",
    bucket: "Disease fit",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "FoundationOne report confirms FGFR2-BICC1 fusion in biliary tract cancer.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Outside pathology and on-site genomics both support FGFR2 fusion diagnosis.",
    evidenceIds: ["evidence-011", "evidence-012"],
    thresholdLabel: "Pathology plus molecular confirmation",
    lastEvaluatedAt: "Apr 6, 2026 | 6:48 AM"
  },
  {
    id: "criterion-008",
    label: "ECOG performance status 0 or 1",
    bucket: "Performance status",
    status: "uncertain",
    confidenceLabel: "Stale reference note",
    computability: "hybrid",
    summary: "Most recent ECOG note is 62 days old; fresh assessment required.",
    reviewRequired: true,
    freshness: "stale",
    reasoning: "GI oncology note from Feb 4 2026 records ECOG 1 but has aged past the 30-day demonstration window used for screening.",
    unresolvedReason: "Need a clinic note refresh before trial activation.",
    evidenceIds: ["evidence-013"],
    thresholdLabel: "ECOG <= 1 documented within 30 days",
    lastEvaluatedAt: "Apr 6, 2026 | 6:49 AM"
  },
  {
    id: "criterion-009",
    label: "Adequate hepatic function (bilirubin < 1.5x ULN)",
    bucket: "Lab threshold",
    status: "uncertain",
    confidenceLabel: "Missing evidence",
    computability: "deterministic",
    summary: "No CMP labs available within protocol lookback window.",
    reviewRequired: true,
    freshness: "missing",
    reasoning: "Latest CMP is from Jan 21, 2026 — well outside the 14-day screening window. Cannot confirm bilirubin threshold.",
    unresolvedReason: "Need fresh hepatic panel before eligibility can finalize.",
    evidenceIds: [],
    thresholdLabel: "Bilirubin < 1.5x ULN within 14 days",
    lastEvaluatedAt: "Apr 6, 2026 | 6:50 AM"
  },
  {
    id: "criterion-010",
    label: "No prior FGFR inhibitor therapy",
    bucket: "Line of therapy",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Medication history shows gemcitabine/cisplatin plus pembrolizumab; no FGFR inhibitor exposure.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Beacon infusion records confirm gemcitabine + cisplatin cycles 1-6 and pembrolizumab maintenance only.",
    evidenceIds: ["evidence-014"],
    thresholdLabel: "No prior FGFR-directed therapy",
    lastEvaluatedAt: "Apr 6, 2026 | 6:51 AM"
  },
  {
    id: "criterion-011",
    label: "Biliary stent functional or absent",
    bucket: "Manual-only",
    status: "manual_review",
    confidenceLabel: "Clinical judgment required",
    computability: "manual_only",
    summary: "Interventional radiology note mentions plastic stent placement without functional assessment.",
    reviewRequired: true,
    freshness: "aging",
    reasoning: "IR note dated Feb 26 confirms stent placement but does not describe patency at the time of screening.",
    unresolvedReason: "Need confirmation that stent remains functional before starting targeted therapy.",
    evidenceIds: ["evidence-015"],
    thresholdLabel: "Functional stent or no biliary obstruction",
    lastEvaluatedAt: "Apr 6, 2026 | 6:52 AM"
  },
  {
    id: "criterion-012",
    label: "Life expectancy greater than 3 months",
    bucket: "Manual-only",
    status: "manual_review",
    confidenceLabel: "Clinical judgment required",
    computability: "manual_only",
    summary: "GI oncology prognosis note suggests likely > 6 months; PI judgment required.",
    reviewRequired: true,
    freshness: "aging",
    reasoning: "Treating oncologist's progress note suggests durable disease control; formal prognosis statement pending.",
    unresolvedReason: "Manual-only criterion, await PI attestation.",
    evidenceIds: ["evidence-016"],
    thresholdLabel: "PI judgment — life expectancy > 3 months",
    lastEvaluatedAt: "Apr 6, 2026 | 6:53 AM"
  },
  // --- Diane Foster (match-003, trial-003 BC-077) ---
  {
    id: "criterion-013",
    label: "Metastatic triple-negative breast cancer",
    bucket: "Disease fit",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Pathology and IHC confirm ER/PR/HER2 negative invasive ductal carcinoma with metastatic disease.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Core biopsy report dated Feb 2 plus staging CT confirm metastatic TNBC.",
    evidenceIds: ["evidence-019", "evidence-020"],
    thresholdLabel: "Pathology + stage IV",
    lastEvaluatedAt: "Apr 6, 2026 | 7:02 AM"
  },
  {
    id: "criterion-014",
    label: "Measurable disease per RECIST 1.1",
    bucket: "Disease fit",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "CT chest/abdomen/pelvis documents measurable lung and liver lesions.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Staging CT from Mar 22 shows two target lesions meeting RECIST 1.1 measurability.",
    evidenceIds: ["evidence-021"],
    thresholdLabel: "At least one RECIST-measurable lesion",
    lastEvaluatedAt: "Apr 6, 2026 | 7:03 AM"
  },
  {
    id: "criterion-015",
    label: "PD-L1 CPS >= 10",
    bucket: "Biomarker",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "PD-L1 IHC (22C3 pharmDx) reports CPS 14.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Dako 22C3 pharmDx IHC dated Mar 1 reports CPS 14, exceeding the CPS >= 10 threshold.",
    evidenceIds: ["evidence-022"],
    thresholdLabel: "CPS >= 10 by 22C3 pharmDx",
    lastEvaluatedAt: "Apr 6, 2026 | 7:04 AM"
  },
  {
    id: "criterion-016",
    label: "No prior immune checkpoint inhibitor therapy",
    bucket: "Line of therapy",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Medication history shows neoadjuvant AC-T only, no prior IO exposure.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Beacon records show doxorubicin/cyclophosphamide followed by paclitaxel; no checkpoint inhibitors administered.",
    evidenceIds: ["evidence-023"],
    thresholdLabel: "No prior anti-PD-1/PD-L1 or anti-CTLA-4",
    lastEvaluatedAt: "Apr 6, 2026 | 7:05 AM"
  },
  {
    id: "criterion-017",
    label: "Adequate lab thresholds within 7 days",
    bucket: "Lab threshold",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Fresh CBC and CMP both within protocol thresholds.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "CBC from Apr 5 shows ANC 3.1, platelets 240, hemoglobin 12.4; CMP within normal limits.",
    evidenceIds: ["evidence-024", "evidence-025"],
    thresholdLabel: "ANC >= 1.5, platelets >= 100, hemoglobin >= 9 within 7 days",
    lastEvaluatedAt: "Apr 6, 2026 | 7:06 AM"
  },
  {
    id: "criterion-018",
    label: "ECOG performance status 0 or 1",
    bucket: "Performance status",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "hybrid",
    summary: "Clinic note dated Apr 3 records ECOG 0.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Breast oncology follow-up note dated Apr 3 documents ECOG 0 performance status.",
    evidenceIds: ["evidence-026"],
    thresholdLabel: "ECOG <= 1 documented within 14 days",
    lastEvaluatedAt: "Apr 6, 2026 | 7:07 AM"
  },
  // --- Marcus Green (match-004, trial-001 LU-021 — disease mismatch) ---
  {
    id: "criterion-019",
    label: "Histologically confirmed metastatic NSCLC with EGFR exon20 insertion",
    bucket: "Disease fit",
    status: "fail",
    confidenceLabel: "Hard mismatch",
    computability: "deterministic",
    summary: "Patient diagnosis is relapsed AML, not NSCLC. Disease-fit criterion fails outright.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Pathology confirms relapsed acute myeloid leukemia with FLT3-ITD. LU-021 requires metastatic NSCLC with EGFR exon20 insertion.",
    evidenceIds: ["evidence-029"],
    thresholdLabel: "Metastatic NSCLC + EGFR exon20 insertion",
    lastEvaluatedAt: "Apr 6, 2026 | 6:10 AM"
  },
  {
    id: "criterion-020",
    label: "Progressed after platinum-based chemotherapy",
    bucket: "Line of therapy",
    status: "fail",
    confidenceLabel: "Hard mismatch",
    computability: "hybrid",
    summary: "No platinum-based therapy in history; AML treatment uses cytarabine + anthracycline induction.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Infusion records show 7+3 induction plus FLAG-IDA re-induction; no platinum agents administered.",
    evidenceIds: ["evidence-030"],
    thresholdLabel: "Prior platinum exposure with documented progression",
    lastEvaluatedAt: "Apr 6, 2026 | 6:11 AM"
  },
  {
    id: "criterion-021",
    label: "No myocardial infarction within 6 months before screening",
    bucket: "Temporal exclusion",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "No cardiac events in the documented history.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Problem list and discharge summaries contain no cardiac event flags in the 180-day lookback window.",
    evidenceIds: ["evidence-031"],
    thresholdLabel: "180-day cardiac lookback",
    lastEvaluatedAt: "Apr 6, 2026 | 6:12 AM"
  },
  {
    id: "criterion-022",
    label: "No active CNS metastases requiring therapy",
    bucket: "Contradiction",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "hybrid",
    summary: "AML is not CNS-metastatic in current documentation; LP clear on lumbar puncture.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Lumbar puncture dated Mar 20 reports no blasts in CSF. No imaging concerning for CNS involvement.",
    evidenceIds: ["evidence-032"],
    thresholdLabel: "No active CNS disease requiring therapy",
    lastEvaluatedAt: "Apr 6, 2026 | 6:13 AM"
  },
  {
    id: "criterion-023",
    label: "Adequate organ function within 14 days",
    bucket: "Lab threshold",
    status: "uncertain",
    confidenceLabel: "Stale supporting evidence",
    computability: "deterministic",
    summary: "Latest bone marrow biopsy is 55 days old; cannot confirm current cytopenia profile within 14-day screening window.",
    reviewRequired: true,
    freshness: "stale",
    reasoning: "Marrow biopsy from Feb 10 shows 42% blasts, but no recent peripheral CBC inside the 14-day screening window.",
    unresolvedReason: "Need fresh CBC before organ function can be finalized.",
    evidenceIds: ["evidence-033"],
    thresholdLabel: "ANC >= 1.5 and platelets >= 100 within 14 days",
    lastEvaluatedAt: "Apr 6, 2026 | 6:14 AM"
  },
  {
    id: "criterion-024",
    label: "Investigator judges patient appropriate for study participation",
    bucket: "Manual-only",
    status: "manual_review",
    confidenceLabel: "Clinical judgment required",
    computability: "manual_only",
    summary: "Disease mismatch makes manual review formality-only; PI attestation confirms ineligibility.",
    reviewRequired: true,
    freshness: "fresh",
    reasoning: "PI judgment is structurally required even though earlier deterministic criteria fail.",
    unresolvedReason: "Formal manual-only attestation pending.",
    evidenceIds: [],
    thresholdLabel: "PI judgment only",
    lastEvaluatedAt: "Apr 6, 2026 | 6:15 AM"
  },
  // --- Priya EN-094 (match-005a, trial-004) ---
  {
    id: "criterion-025",
    label: "Histologically confirmed recurrent endometrial adenocarcinoma",
    bucket: "Disease fit",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Pathology from recurrence biopsy confirms endometrial adenocarcinoma, Grade 2.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Core biopsy from Jan 8 2026 confirms recurrent endometrioid adenocarcinoma of the uterus.",
    evidenceIds: ["evidence-037", "evidence-038"],
    thresholdLabel: "Histologic confirmation of recurrence",
    lastEvaluatedAt: "Apr 6, 2026 | 7:40 AM"
  },
  {
    id: "criterion-026",
    label: "MSI-high confirmed by IHC or PCR",
    bucket: "Biomarker",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "MLH1 loss on IHC plus MSI-high status on PCR confirm MSI-H phenotype.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "IHC panel dated Apr 5 shows MLH1 and PMS2 loss. Orthogonal PCR from Mar 18 confirms MSI-high with 4 of 5 markers unstable.",
    evidenceIds: ["evidence-039", "evidence-040"],
    thresholdLabel: "MSI-H by IHC or PCR",
    lastEvaluatedAt: "Apr 6, 2026 | 7:41 AM"
  },
  {
    id: "criterion-027",
    label: "No prior anti-PD-1 or anti-PD-L1 therapy",
    bucket: "Line of therapy",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "No immunotherapy exposure in medication history.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Beacon records list carboplatin/paclitaxel adjuvant only; no checkpoint inhibitors administered.",
    evidenceIds: ["evidence-041"],
    thresholdLabel: "No prior anti-PD-1 / anti-PD-L1",
    lastEvaluatedAt: "Apr 6, 2026 | 7:42 AM"
  },
  {
    id: "criterion-028",
    label: "Adequate organ function within 21 days",
    bucket: "Lab threshold",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "CBC and CMP from Apr 2 meet protocol thresholds comfortably.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "ANC 2.8, platelets 182, hemoglobin 11.8, bilirubin 0.6, creatinine 0.9 on Apr 2 labs.",
    evidenceIds: ["evidence-042"],
    thresholdLabel: "ANC >= 1.5, platelets >= 100, bilirubin < 1.5x ULN within 21 days",
    lastEvaluatedAt: "Apr 6, 2026 | 7:43 AM"
  },
  {
    id: "criterion-029",
    label: "Measurable disease per RECIST 1.1",
    bucket: "Disease fit",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Staging CT reports two pelvic target lesions meeting RECIST measurability.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "CT abdomen/pelvis from Mar 28 documents two target lesions each > 1 cm.",
    evidenceIds: ["evidence-043"],
    thresholdLabel: "At least one RECIST-measurable target lesion",
    lastEvaluatedAt: "Apr 6, 2026 | 7:44 AM"
  },
  {
    id: "criterion-030",
    label: "ECOG performance status 0 or 1",
    bucket: "Performance status",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "hybrid",
    summary: "Gynecologic oncology note dated Apr 1 documents ECOG 1.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Recent clinic note explicitly records ECOG 1 with independent ADLs.",
    evidenceIds: ["evidence-044"],
    thresholdLabel: "ECOG <= 1 within 14 days",
    lastEvaluatedAt: "Apr 6, 2026 | 7:45 AM"
  },
  // --- Priya PT-052 (match-005b, trial-005) ---
  {
    id: "criterion-031",
    label: "MMR-deficient solid tumor confirmed",
    bucket: "Biomarker",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "MLH1/PMS2 loss on IHC satisfies MMR deficiency definition.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Same IHC panel as EN-094 criterion-026 meets PT-052's MMR definition.",
    evidenceIds: ["evidence-039"],
    thresholdLabel: "MMR-deficient by IHC or MSI-high by PCR",
    lastEvaluatedAt: "Apr 6, 2026 | 7:46 AM"
  },
  {
    id: "criterion-032",
    label: "Prior systemic therapy exposure",
    bucket: "Line of therapy",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Carboplatin/paclitaxel adjuvant course completed.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Medication history documents 6 cycles of carboplatin + paclitaxel in adjuvant setting.",
    evidenceIds: ["evidence-041"],
    thresholdLabel: "At least one prior systemic therapy",
    lastEvaluatedAt: "Apr 6, 2026 | 7:47 AM"
  },
  {
    id: "criterion-033",
    label: "No prior anti-PD-1 or anti-PD-L1 therapy",
    bucket: "Line of therapy",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "No immunotherapy exposure — same reference as EN-094 match.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "No checkpoint inhibitors in the Beacon medication record.",
    evidenceIds: ["evidence-041"],
    thresholdLabel: "No prior anti-PD-1 / anti-PD-L1",
    lastEvaluatedAt: "Apr 6, 2026 | 7:48 AM"
  },
  {
    id: "criterion-034",
    label: "Adequate labs within 14 days",
    bucket: "Lab threshold",
    status: "pass",
    confidenceLabel: "High confidence",
    computability: "deterministic",
    summary: "Fresh CBC and CMP from Apr 2 meet the tighter 14-day PT-052 window.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Same labs that satisfy EN-094's 21-day window also satisfy PT-052's 14-day window.",
    evidenceIds: ["evidence-042"],
    thresholdLabel: "ANC >= 1.5, platelets >= 100 within 14 days",
    lastEvaluatedAt: "Apr 6, 2026 | 7:49 AM"
  },
  {
    id: "criterion-035",
    label: "Life expectancy greater than 6 months",
    bucket: "Manual-only",
    status: "pass",
    confidenceLabel: "PI attested",
    computability: "manual_only",
    summary: "Treating oncologist's note attests > 6 month expected survival.",
    reviewRequired: false,
    freshness: "fresh",
    reasoning: "Clinic note dated Apr 1 explicitly documents prognosis > 6 months with current disease burden.",
    evidenceIds: ["evidence-045"],
    thresholdLabel: "PI attestation — life expectancy > 6 months",
    lastEvaluatedAt: "Apr 6, 2026 | 7:50 AM"
  },
  // --- Jordan Rivera (match-006, trial-005 PT-052) ---
  {
    id: "criterion-036",
    label: "MMR-deficient solid tumor confirmed",
    bucket: "Biomarker",
    status: "uncertain",
    confidenceLabel: "MSI testing pending",
    computability: "deterministic",
    summary: "Outside MMR/MSI testing has been ordered but results have not arrived.",
    reviewRequired: true,
    freshness: "missing",
    reasoning: "Referring dermatology practice noted MMR IHC ordered, but the Care Everywhere pull has not yet returned the result.",
    unresolvedReason: "Waiting on outside pathology packet.",
    evidenceIds: ["evidence-047"],
    thresholdLabel: "MMR-deficient by IHC or MSI-high by PCR",
    lastEvaluatedAt: "Apr 6, 2026 | 5:30 AM"
  },
  {
    id: "criterion-037",
    label: "Prior systemic therapy exposure",
    bucket: "Line of therapy",
    status: "manual_review",
    confidenceLabel: "Missing outside records",
    computability: "hybrid",
    summary: "Intake mentions prior BRAF/MEK inhibitor course but no structured record yet.",
    reviewRequired: true,
    freshness: "missing",
    reasoning: "Patient self-reported prior dabrafenib/trametinib but no formal medication record in-system.",
    unresolvedReason: "Need outside oncology records to confirm prior therapy sequence.",
    evidenceIds: ["evidence-048"],
    thresholdLabel: "At least one prior systemic therapy",
    lastEvaluatedAt: "Apr 6, 2026 | 5:31 AM"
  },
  {
    id: "criterion-038",
    label: "No prior anti-PD-1 or anti-PD-L1 therapy",
    bucket: "Line of therapy",
    status: "uncertain",
    confidenceLabel: "Missing outside records",
    computability: "deterministic",
    summary: "Cannot confirm or rule out prior IO exposure without outside medication records.",
    reviewRequired: true,
    freshness: "missing",
    reasoning: "Structured medication record in-house is empty; outside records pending would confirm or exclude prior IO.",
    unresolvedReason: "Same outside-records dependency.",
    evidenceIds: [],
    thresholdLabel: "No prior anti-PD-1 / anti-PD-L1",
    lastEvaluatedAt: "Apr 6, 2026 | 5:32 AM"
  },
  {
    id: "criterion-039",
    label: "Adequate staging assessment within 60 days",
    bucket: "Disease fit",
    status: "uncertain",
    confidenceLabel: "Staging incomplete",
    computability: "hybrid",
    summary: "No in-system staging study; outside imaging has not been retrieved.",
    reviewRequired: true,
    freshness: "missing",
    reasoning: "Outside PET/CT from late February is referenced in intake notes but images are not in PACS yet.",
    unresolvedReason: "Waiting on outside imaging pull.",
    evidenceIds: ["evidence-049"],
    thresholdLabel: "Staging assessment within 60 days",
    lastEvaluatedAt: "Apr 6, 2026 | 5:33 AM"
  }
];

export const evidenceSnippets: EvidenceSnippet[] = [
  {
    id: "evidence-001",
    patientId: "patient-001",
    type: "Pathology",
    sourceDocument: "Final Pathology Report",
    sourceSystem: "Epic Pathology",
    sourceDate: "Jan 14, 2026",
    author: "CTP Pathology",
    excerpt: "Pulmonary adenocarcinoma with metastatic involvement confirmed in pleural biopsy specimen.",
    tone: "supporting",
    criterionIds: ["criterion-001"]
  },
  {
    id: "evidence-002",
    patientId: "patient-001",
    type: "Genomics",
    sourceDocument: "Tempus xT Report",
    sourceSystem: "Tempus",
    sourceDate: "Jan 20, 2026",
    author: "Tempus",
    excerpt: "EGFR exon20 insertion detected. TP53 co-mutation identified. No ALK or ROS1 rearrangement seen.",
    tone: "supporting",
    criterionIds: ["criterion-001"]
  },
  {
    id: "evidence-003",
    patientId: "patient-001",
    type: "Oncology Note",
    sourceDocument: "Thoracic Oncology Follow-up",
    sourceSystem: "Epic Notes",
    sourceDate: "Mar 28, 2026",
    author: "Dr. Maya Shah",
    excerpt: "Restaging confirms progression after carboplatin plus pemetrexed. Discussed trial options at next visit.",
    tone: "supporting",
    criterionIds: ["criterion-002"]
  },
  {
    id: "evidence-004",
    patientId: "patient-001",
    type: "Medication History",
    sourceDocument: "Infusion Administration Record",
    sourceSystem: "Beacon",
    sourceDate: "Feb 26, 2026",
    author: "Infusion Center",
    excerpt: "Cycle 4 carboplatin and pemetrexed administered without dose hold.",
    tone: "context",
    criterionIds: ["criterion-002"]
  },
  {
    id: "evidence-005",
    patientId: "patient-001",
    type: "Outside Record",
    sourceDocument: "Lakeside General Cardiology Discharge Summary",
    sourceSystem: "Care Everywhere",
    sourceDate: "Nov 5, 2025",
    author: "Outside Hospital",
    excerpt: "Hospitalization for NSTEMI. Troponin elevation managed medically; discharged on dual antiplatelet therapy.",
    tone: "supporting",
    criterionIds: ["criterion-003"]
  },
  {
    id: "evidence-006",
    patientId: "patient-001",
    type: "Cardiology Follow-up",
    sourceDocument: "Cardiology Office Note",
    sourceSystem: "Care Everywhere",
    sourceDate: "Jan 12, 2026",
    author: "Outside Cardiology",
    excerpt: "No recurrent chest pain since November hospitalization. Continue aspirin and beta-blocker.",
    tone: "context",
    criterionIds: ["criterion-003"]
  },
  {
    id: "evidence-007",
    patientId: "patient-001",
    type: "MRI Brain",
    sourceDocument: "MRI Brain with Contrast",
    sourceSystem: "Epic Imaging",
    sourceDate: "Mar 30, 2026",
    author: "Radiology",
    excerpt: "New punctate enhancing focus in the right frontal lobe, indeterminate but concerning for early metastatic disease.",
    tone: "contradicting",
    criterionIds: ["criterion-004"]
  },
  {
    id: "evidence-008",
    patientId: "patient-001",
    type: "Oncology Note",
    sourceDocument: "Thoracic Oncology Follow-up",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 1, 2026",
    author: "Dr. Maya Shah",
    excerpt: "No active CNS disease requiring therapy at this time. MRI finding will be reviewed at tumor board.",
    tone: "supporting",
    criterionIds: ["criterion-004"]
  },
  {
    id: "evidence-009",
    patientId: "patient-001",
    type: "Lab Result",
    sourceDocument: "CBC with Differential",
    sourceSystem: "Epic Labs",
    sourceDate: "Apr 1, 2026",
    author: "CTP Core Lab",
    excerpt: "ANC 2.4 K/uL; Platelets 214 K/uL; Hemoglobin 11.2 g/dL.",
    tone: "supporting",
    criterionIds: ["criterion-005"]
  },
  {
    id: "evidence-010",
    patientId: "patient-001",
    type: "Care Coordination",
    sourceDocument: "Research Coordination Note",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 2, 2026",
    author: "Lena Ortiz",
    excerpt: "Patient remains interested in clinical trial options and can return within protocol-required screening window.",
    tone: "context",
    criterionIds: ["criterion-006"]
  },
  // --- Robert Hale (patient-002) ---
  {
    id: "evidence-011",
    patientId: "patient-002",
    type: "Genomics",
    sourceDocument: "FoundationOne CDx Report",
    sourceSystem: "Foundation Medicine",
    sourceDate: "Feb 18, 2026",
    author: "Foundation Medicine",
    excerpt: "FGFR2-BICC1 fusion detected in intrahepatic cholangiocarcinoma specimen. IDH1 wild type. TMB low.",
    tone: "supporting",
    criterionIds: ["criterion-007"],
    freshness: "fresh"
  },
  {
    id: "evidence-012",
    patientId: "patient-002",
    type: "Pathology",
    sourceDocument: "Liver Biopsy Final Report",
    sourceSystem: "Epic Pathology",
    sourceDate: "Jan 22, 2026",
    author: "CTP Pathology",
    excerpt: "Moderately differentiated intrahepatic cholangiocarcinoma; immunohistochemistry consistent with biliary origin.",
    tone: "supporting",
    criterionIds: ["criterion-007"],
    freshness: "fresh"
  },
  {
    id: "evidence-013",
    patientId: "patient-002",
    type: "Oncology Note",
    sourceDocument: "GI Oncology Follow-up",
    sourceSystem: "Epic Notes",
    sourceDate: "Feb 4, 2026",
    author: "Dr. Nina Patel",
    excerpt: "Performance status ECOG 1 on today's visit. Tolerating therapy without new symptoms.",
    tone: "context",
    criterionIds: ["criterion-008"],
    freshness: "stale"
  },
  {
    id: "evidence-014",
    patientId: "patient-002",
    type: "Medication History",
    sourceDocument: "Infusion Administration Record",
    sourceSystem: "Beacon",
    sourceDate: "Mar 15, 2026",
    author: "Infusion Center",
    excerpt: "Cycles 1-6 gemcitabine + cisplatin completed; pembrolizumab maintenance ongoing. No FGFR-directed therapy administered.",
    tone: "supporting",
    criterionIds: ["criterion-010"],
    freshness: "fresh"
  },
  {
    id: "evidence-015",
    patientId: "patient-002",
    type: "Procedure Note",
    sourceDocument: "IR Percutaneous Biliary Stent Placement",
    sourceSystem: "Epic Procedures",
    sourceDate: "Feb 26, 2026",
    author: "Interventional Radiology",
    excerpt: "Plastic biliary stent placed across distal CBD stricture. Bilirubin trending down post-procedure. No reassessment on file since placement.",
    tone: "context",
    criterionIds: ["criterion-011"],
    freshness: "aging"
  },
  {
    id: "evidence-016",
    patientId: "patient-002",
    type: "Oncology Note",
    sourceDocument: "GI Oncology Progress Note",
    sourceSystem: "Epic Notes",
    sourceDate: "Mar 10, 2026",
    author: "Dr. Nina Patel",
    excerpt: "Discussed goals of care; functional status preserved and prognosis likely exceeds 6 months with continued treatment.",
    tone: "context",
    criterionIds: ["criterion-012"],
    freshness: "aging"
  },
  {
    id: "evidence-017",
    patientId: "patient-002",
    type: "Imaging",
    sourceDocument: "CT Abdomen/Pelvis with Contrast",
    sourceSystem: "Epic Imaging",
    sourceDate: "Mar 20, 2026",
    author: "Radiology",
    excerpt: "Stable hepatic metastases; no new foci. Biliary stent in place without obstruction.",
    tone: "supporting",
    criterionIds: ["criterion-007", "criterion-011"],
    freshness: "fresh"
  },
  {
    id: "evidence-018",
    patientId: "patient-002",
    type: "Lab Result",
    sourceDocument: "CMP",
    sourceSystem: "Epic Labs",
    sourceDate: "Jan 21, 2026",
    author: "CTP Core Lab",
    excerpt: "Total bilirubin 0.9 mg/dL, AST 42, ALT 38, alkaline phosphatase 184. Creatinine 0.8 mg/dL.",
    tone: "context",
    criterionIds: ["criterion-009"],
    freshness: "stale"
  },
  // --- Diane Foster (patient-003) ---
  {
    id: "evidence-019",
    patientId: "patient-003",
    type: "Pathology",
    sourceDocument: "Core Needle Biopsy Final Report",
    sourceSystem: "Epic Pathology",
    sourceDate: "Feb 2, 2026",
    author: "CTP Pathology",
    excerpt: "Invasive ductal carcinoma, grade 3. ER 0%, PR 0%, HER2 0 by IHC. Triple-negative phenotype confirmed.",
    tone: "supporting",
    criterionIds: ["criterion-013"],
    freshness: "fresh"
  },
  {
    id: "evidence-020",
    patientId: "patient-003",
    type: "Imaging",
    sourceDocument: "Staging CT Chest/Abdomen/Pelvis",
    sourceSystem: "Epic Imaging",
    sourceDate: "Feb 10, 2026",
    author: "Radiology",
    excerpt: "Multiple hepatic and pulmonary metastases consistent with metastatic breast cancer. No CNS involvement seen on brain MRI.",
    tone: "supporting",
    criterionIds: ["criterion-013"],
    freshness: "fresh"
  },
  {
    id: "evidence-021",
    patientId: "patient-003",
    type: "Imaging",
    sourceDocument: "CT Chest/Abdomen/Pelvis Restaging",
    sourceSystem: "Epic Imaging",
    sourceDate: "Mar 22, 2026",
    author: "Radiology",
    excerpt: "Two target lesions identified per RECIST 1.1: 2.4 cm right lower lobe lung nodule and 3.1 cm segment VIII liver lesion. Both measurable.",
    tone: "supporting",
    criterionIds: ["criterion-014"],
    freshness: "fresh"
  },
  {
    id: "evidence-022",
    patientId: "patient-003",
    type: "Genomics",
    sourceDocument: "PD-L1 IHC 22C3 pharmDx",
    sourceSystem: "Epic Pathology",
    sourceDate: "Mar 1, 2026",
    author: "CTP Pathology",
    excerpt: "PD-L1 expression by CPS methodology: CPS 14. Meets CPS >= 10 eligibility threshold.",
    tone: "supporting",
    criterionIds: ["criterion-015"],
    freshness: "fresh"
  },
  {
    id: "evidence-023",
    patientId: "patient-003",
    type: "Medication History",
    sourceDocument: "Beacon Medication Administration Record",
    sourceSystem: "Beacon",
    sourceDate: "Jan 15, 2026",
    author: "Infusion Center",
    excerpt: "Neoadjuvant AC-T course completed: doxorubicin + cyclophosphamide x4 cycles followed by paclitaxel x12 weekly doses. No immunotherapy in history.",
    tone: "supporting",
    criterionIds: ["criterion-016"],
    freshness: "fresh"
  },
  {
    id: "evidence-024",
    patientId: "patient-003",
    type: "Lab Result",
    sourceDocument: "CBC with Differential",
    sourceSystem: "Epic Labs",
    sourceDate: "Apr 5, 2026",
    author: "CTP Core Lab",
    excerpt: "ANC 3.1 K/uL, platelets 240 K/uL, hemoglobin 12.4 g/dL, WBC 6.8 K/uL.",
    tone: "supporting",
    criterionIds: ["criterion-017"],
    freshness: "fresh"
  },
  {
    id: "evidence-025",
    patientId: "patient-003",
    type: "Lab Result",
    sourceDocument: "CMP",
    sourceSystem: "Epic Labs",
    sourceDate: "Apr 5, 2026",
    author: "CTP Core Lab",
    excerpt: "Total bilirubin 0.5, AST 26, ALT 22, creatinine 0.8, albumin 4.0, alkaline phosphatase 108. All within normal limits.",
    tone: "supporting",
    criterionIds: ["criterion-017"],
    freshness: "fresh"
  },
  {
    id: "evidence-026",
    patientId: "patient-003",
    type: "Oncology Note",
    sourceDocument: "Breast Oncology Follow-up",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 3, 2026",
    author: "Dr. Elise Warren",
    excerpt: "Performance status ECOG 0. Patient fully active, able to carry on all pre-disease activities without restriction.",
    tone: "supporting",
    criterionIds: ["criterion-018"],
    freshness: "fresh"
  },
  {
    id: "evidence-027",
    patientId: "patient-003",
    type: "Care Coordination",
    sourceDocument: "Research Coordination Note",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 5, 2026",
    author: "Lena Ortiz",
    excerpt: "Patient eager to pursue trial; transportation confirmed; signed HIPAA research authorization on file.",
    tone: "context",
    criterionIds: ["criterion-013", "criterion-018"],
    freshness: "fresh"
  },
  {
    id: "evidence-028",
    patientId: "patient-003",
    type: "Social History",
    sourceDocument: "Navigator Intake",
    sourceSystem: "Epic Notes",
    sourceDate: "Mar 18, 2026",
    author: "Oncology Navigation",
    excerpt: "Patient lives 22 miles from CTP clinic, has reliable transportation and strong family support for trial visits.",
    tone: "context",
    criterionIds: ["criterion-013"],
    freshness: "fresh"
  },
  // --- Marcus Green (patient-004) ---
  {
    id: "evidence-029",
    patientId: "patient-004",
    type: "Pathology",
    sourceDocument: "Bone Marrow Biopsy Final Report",
    sourceSystem: "Epic Pathology",
    sourceDate: "Feb 10, 2026",
    author: "CTP Hematopathology",
    excerpt: "Relapsed acute myeloid leukemia, 42% blasts. FLT3-ITD mutation positive, NPM1 mutated. Not consistent with NSCLC.",
    tone: "contradicting",
    criterionIds: ["criterion-019"],
    freshness: "aging"
  },
  {
    id: "evidence-030",
    patientId: "patient-004",
    type: "Medication History",
    sourceDocument: "Infusion Administration Record",
    sourceSystem: "Beacon",
    sourceDate: "Mar 2, 2026",
    author: "Infusion Center",
    excerpt: "Induction: 7+3 (cytarabine + idarubicin) completed Oct 2024. Re-induction: FLAG-IDA completed Feb 2026. No platinum agents ever administered.",
    tone: "contradicting",
    criterionIds: ["criterion-020"],
    freshness: "fresh"
  },
  {
    id: "evidence-031",
    patientId: "patient-004",
    type: "Problem List",
    sourceDocument: "Consolidated Problem List",
    sourceSystem: "Epic",
    sourceDate: "Apr 1, 2026",
    author: "Care Team",
    excerpt: "No cardiac conditions on active or resolved problem list within 180-day lookback window.",
    tone: "supporting",
    criterionIds: ["criterion-021"],
    freshness: "fresh"
  },
  {
    id: "evidence-032",
    patientId: "patient-004",
    type: "Procedure Note",
    sourceDocument: "Diagnostic Lumbar Puncture",
    sourceSystem: "Epic Procedures",
    sourceDate: "Mar 20, 2026",
    author: "Hematology Service",
    excerpt: "CSF cytology negative for leukemic blasts. No evidence of CNS involvement.",
    tone: "supporting",
    criterionIds: ["criterion-022"],
    freshness: "fresh"
  },
  {
    id: "evidence-033",
    patientId: "patient-004",
    type: "Pathology",
    sourceDocument: "Bone Marrow Biopsy",
    sourceSystem: "Epic Pathology",
    sourceDate: "Feb 10, 2026",
    author: "CTP Hematopathology",
    excerpt: "Hypercellular marrow with 42% blasts. No fresh CBC in the 14-day screening window.",
    tone: "context",
    criterionIds: ["criterion-023"],
    freshness: "stale"
  },
  {
    id: "evidence-034",
    patientId: "patient-004",
    type: "Oncology Note",
    sourceDocument: "Hematology Consultation",
    sourceSystem: "Epic Notes",
    sourceDate: "Mar 28, 2026",
    author: "Dr. Hannah Rice",
    excerpt: "Disease mismatch against LU-021 noted; patient clinically prioritized for FLT3-directed watchlist as preferred path.",
    tone: "context",
    criterionIds: ["criterion-019", "criterion-024"],
    freshness: "fresh"
  },
  {
    id: "evidence-035",
    patientId: "patient-004",
    type: "Clinical Trial Note",
    sourceDocument: "Matching Worklog",
    sourceSystem: "Epic Research",
    sourceDate: "Apr 4, 2026",
    author: "Research Coordination",
    excerpt: "LU-021 auto-match created to document disease-fit mismatch. Patient remains on AML-specific watchlist for future FLT3 trials.",
    tone: "context",
    criterionIds: ["criterion-019"],
    freshness: "fresh"
  },
  {
    id: "evidence-036",
    patientId: "patient-004",
    type: "Lab Result",
    sourceDocument: "CBC with Differential",
    sourceSystem: "Epic Labs",
    sourceDate: "Feb 9, 2026",
    author: "CTP Core Lab",
    excerpt: "ANC 0.8 K/uL, platelets 58 K/uL, hemoglobin 8.4 g/dL. Pancytopenic at last measurement.",
    tone: "context",
    criterionIds: ["criterion-023"],
    freshness: "stale"
  },
  // --- Priya Venkataraman-Krishnamurthy (patient-005) ---
  {
    id: "evidence-037",
    patientId: "patient-005",
    type: "Pathology",
    sourceDocument: "Recurrence Biopsy Report",
    sourceSystem: "Epic Pathology",
    sourceDate: "Jan 8, 2026",
    author: "CTP Pathology",
    excerpt: "Recurrent endometrioid adenocarcinoma, grade 2. Morphology and IHC consistent with prior primary.",
    tone: "supporting",
    criterionIds: ["criterion-025"],
    freshness: "fresh"
  },
  {
    id: "evidence-038",
    patientId: "patient-005",
    type: "Pathology",
    sourceDocument: "Initial Hysterectomy Pathology",
    sourceSystem: "Epic Pathology",
    sourceDate: "May 12, 2024",
    author: "CTP Pathology",
    excerpt: "Endometrioid adenocarcinoma of the uterus, grade 2, FIGO stage IIIC1 at initial resection.",
    tone: "supporting",
    criterionIds: ["criterion-025"],
    freshness: "fresh"
  },
  {
    id: "evidence-039",
    patientId: "patient-005",
    type: "Genomics",
    sourceDocument: "MMR IHC Panel",
    sourceSystem: "Epic Pathology",
    sourceDate: "Apr 5, 2026",
    author: "CTP Molecular Pathology",
    excerpt: "MLH1 loss, PMS2 loss, MSH2 retained, MSH6 retained. Consistent with MLH1-promoter hypermethylation pattern. MMR-deficient.",
    tone: "supporting",
    criterionIds: ["criterion-026", "criterion-031"],
    freshness: "fresh"
  },
  {
    id: "evidence-040",
    patientId: "patient-005",
    type: "Genomics",
    sourceDocument: "MSI PCR Assay",
    sourceSystem: "Epic Molecular",
    sourceDate: "Mar 18, 2026",
    author: "CTP Molecular Pathology",
    excerpt: "4 of 5 mononucleotide markers unstable. MSI-High phenotype confirmed by PCR.",
    tone: "supporting",
    criterionIds: ["criterion-026"],
    freshness: "fresh"
  },
  {
    id: "evidence-041",
    patientId: "patient-005",
    type: "Medication History",
    sourceDocument: "Beacon Medication Administration Record",
    sourceSystem: "Beacon",
    sourceDate: "Oct 10, 2024",
    author: "Infusion Center",
    excerpt: "Adjuvant carboplatin AUC 6 + paclitaxel 175 mg/m2 x 6 cycles completed. No immune checkpoint inhibitors administered.",
    tone: "supporting",
    criterionIds: ["criterion-027", "criterion-032", "criterion-033"],
    freshness: "fresh"
  },
  {
    id: "evidence-042",
    patientId: "patient-005",
    type: "Lab Result",
    sourceDocument: "CBC + CMP Panel",
    sourceSystem: "Epic Labs",
    sourceDate: "Apr 2, 2026",
    author: "CTP Core Lab",
    excerpt: "ANC 2.8 K/uL, platelets 182 K/uL, hemoglobin 11.8 g/dL; bilirubin 0.6, creatinine 0.9, AST 24, ALT 20, albumin 3.9.",
    tone: "supporting",
    criterionIds: ["criterion-028", "criterion-034"],
    freshness: "fresh"
  },
  {
    id: "evidence-043",
    patientId: "patient-005",
    type: "Imaging",
    sourceDocument: "CT Abdomen/Pelvis with Contrast",
    sourceSystem: "Epic Imaging",
    sourceDate: "Mar 28, 2026",
    author: "Radiology",
    excerpt: "Two pelvic target lesions (2.1 cm and 1.6 cm) meeting RECIST 1.1 measurability. No new distant disease.",
    tone: "supporting",
    criterionIds: ["criterion-029"],
    freshness: "fresh"
  },
  {
    id: "evidence-044",
    patientId: "patient-005",
    type: "Oncology Note",
    sourceDocument: "Gynecologic Oncology Follow-up",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 1, 2026",
    author: "Dr. Rachel Kim",
    excerpt: "Patient active, independent with all ADLs. Performance status ECOG 1. Motivated to pursue immunotherapy trials.",
    tone: "supporting",
    criterionIds: ["criterion-030"],
    freshness: "fresh"
  },
  {
    id: "evidence-045",
    patientId: "patient-005",
    type: "Oncology Note",
    sourceDocument: "Treatment Planning Note",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 1, 2026",
    author: "Dr. Rachel Kim",
    excerpt: "Estimated survival exceeds 6 months given disease burden and functional status. Candidate for systemic immunotherapy trial enrollment.",
    tone: "supporting",
    criterionIds: ["criterion-035"],
    freshness: "fresh"
  },
  {
    id: "evidence-046",
    patientId: "patient-005",
    type: "Care Coordination",
    sourceDocument: "Research Coordination Note",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 5, 2026",
    author: "Lena Ortiz",
    excerpt: "Matched on both EN-094 (endometrial-specific) and PT-052 (pan-tumor MMR-d). PI preference pending on which to pursue first.",
    tone: "context",
    criterionIds: ["criterion-025", "criterion-031"],
    freshness: "fresh"
  },
  // --- Jordan Rivera (patient-006) ---
  {
    id: "evidence-047",
    patientId: "patient-006",
    type: "Intake Note",
    sourceDocument: "New Patient Intake Summary",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 2, 2026",
    author: "Dr. Thomas Yuan",
    excerpt: "Referred from Northside Dermatology Associates. Patient reports cutaneous melanoma diagnosis 2023 with BRAF V600E. MMR IHC ordered through outside lab; results pending.",
    tone: "context",
    criterionIds: ["criterion-036"],
    freshness: "missing"
  },
  {
    id: "evidence-048",
    patientId: "patient-006",
    type: "Self Report",
    sourceDocument: "Patient-Reported Medication History",
    sourceSystem: "Epic Intake",
    sourceDate: "Apr 2, 2026",
    author: "Intake Nurse",
    excerpt: "Patient states treatment with dabrafenib + trametinib for approximately 10 months before progression. No formal outside records yet in-system.",
    tone: "context",
    criterionIds: ["criterion-037"],
    freshness: "missing"
  },
  {
    id: "evidence-049",
    patientId: "patient-006",
    type: "Intake Note",
    sourceDocument: "Imaging History Request",
    sourceSystem: "Care Everywhere",
    sourceDate: "Apr 3, 2026",
    author: "Records Coordinator",
    excerpt: "Outside PET/CT from Feb 22, 2026 noted in intake. Imaging retrieval requested from referring facility; PACS import pending.",
    tone: "context",
    criterionIds: ["criterion-039"],
    freshness: "missing"
  },
  {
    id: "evidence-050",
    patientId: "patient-006",
    type: "Care Coordination",
    sourceDocument: "Records Request Log",
    sourceSystem: "Epic Notes",
    sourceDate: "Apr 6, 2026",
    author: "Lena Ortiz",
    excerpt: "Outside records packet requested from Northside Dermatology Associates and prior oncologist. Expected delivery within 5 business days.",
    tone: "context",
    criterionIds: ["criterion-036", "criterion-037", "criterion-038"],
    freshness: "missing"
  }
];

export const timelineEvents: TimelineEvent[] = [
  {
    id: "timeline-001",
    patientId: "patient-001",
    date: "Jan 14, 2026",
    title: "Pleural biopsy finalized",
    detail: "Metastatic adenocarcinoma confirmed.",
    tone: "positive"
  },
  {
    id: "timeline-002",
    patientId: "patient-001",
    date: "Jan 20, 2026",
    title: "Tempus xT reported",
    detail: "EGFR exon20 insertion confirmed.",
    tone: "positive"
  },
  {
    id: "timeline-003",
    patientId: "patient-001",
    date: "Feb 26, 2026",
    title: "Completed cycle 4 platinum doublet",
    detail: "Carboplatin and pemetrexed administered.",
    tone: "neutral"
  },
  {
    id: "timeline-004",
    patientId: "patient-001",
    date: "Mar 28, 2026",
    title: "Progression documented",
    detail: "Restaging CT prompted trial review.",
    tone: "warning"
  },
  {
    id: "timeline-005",
    patientId: "patient-001",
    date: "Mar 30, 2026",
    title: "MRI wording conflict",
    detail: "New punctate enhancing focus requires interpretation.",
    tone: "warning"
  },
  {
    id: "timeline-006",
    patientId: "patient-001",
    date: "Apr 1, 2026",
    title: "Fresh CBC available",
    detail: "ANC and platelets within protocol threshold window.",
    tone: "positive"
  },
  {
    id: "timeline-007",
    patientId: "patient-001",
    date: "Nov 5, 2025",
    title: "Outside NSTEMI admission",
    detail: "Potential exclusion event within 6 months of screening.",
    tone: "critical"
  },
  // --- Robert Hale (patient-002) ---
  {
    id: "timeline-008",
    patientId: "patient-002",
    date: "Jan 22, 2026",
    title: "Liver biopsy confirmed cholangiocarcinoma",
    detail: "Intrahepatic cholangiocarcinoma diagnosed on percutaneous biopsy.",
    tone: "neutral"
  },
  {
    id: "timeline-009",
    patientId: "patient-002",
    date: "Feb 4, 2026",
    title: "ECOG 1 documented",
    detail: "Last formal performance status note; now 62 days old.",
    tone: "warning"
  },
  {
    id: "timeline-010",
    patientId: "patient-002",
    date: "Feb 18, 2026",
    title: "FGFR2-BICC1 fusion reported",
    detail: "FoundationOne CDx identifies actionable FGFR2 fusion.",
    tone: "positive"
  },
  {
    id: "timeline-011",
    patientId: "patient-002",
    date: "Feb 26, 2026",
    title: "Biliary stent placed",
    detail: "IR-placed plastic stent across distal CBD stricture.",
    tone: "neutral"
  },
  {
    id: "timeline-012",
    patientId: "patient-002",
    date: "Mar 20, 2026",
    title: "Hepatic metastases stable on CT",
    detail: "Stable disease on restaging imaging.",
    tone: "positive"
  },
  // --- Diane Foster (patient-003) ---
  {
    id: "timeline-013",
    patientId: "patient-003",
    date: "Feb 2, 2026",
    title: "Triple-negative diagnosis confirmed",
    detail: "Core biopsy confirms ER/PR/HER2 negative IDC.",
    tone: "neutral"
  },
  {
    id: "timeline-014",
    patientId: "patient-003",
    date: "Feb 10, 2026",
    title: "Metastatic disease staged",
    detail: "Staging CT shows hepatic and pulmonary metastases.",
    tone: "warning"
  },
  {
    id: "timeline-015",
    patientId: "patient-003",
    date: "Mar 1, 2026",
    title: "PD-L1 CPS 14 reported",
    detail: "IHC meets CPS >= 10 eligibility threshold.",
    tone: "positive"
  },
  {
    id: "timeline-016",
    patientId: "patient-003",
    date: "Mar 22, 2026",
    title: "Measurable disease confirmed",
    detail: "Two RECIST-measurable target lesions documented on CT.",
    tone: "positive"
  },
  {
    id: "timeline-017",
    patientId: "patient-003",
    date: "Apr 5, 2026",
    title: "Fresh labs available",
    detail: "CBC and CMP dated Apr 5 all within thresholds.",
    tone: "positive"
  },
  // --- Marcus Green (patient-004) ---
  {
    id: "timeline-018",
    patientId: "patient-004",
    date: "Sep 2, 2024",
    title: "AML diagnosis",
    detail: "FLT3-ITD positive acute myeloid leukemia confirmed.",
    tone: "neutral"
  },
  {
    id: "timeline-019",
    patientId: "patient-004",
    date: "Oct 10, 2024",
    title: "7+3 induction completed",
    detail: "Cytarabine + idarubicin induction completed.",
    tone: "neutral"
  },
  {
    id: "timeline-020",
    patientId: "patient-004",
    date: "Jan 5, 2026",
    title: "Relapse documented",
    detail: "Marrow blasts climbed; re-induction planned.",
    tone: "critical"
  },
  {
    id: "timeline-021",
    patientId: "patient-004",
    date: "Feb 10, 2026",
    title: "Re-staging marrow biopsy",
    detail: "Hypercellular marrow with 42% blasts documented.",
    tone: "warning"
  },
  {
    id: "timeline-022",
    patientId: "patient-004",
    date: "Mar 2, 2026",
    title: "FLAG-IDA re-induction completed",
    detail: "Fludarabine + cytarabine + idarubicin course finished.",
    tone: "neutral"
  },
  {
    id: "timeline-023",
    patientId: "patient-004",
    date: "Mar 20, 2026",
    title: "LP clear of blasts",
    detail: "CSF cytology negative; no CNS involvement.",
    tone: "positive"
  },
  // --- Priya Venkataraman-Krishnamurthy (patient-005) ---
  {
    id: "timeline-024",
    patientId: "patient-005",
    date: "May 12, 2024",
    title: "Initial hysterectomy pathology",
    detail: "FIGO stage IIIC1 endometrioid adenocarcinoma resected.",
    tone: "neutral"
  },
  {
    id: "timeline-025",
    patientId: "patient-005",
    date: "Oct 10, 2024",
    title: "Adjuvant carbo/taxol completed",
    detail: "6 cycles of carboplatin + paclitaxel in adjuvant setting.",
    tone: "neutral"
  },
  {
    id: "timeline-026",
    patientId: "patient-005",
    date: "Jan 8, 2026",
    title: "Recurrence biopsied",
    detail: "Pelvic recurrence biopsy-confirmed.",
    tone: "warning"
  },
  {
    id: "timeline-027",
    patientId: "patient-005",
    date: "Mar 18, 2026",
    title: "MSI-high confirmed by PCR",
    detail: "4 of 5 markers unstable on orthogonal assay.",
    tone: "positive"
  },
  {
    id: "timeline-028",
    patientId: "patient-005",
    date: "Apr 5, 2026",
    title: "MLH1/PMS2 loss on IHC",
    detail: "MMR deficiency confirmed; matches both EN-094 and PT-052.",
    tone: "positive"
  },
  // --- Jordan Rivera (patient-006) ---
  {
    id: "timeline-029",
    patientId: "patient-006",
    date: "Feb 22, 2026",
    title: "Outside PET/CT performed",
    detail: "Imaging referenced in intake but not yet retrieved into PACS.",
    tone: "warning"
  },
  {
    id: "timeline-030",
    patientId: "patient-006",
    date: "Apr 2, 2026",
    title: "New patient intake",
    detail: "Referred from Northside Dermatology Associates; MMR testing ordered.",
    tone: "neutral"
  },
  {
    id: "timeline-031",
    patientId: "patient-006",
    date: "Apr 6, 2026",
    title: "Outside records requested",
    detail: "Care Everywhere pull awaiting dermatology and prior oncology packets.",
    tone: "warning"
  }
];

export const auditEvents: AuditEvent[] = [
  {
    id: "audit-001",
    timestamp: "Apr 6, 2026 | 7:14 AM",
    actor: "screening.job",
    eventType: "screening.job_completed",
    summary: "Rescreened Angela Brooks after outside cardiology import.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-002",
    timestamp: "Apr 6, 2026 | 7:15 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 003 marked fail because NSTEMI fell inside 6-month exclusion window.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-003",
    timestamp: "Apr 6, 2026 | 7:16 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 004 marked uncertain because MRI and oncology note conflict on active CNS disease.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-004",
    timestamp: "Apr 6, 2026 | 7:20 AM",
    actor: "Lena Ortiz",
    eventType: "match.finalized",
    summary: "Queue state changed to needs_pi_review with rationale note pending.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  // --- Robert Hale (match-002) ---
  {
    id: "audit-005",
    timestamp: "Apr 6, 2026 | 6:47 AM",
    actor: "screening.job",
    eventType: "screening.job_completed",
    summary: "Rescreened Robert Hale after FoundationOne FGFR2 fusion report landed overnight.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-006",
    timestamp: "Apr 6, 2026 | 6:49 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 008 marked uncertain because most recent ECOG note is 62 days old (past 30-day threshold).",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-007",
    timestamp: "Apr 6, 2026 | 6:50 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 009 marked uncertain because no CMP labs available within protocol lookback window.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-008",
    timestamp: "Apr 6, 2026 | 6:54 AM",
    actor: "match.engine",
    eventType: "match.finalized",
    summary: "Match-002 assigned to needs_pi_review with blocker: stale ECOG + missing hepatic labs.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  // --- Diane Foster (match-003) ---
  {
    id: "audit-009",
    timestamp: "Apr 6, 2026 | 7:01 AM",
    actor: "screening.job",
    eventType: "screening.job_completed",
    summary: "Rescreened Diane Foster against BC-077 after fresh lab import.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-010",
    timestamp: "Apr 6, 2026 | 7:04 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 015 marked pass (PD-L1 CPS 14 exceeds >= 10 threshold).",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-011",
    timestamp: "Apr 6, 2026 | 7:06 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 017 marked pass because fresh CBC (Apr 5) satisfies 7-day lab window.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-012",
    timestamp: "Apr 6, 2026 | 7:08 AM",
    actor: "match.engine",
    eventType: "match.finalized",
    summary: "Match-003 assigned to candidate_for_outreach; all 6 criteria pass on fresh evidence.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  // --- Marcus Green (match-004) ---
  {
    id: "audit-013",
    timestamp: "Apr 6, 2026 | 6:09 AM",
    actor: "screening.job",
    eventType: "screening.job_completed",
    summary: "Scanned Marcus Green against LU-021 as part of routine broad-match sweep.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-014",
    timestamp: "Apr 6, 2026 | 6:10 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 019 marked fail (disease fit mismatch: AML vs NSCLC).",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-015",
    timestamp: "Apr 6, 2026 | 6:11 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 020 marked fail (no platinum exposure in medication history).",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-016",
    timestamp: "Apr 6, 2026 | 6:16 AM",
    actor: "match.engine",
    eventType: "match.finalized",
    summary: "Match-004 routed to watchlist: disease mismatch makes LU-021 infeasible; patient retained for FLT3-directed trials.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  // --- Priya EN-094 (match-005a) ---
  {
    id: "audit-017",
    timestamp: "Apr 6, 2026 | 7:39 AM",
    actor: "screening.job",
    eventType: "screening.job_completed",
    summary: "Rescreened Priya Venkataraman-Krishnamurthy against EN-094 after MMR IHC result landed.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-018",
    timestamp: "Apr 6, 2026 | 7:41 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 026 marked pass (MLH1/PMS2 loss plus PCR MSI-H concordant).",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-019",
    timestamp: "Apr 6, 2026 | 7:44 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 029 marked pass (two RECIST-measurable pelvic lesions documented).",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-020",
    timestamp: "Apr 6, 2026 | 7:46 AM",
    actor: "match.engine",
    eventType: "match.finalized",
    summary: "Match-005a assigned to candidate_for_outreach; disease-specific EN-094 is preferred over pan-tumor PT-052.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  // --- Priya PT-052 (match-005b) ---
  {
    id: "audit-021",
    timestamp: "Apr 6, 2026 | 7:45 AM",
    actor: "screening.job",
    eventType: "screening.job_completed",
    summary: "Rescreened Priya Venkataraman-Krishnamurthy against PT-052 pan-tumor MMR-d basket.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-022",
    timestamp: "Apr 6, 2026 | 7:46 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 031 marked pass (MMR deficiency satisfies PT-052 biomarker definition).",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-023",
    timestamp: "Apr 6, 2026 | 7:50 AM",
    actor: "match.engine",
    eventType: "match.rank.compared",
    summary: "Comparison across Priya's two matches — EN-094 ranks above PT-052 on disease specificity and availability.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-024",
    timestamp: "Apr 6, 2026 | 7:51 AM",
    actor: "match.engine",
    eventType: "match.finalized",
    summary: "Match-005b assigned to candidate_for_outreach as secondary option behind match-005a.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  // --- Jordan Rivera (match-006) ---
  {
    id: "audit-025",
    timestamp: "Apr 6, 2026 | 5:29 AM",
    actor: "screening.job",
    eventType: "screening.job_completed",
    summary: "Initial screening attempted for Jordan Rivera against PT-052; outside records missing.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-026",
    timestamp: "Apr 6, 2026 | 5:30 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 036 marked uncertain because MMR IHC result has not yet arrived from outside lab.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-027",
    timestamp: "Apr 6, 2026 | 5:32 AM",
    actor: "criterion.engine",
    eventType: "criterion.assessed",
    summary: "Criterion 038 marked uncertain because structured medication records are absent in-system.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  },
  {
    id: "audit-028",
    timestamp: "Apr 6, 2026 | 5:34 AM",
    actor: "match.engine",
    eventType: "match.finalized",
    summary: "Match-006 routed to protocol_question pending outside records packet; watchlist status set.",
    ruleVersion: "rules-0.9.8",
    promptVersion: "prompt-criteria-1.4",
    modelVersion: "gpt-5.4-mini"
  }
];

export const trialVersions: TrialVersion[] = [
  {
    id: "version-001",
    trialId: "trial-001",
    version: "v4.2",
    releasedAt: "Mar 19, 2026",
    summary: "Clarified CNS exclusion language and narrowed lab screening window to 14 days.",
    status: "Current in pilot"
  },
  {
    id: "version-002",
    trialId: "trial-001",
    version: "v4.1",
    releasedAt: "Jan 11, 2026",
    summary: "Added outside cardiology history as explicit exclusion review domain.",
    status: "Superseded"
  },
  {
    id: "version-003",
    trialId: "trial-001",
    version: "v4.0",
    releasedAt: "Oct 3, 2025",
    summary: "Initial pilot release candidate for Clinical Trial Pre-Screener thoracic queue.",
    status: "Archived"
  },
  {
    id: "version-004",
    trialId: "trial-002",
    version: "v2.1",
    releasedAt: "Feb 24, 2026",
    summary: "Tightened central pathology turnaround language and clarified site activation dependency.",
    status: "Current in shadow mode"
  },
  {
    id: "version-005",
    trialId: "trial-002",
    version: "v2.0",
    releasedAt: "Nov 14, 2025",
    summary: "Initial FGFR2 basket release for local operational review.",
    status: "Superseded"
  },
  {
    id: "version-006",
    trialId: "trial-003",
    version: "v3.0",
    releasedAt: "Mar 4, 2026",
    summary: "Expanded biomarker-enrichment arm and refreshed CBC timing logic.",
    status: "Current in pilot"
  },
  {
    id: "version-007",
    trialId: "trial-003",
    version: "v2.7",
    releasedAt: "Dec 7, 2025",
    summary: "Baseline breast-oncology release before the IO-combination amendment.",
    status: "Superseded"
  },
  {
    id: "version-008",
    trialId: "trial-004",
    version: "v1.3",
    releasedAt: "Mar 29, 2026",
    summary: "Locked MSI confirmation workflow and aligned lab freshness to 21 days.",
    status: "Current in pilot"
  },
  {
    id: "version-009",
    trialId: "trial-004",
    version: "v1.2",
    releasedAt: "Jan 21, 2026",
    summary: "Added immunohistochemistry confirmation language for recurrent disease.",
    status: "Superseded"
  },
  {
    id: "version-010",
    trialId: "trial-005",
    version: "v2.0",
    releasedAt: "Feb 9, 2026",
    summary: "Released pan-tumor basket criteria with explicit MMR documentation and watchlist rules.",
    status: "Current in pilot"
  },
  {
    id: "version-011",
    trialId: "trial-005",
    version: "v1.8",
    releasedAt: "Oct 28, 2025",
    summary: "Prior basket version before the MMR-deficient evidence bundle update.",
    status: "Superseded"
  }
];

export const normalizedCriteria: NormalizedCriterion[] = [
  {
    id: "dc-001",
    trialId: "trial-001",
    label: "Histologically confirmed NSCLC",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Histologically confirmed non-small cell lung cancer or pulmonary adenocarcinoma.",
    owner: "Research informatics",
    note: "Mapped to pathology-supported thoracic oncology diagnosis evidence.",
    ruleKind: "diagnosis_match",
    compiledRule: {
      kind: "diagnosis_match",
      diagnosisAliases: [["non-small cell lung", "nsclc", "pulmonary adenocarcinoma", "lung adenocarcinoma"]]
    }
  },
  {
    id: "dc-002",
    trialId: "trial-001",
    label: "EGFR exon 20 insertion",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Confirmed EGFR exon 20 insertion by NGS or equivalent assay.",
    owner: "Molecular pathology",
    note: "Mapped to genomic profiling and biomarker confirmation.",
    ruleKind: "biomarker_presence",
    compiledRule: {
      kind: "biomarker_presence",
      biomarkerAliases: [["egfr exon 20", "egfr exon20", "egfr ex20ins", "egfr exon20 insertion"]]
    }
  },
  {
    id: "dc-003",
    trialId: "trial-001",
    label: "Age >= 18",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Age >= 18 years at screening.",
    owner: "Rules service",
    note: "Directly resolved from demographics.",
    ruleKind: "age_range",
    compiledRule: {
      kind: "age_range",
      minimumAgeYears: 18
    }
  },
  {
    id: "dc-004",
    trialId: "trial-001",
    label: "ECOG <= 2",
    type: "inclusion",
    computability: "deterministic",
    threshold: "ECOG <= 2 documented within 14 days before screening.",
    owner: "Thoracic oncology",
    note: "Anchored to the freshest documented performance status.",
    ruleKind: "ecog_max",
    compiledRule: {
      kind: "ecog_max",
      ecogMax: 2,
      temporalConstraint: {
        anchor: "ecog_assessment",
        comparisonType: "freshness_window",
        freshnessDays: 14
      }
    }
  },
  {
    id: "dc-005",
    trialId: "trial-001",
    label: "Adequate organ function",
    type: "inclusion",
    computability: "deterministic",
    threshold: "ANC >= 1500 /uL; Platelets >= 100 K/uL; Hemoglobin >= 9.0 g/dL; Creatinine <= 1.8 mg/dL; Total Bilirubin <= 1.8 mg/dL; AST <= 105 U/L; ALT <= 105 U/L within 14 days before screening.",
    owner: "Clinical chemistry",
    note: "Uses explicit lab thresholds so deterministic screening can evaluate organ-function eligibility.",
    ruleKind: "lab_threshold",
    compiledRule: {
      kind: "lab_threshold",
      thresholds: [
        { field: "anc", comparator: ">=", value: 1500, unit: "/uL" },
        { field: "platelets", comparator: ">=", value: 100, unit: "K/uL" },
        { field: "hemoglobin", comparator: ">=", value: 9, unit: "g/dL" },
        { field: "creatinine", comparator: "<=", value: 1.8, unit: "mg/dL" },
        { field: "bilirubin", comparator: "<=", value: 1.8, unit: "mg/dL" },
        { field: "ast", comparator: "<=", value: 105, unit: "U/L" },
        { field: "alt", comparator: "<=", value: 105, unit: "U/L" }
      ],
      temporalConstraint: {
        anchor: "latest_lab",
        comparisonType: "freshness_window",
        freshnessDays: 14
      }
    }
  },
  {
    id: "dc-006",
    trialId: "trial-001",
    label: "Prior systemic therapy",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Progression after platinum-based chemotherapy is required before screening.",
    owner: "Clinical NLP + reviewer",
    note: "Deterministic pass requires both platinum exposure and progression language in the record.",
    ruleKind: "prior_therapy_progression",
    compiledRule: {
      kind: "prior_therapy_progression",
      therapyAliases: [["platinum", "carboplatin", "cisplatin", "pemetrexed"]]
    }
  },
  {
    id: "dc-007",
    trialId: "trial-001",
    label: "Measurable disease per RECIST",
    type: "inclusion",
    computability: "hybrid",
    threshold: "At least one measurable lesion per RECIST 1.1 on recent imaging.",
    owner: "Radiology reviewer",
    note: "Imaging size extraction still uses AI fallback and reviewer confirmation."
  },
  {
    id: "dc-008",
    trialId: "trial-001",
    label: "Washout from prior therapy >= 28 days",
    type: "inclusion",
    computability: "hybrid",
    threshold: "At least 28 days since the last systemic therapy dose before screening.",
    owner: "Temporal reasoning service",
    note: "Requires date arithmetic over medication history and therefore remains AI-assisted."
  },
  {
    id: "dc-009",
    trialId: "trial-001",
    label: "No active brain metastases",
    type: "exclusion",
    computability: "hybrid",
    threshold: "No active brain metastases or untreated CNS disease requiring therapy at screening.",
    owner: "Clinical reviewer",
    note: "Conflicting MRI and oncology documentation defaults to uncertain."
  },
  {
    id: "dc-010",
    trialId: "trial-001",
    label: "No prior EGFR exon 20 targeted therapy",
    type: "exclusion",
    computability: "deterministic",
    threshold: "No prior mobocertinib, amivantamab, or other EGFR exon 20-targeted therapy.",
    owner: "Pharmacy informatics",
    note: "Medication-history alias match should auto-pass when restricted therapies are absent.",
    ruleKind: "no_prior_exposure",
    compiledRule: {
      kind: "no_prior_exposure",
      therapyAliases: [["mobocertinib", "amivantamab", "egfr exon 20 targeted therapy"]]
    }
  },
  {
    id: "dc-011",
    trialId: "trial-001",
    label: "No active autoimmune disease",
    type: "exclusion",
    computability: "hybrid",
    threshold: "No active autoimmune disease requiring systemic therapy or ongoing immunosuppression.",
    owner: "Clinical reviewer",
    note: "Negation-heavy autoimmune review still falls back to AI plus human confirmation."
  },
  {
    id: "norm-006",
    trialId: "trial-002",
    label: "Metastatic biliary tract cancer with FGFR2 fusion",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Diagnosis plus FGFR2 fusion confirmation",
    owner: "Research informatics",
    note: "Structured disease + genomics cross-check."
  },
  {
    id: "norm-007",
    trialId: "trial-002",
    label: "Central pathology packet received within 30 days",
    type: "inclusion",
    computability: "hybrid",
    threshold: "Document receipt timestamp plus pathology review",
    owner: "Outside records team",
    note: "Depends on scanned external packet ingest."
  },
  {
    id: "norm-008",
    trialId: "trial-002",
    label: "No uncontrolled biliary obstruction or infection",
    type: "exclusion",
    computability: "hybrid",
    threshold: "Recent procedure notes plus bilirubin trend",
    owner: "Clinical reviewer",
    note: "Requires note interpretation and lab context."
  },
  {
    id: "norm-009",
    trialId: "trial-003",
    label: "Metastatic TNBC with PD-L1-enriched profile",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Receptor status plus PD-L1 threshold",
    owner: "Breast disease ontology",
    note: "Pulled from pathology and biomarker feeds."
  },
  {
    id: "norm-010",
    trialId: "trial-003",
    label: "Fresh CBC available within 7 days",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Lab freshness <= 7 days",
    owner: "Rules service",
    note: "Hard freshness gate for outreach readiness."
  },
  {
    id: "norm-011",
    trialId: "trial-003",
    label: "No active autoimmune disease requiring systemic therapy",
    type: "exclusion",
    computability: "hybrid",
    threshold: "Medication history plus oncology note review",
    owner: "Clinical NLP + reviewer",
    note: "Medication-only signals are insufficient without note context."
  },
  {
    id: "norm-012",
    trialId: "trial-004",
    label: "Recurrent endometrial adenocarcinoma with MSI-high or MMR-deficient status",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Disease specificity plus MSI/MMR confirmation",
    owner: "Molecular pathology",
    note: "Uses pathology and immunohistochemistry mappings."
  },
  {
    id: "norm-013",
    trialId: "trial-004",
    label: "Labs available within 21 days",
    type: "inclusion",
    computability: "deterministic",
    threshold: "CBC and CMP within 21-day window",
    owner: "Rules service",
    note: "Readiness gate for outreach packet generation."
  },
  {
    id: "norm-014",
    trialId: "trial-004",
    label: "No active immune-related toxicity above grade 1",
    type: "exclusion",
    computability: "hybrid",
    threshold: "Toxicity assessment plus medication review",
    owner: "Gynecologic oncology reviewer",
    note: "Needs physician interpretation for borderline cases."
  },
  {
    id: "norm-015",
    trialId: "trial-005",
    label: "MMR-deficient solid tumor confirmed within 90 days",
    type: "inclusion",
    computability: "deterministic",
    threshold: "Recent MMR/MSI confirmation required",
    owner: "Pan-tumor rules service",
    note: "Supports watchlist and rescreen logic."
  },
  {
    id: "norm-016",
    trialId: "trial-005",
    label: "Basket histology fits sponsor-defined cohort intent",
    type: "inclusion",
    computability: "manual_only",
    threshold: "PI or disease-group reviewer signoff",
    owner: "PI reviewer",
    note: "Never finalized automatically because basket intent is nuanced."
  },
  {
    id: "norm-017",
    trialId: "trial-005",
    label: "No unresolved outside-record gap for current disease staging",
    type: "exclusion",
    computability: "hybrid",
    threshold: "Outside-record completeness plus staging confirmation",
    owner: "Records coordination",
    note: "Remains uncertain until outside records are reconciled."
  }
];

export const funnelMetrics: FunnelMetric[] = [
  { label: "Screened", value: 126, tone: "neutral" },
  { label: "Reviewed", value: 81, tone: "neutral" },
  { label: "Contacted", value: 34, tone: "warning" },
  { label: "Eligible", value: 19, tone: "positive" },
  { label: "Consented", value: 11, tone: "positive" },
  { label: "Enrolled", value: 8, tone: "positive" }
];

export const heatmapRows: HeatmapRow[] = [
  {
    family: "Cardiac exclusions",
    uncertainRate: "9%",
    overrideRate: "4%",
    hotspot: "Outside records arrive late"
  },
  {
    family: "CNS disease status",
    uncertainRate: "18%",
    overrideRate: "11%",
    hotspot: "MRI wording conflicts with note summaries"
  },
  {
    family: "Adequate organ function",
    uncertainRate: "6%",
    overrideRate: "2%",
    hotspot: "Lab age and unit normalization"
  },
  {
    family: "Manual-only investigator judgment",
    uncertainRate: "100%",
    overrideRate: "N/A",
    hotspot: "Expected human-only review"
  }
];

export const roiCards = [
  { label: "Median review time", value: "14 min", delta: "-31% vs baseline" },
  { label: "Weekly coordinator capacity", value: "42 hours", delta: "+12 hours recovered" },
  { label: "Queue aging > 48h", value: "6 cases", delta: "-4 from last week" },
  { label: "False exclusion review", value: "1.8%", delta: "Within pilot guardrail" }
];

export function getPatient(patientId: string) {
  return getPatientById(patientId);
}

export function getTrial(trialId: string) {
  const hasInstitutionalCatalog =
    useInstitutionalTrialsStore.getState().items.length > 0;

  return (
    getInstitutionalTrialById(trialId) ??
    (!hasInstitutionalCatalog
      ? trials.find((trial) => trial.id === trialId)
      : undefined) ??
    getImportedTrialByTrialId(trialId)
  );
}

export function getMatch(matchId: string) {
  const match = matches.find((candidate) => candidate.id === matchId);
  if (!match) {
    return undefined;
  }

  return getPatient(match.patientId) && getTrial(match.trialId) ? match : undefined;
}

export function getVisiblePatients() {
  return patients.filter((patient) => isPatientVisible(patient.id));
}

export function getVisibleMatches() {
  return matches.filter(
    (match) => getPatient(match.patientId) && getTrial(match.trialId),
  );
}

export function getVisibleQueueItems() {
  const visibleMatchIds = new Set(getVisibleMatches().map((match) => match.id));
  return queueItems.filter(
    (item) =>
      visibleMatchIds.has(item.matchId) &&
      getPatient(item.patientId) &&
      getTrial(item.trialId),
  );
}

export function listTrials(): TrialOption[] {
  const institutionalOptions = getInstitutionalTrialOptions();
  const hasInstitutionalCatalog =
    useInstitutionalTrialsStore.getState().items.length > 0;

  return [
    ...(institutionalOptions.length > 0
      ? institutionalOptions
      : hasInstitutionalCatalog
        ? []
        : trials.map((trial) => ({
            id: trial.id,
            label: `${trial.shortCode} | ${trial.title}`,
            status: trial.localStatus
          }))),
    ...getImportedTrialOptions()
  ];
}

export function listScreenableTrials(): TrialOption[] {
  const institutionalOptions = getScreenableInstitutionalTrialOptions();
  const hasInstitutionalCatalog =
    useInstitutionalTrialsStore.getState().items.length > 0;

  return [
    ...(institutionalOptions.length > 0
      ? institutionalOptions
      : hasInstitutionalCatalog
        ? []
        : trials.map((trial) => ({
            id: trial.id,
            label: `${trial.shortCode} | ${trial.title}`,
            status: trial.localStatus
          }))),
    ...getScreenableImportedTrialOptions()
  ];
}

export function listPatientsWithMatches(): PatientOption[] {
  return getVisiblePatients()
    .filter((patient) => matches.some((match) => match.patientId === patient.id))
    .map((patient) => ({
      id: patient.id,
      label: `${patient.name} | ${patient.mrn}`
    }));
}

export function listMatchesForPatient(patientId: string): MatchContextOption[] {
  if (!isPatientVisible(patientId)) {
    return [];
  }

  return matches
    .filter((match) => match.patientId === patientId)
    .sort((left, right) => right.fitScore - left.fitScore)
    .flatMap((match) => {
      const patient = getPatient(match.patientId);
      const trial = getTrial(match.trialId);
      if (!patient || !trial) {
        return [];
      }

      return {
        matchId: match.id,
        patientId: match.patientId,
        trialId: match.trialId,
        patientLabel: `${patient.name} | ${patient.mrn}`,
        trialLabel: `${trial.shortCode} | ${trial.title}`,
      };
    });
}

export function findMatchByPatientAndTrial(patientId: string, trialId: string) {
  return listMatchesForPatient(patientId).find((match) => match.trialId === trialId);
}

export function getTrialVersionsForTrial(trialId: string) {
  const institutionalVersions = getInstitutionalTrialVersionsForTrial(trialId);
  const hasInstitutionalCatalog =
    useInstitutionalTrialsStore.getState().items.length > 0;
  if (institutionalVersions.length > 0) {
    return institutionalVersions;
  }

  return [
    ...(!hasInstitutionalCatalog
      ? trialVersions.filter((version) => version.trialId === trialId)
      : []),
    ...getImportedTrialVersionsForTrial(trialId)
  ];
}

export function getNormalizedCriteriaForTrial(trialId: string) {
  const institutionalCriteria = getInstitutionalNormalizedCriteriaForTrial(trialId);
  const hasInstitutionalCatalog =
    useInstitutionalTrialsStore.getState().items.length > 0;
  if (institutionalCriteria.length > 0) {
    return institutionalCriteria;
  }

  return [
    ...(!hasInstitutionalCatalog
      ? normalizedCriteria.filter((criterion) => criterion.trialId === trialId)
      : []),
    ...getImportedCriteriaForTrial(trialId)
  ];
}

/*
 * Trend fixtures powering the Section 16 V6 Sparkline slot on MetricCard.
 *
 * Keys are the metric label (kebab-cased) that the page passes as `trend={...}`.
 * Values are 14-day series (most recent day last). Data is plausible but synthetic —
 * curated so the direction and final delta match the narrative on each MetricCard
 * (e.g. "31 percent faster than baseline" on median review time trends down).
 */
export const metricTrends: Record<string, readonly number[]> = {
  "median-review-time-min": [24, 23, 22, 22, 21, 20, 19, 18, 17, 16, 16, 15, 14, 14],
  "reviewed-today": [58, 61, 64, 63, 66, 70, 72, 75, 74, 77, 79, 80, 81, 81],
  "needs-pi-review": [12, 14, 13, 15, 16, 14, 13, 12, 11, 12, 13, 14, 15, 14],
  "false-exclusion-rate": [2.4, 2.3, 2.3, 2.1, 2.0, 2.0, 1.9, 1.9, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
  "visible-queue": [48, 52, 55, 51, 54, 57, 60, 58, 55, 53, 56, 59, 61, 62],
  "need-pi-review-cockpit": [9, 10, 11, 10, 12, 13, 11, 10, 11, 12, 13, 12, 11, 10],
  "changed-overnight": [2, 3, 4, 3, 5, 6, 4, 3, 5, 6, 7, 6, 5, 4],
  "ready-for-outreach": [6, 7, 9, 10, 8, 9, 11, 13, 12, 14, 15, 14, 16, 17],
  "weekly-capacity-hours": [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 42],
  "queue-aging-48h": [12, 11, 11, 10, 9, 8, 9, 8, 7, 7, 6, 6, 6, 6]
};

/*
 * Overnight delta fixture powering the Section 16 V5 SlopeChart on CockpitPage.
 *
 * Each row represents a queue item whose score (or evidence profile) moved between
 * the coordinator's previous review and this morning's re-eval. `before`/`after`
 * are the match fit scores (0-100) at the two points; `reason` is a short string
 * the chart surfaces on hover/focus.
 */
export interface OvernightChange {
  matchId: string;
  label: string;
  before: number;
  after: number;
  reason: string;
}

export const overnightChanges: readonly OvernightChange[] = [
  {
    matchId: "match-001",
    label: "Brooks / LU-021",
    before: 74,
    after: 82,
    reason: "New EGFR exon20 confirmation resolved uncertain genomic criterion"
  },
  {
    matchId: "match-002",
    label: "Ortega / LU-021",
    before: 68,
    after: 51,
    reason: "MRI addendum flagged CNS activity; criterion moved to fail"
  },
  {
    matchId: "match-003",
    label: "Carter / LU-018",
    before: 79,
    after: 77,
    reason: "Outside cardiology import still pending; status unchanged"
  },
  {
    matchId: "match-004",
    label: "Patel / EN-094",
    before: 55,
    after: 71,
    reason: "MMR deficiency note landed overnight; disease specificity improved"
  },
  {
    matchId: "match-005",
    label: "Nguyen / PT-052",
    before: 62,
    after: 58,
    reason: "Creatinine trending up; organ function now aging"
  }
];
