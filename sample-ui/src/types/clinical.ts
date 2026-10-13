/*
 * Clinical domain types — Patient, Trial, CriterionAssessment, EvidenceSnippet, and friends.
 *
 * Convention: any field a sponsor view MUST NOT see is documented with /** @phi *./ in JSDoc.
 * The boundary transform in src/features/sponsor/data/deidentify.ts strips those fields.
 */

// AuditEvent + PiHandoffPacket live in collab.ts (the audit/PI packet belong
// to the collaboration surface), but MatchReviewPackage needs to reference
// both in its shape. We import them here so the interface resolves, then
// re-export at the bottom of the file for co-located consumers.
import type { AuditEvent, PiHandoffPacket } from "./collab.ts";

export type MatchStatus = "pass" | "fail" | "uncertain" | "manual_review";
export type Priority = "critical" | "high" | "moderate" | "watch";
export type Freshness = "fresh" | "aging" | "stale" | "missing";
export type UncertaintyReason =
  | "missing_domain"
  | "conflicting_evidence"
  | "protocol_ambiguity"
  | "stale_data"
  | "manual_only";
export type QueueDisposition =
  | "candidate_for_outreach"
  | "needs_pi_review"
  | "reviewed_not_actionable"
  | "closed_not_eligible"
  | "protocol_question";
export type Computability = "deterministic" | "hybrid" | "manual_only";
export type AssertionStatus =
  | "present"
  | "negated"
  | "possible"
  | "historical"
  | "family";
export type TemporalComparisonType =
  | "none"
  | "lookback_exclusion"
  | "freshness_window"
  | "after_progression";
export type TemporalAnchor =
  | "screening_date"
  | "event_date"
  | "latest_lab"
  | "prior_therapy"
  | "ecog_assessment";
export type CompiledCriterionRuleKind =
  | "age_range"
  | "sex_match"
  | "diagnosis_match"
  | "biomarker_presence"
  | "lab_threshold"
  | "event_lookback_exclusion"
  | "prior_therapy_progression"
  | "no_prior_exposure"
  | "ecog_max"
  | "manual_review";
export type ImportedTrialScreeningIntent =
  | "prospective_prescreening"
  | "retrospective_manual_only";
export type ImportedCriterionCategory =
  | "clinical"
  | "administrative"
  | "tautology"
  | "cohort_membership";
export type InstitutionalTrialSourceKind =
  | "oncore"
  | "protocol_repository"
  | "clinicaltrials_gov"
  | "mock_seed";
export type TrialUiVisibility = "visible" | "hidden";
export type NormalizationSource =
  | "deterministic_seed"
  | "llm_assisted"
  | "reviewer_approved";
export type ImportedTrialNormalizationReviewState =
  | "not_started"
  | "needs_review"
  | "approved_for_promotion"
  | "promoted";
export type NormalizationJobStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "error";
export type ReviewGate =
  | "human_required"
  | "policy_locked_manual_only"
  | "human_optional";
export type CriterionEvaluationMode =
  | "deterministic"
  | "needs_ai_fallback"
  | "manual_review";
export type TaskMode =
  | "today"
  | "clinic_prep"
  | "needs_pi_review"
  | "ready_for_outreach"
  | "watchlist"
  | "ops_insights";

export interface AlertItem {
  id: string;
  tone: "info" | "warning" | "action";
  title: string;
  detail: string;
  timestamp: string;
}

export interface Patient {
  id: string;
  /** @phi — never leak to sponsor view */
  name: string;
  /** @phi */
  mrn: string;
  age: number | null;
  sex: string;
  diseaseArea: string;
  diagnosis: string;
  stage: string;
  ecog: string;
  careTeam: string;
  nextAppointment: string;
  biomarkers: string[];
  summaryFlags: string[];
}

export interface Trial {
  id: string;
  shortCode: string;
  title: string;
  diseaseArea: string;
  phase: string;
  localStatus: "active" | "review" | "inactive";
  activationState: string;
  protocolVersion: string;
  pi: string;
  screeningWindow: string;
  releaseState: string;
}

export interface QueueItem {
  matchId: string;
  patientId: string;
  trialId: string;
  priority: Priority;
  urgencyLabel: string;
  owner: string;
  nextStep: QueueDisposition;
  score: number;
  trialCount: number;
  reviewState: string;
  lastUpdated: string;
  flags: string[];
  taskModes?: TaskMode[];
  whyNow?: string;
  recommendedAction?: string;
  storyId?: string;
  timeInQueue?: string;
  changedOvernight?: boolean;
  /** M2: used by DeltaReviewBanner; ISO timestamp of the current user's last review_completed audit event. */
  lastReviewedAt?: string;
  /** M2: criterion IDs that changed since lastReviewedAt. */
  deltaSinceLastReview?: string[];
  /** M2: link to cohort-level patterns this item participates in. */
  cohortPatternIds?: string[];
}

export interface CriterionAssessment {
  id: string;
  label: string;
  bucket: string;
  status: MatchStatus;
  confidenceLabel: string;
  computability: Computability;
  summary: string;
  reviewRequired: boolean;
  freshness: Freshness;
  reasoning: string;
  uncertaintyReason?: UncertaintyReason;
  unresolvedReason?: string;
  evidenceIds: string[];
  thresholdLabel?: string;
  lastEvaluatedAt?: string;
  supportingEvidenceCount?: number;
  contradictingEvidenceCount?: number;
  /** M2: counterfactual — what would need to change for a fail/uncertain to become pass. */
  counterfactual?: {
    whatWouldNeedToChange: string;
    estimatedLiftScenario: string;
  };
  /** M2: human-readable threshold version used by CriterionNLEditor. */
  naturalLanguageThreshold?: string;
  deterministicOutcome?: DeterministicOutcome;
  llmSuggestion?: LlmSuggestion;
  reviewGate?: ReviewGate;
  normalizationSource?: NormalizationSource;
  promptVersion?: string;
  modelRunId?: string;
}

export interface EvidenceSnippet {
  id: string;
  patientId: string;
  type: string;
  sourceDocument: string;
  sourceSystem: string;
  sourceDate: string;
  author: string;
  excerpt: string;
  tone: "supporting" | "contradicting" | "context";
  criterionIds: string[];
  freshness?: Freshness;
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  date: string;
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

export interface MatchRecommendation {
  id: string;
  patientId: string;
  trialId: string;
  recommendation: MatchStatus;
  fitScore: number;
  owner: string;
  assignedQueue: string;
  nextStep: QueueDisposition;
  rationale: string;
  blockers: string[];
  continuousTracking: string;
  criterionIds: string[];
  auditIds: string[];
  whatChangedSinceLastReview?: string[];
  blockingReasonPrimary?: string;
  nextRecommendedAction?: string;
  handoffStatus?: string;
  unresolvedQuestionCount?: number;
  lastReviewer?: string;
  evidenceFreshnessSummary?: string;
  visitContext?: string;
  watchlistTrigger?: string;
  comparisonRankReason?: string;
  missingDomains?: string[];
  contradictionSummary?: string;
  managerMetric?: string;
  taskModes?: TaskMode[];
  storyCategory?: string;
}

export interface TrialVersion {
  id: string;
  trialId: string;
  version: string;
  releasedAt: string;
  summary: string;
  status: string;
}

export interface ImportedTrialVersionDraft extends TrialVersion {
  source: "clinicaltrials_gov";
}

export interface TrialSourceRecord {
  id: string;
  trialId: string;
  sourceKind: InstitutionalTrialSourceKind;
  sourceId: string;
  label: string;
  lastSyncedAt: string;
  payloadHash?: string;
  metadata?: Record<string, string>;
}

export interface ProtocolArtifact {
  id: string;
  trialId: string;
  versionLabel: string;
  sourceKind: InstitutionalTrialSourceKind;
  title: string;
  sourceLocation: string;
  extractedEligibilityText: string;
  amendmentDate?: string;
  importedAt: string;
}

export interface InstitutionalTrial extends Trial {
  canonicalSourceKind: InstitutionalTrialSourceKind;
  pilotScope: boolean;
  nctId?: string;
  oncoreTrialId?: string;
  linkedImportedTrialId?: string;
  latestCriteriaVersionId?: string;
  latestNormalizationJobId?: string;
  normalizationStatus: NormalizationJobStatus;
  lastSyncedAt: string;
  sourceRecordIds: string[];
  protocolArtifactIds: string[];
  uiVisibility?: TrialUiVisibility;
  hiddenAt?: string;
}

export interface InstitutionalTrialVersion extends TrialVersion {
  sourceKind: InstitutionalTrialSourceKind;
  protocolArtifactId?: string;
  criteriaVersionId?: string;
}

export interface TemporalConstraint {
  anchor: TemporalAnchor;
  comparisonType: TemporalComparisonType;
  lookbackDays?: number;
  freshnessDays?: number;
}

export interface CompiledThreshold {
  field:
    | "age"
    | "anc"
    | "platelets"
    | "hemoglobin"
    | "bilirubin"
    | "ast"
    | "alt"
    | "alp"
    | "creatinine"
    | "ecog";
  comparator: ">=" | "<=" | "<" | ">";
  value: number;
  unit?: string;
  /** When set, `value` is a multiplier of the upper limit of normal (e.g. 1.5 → 1.5 × ULN). */
  relativeToULN?: number;
}

export interface CompiledCriterionRule {
  kind: CompiledCriterionRuleKind;
  diagnosisAliases?: string[][];
  biomarkerAliases?: string[][];
  therapyAliases?: string[][];
  eventAliases?: string[];
  thresholds?: CompiledThreshold[];
  ecogMax?: number;
  minimumAgeYears?: number;
  maximumAgeYears?: number;
  sex?: string;
  temporalConstraint?: TemporalConstraint;
}

export interface DeterministicOutcome {
  mode: CriterionEvaluationMode;
  status: MatchStatus;
  freshness: Freshness;
  reasoning: string;
  evidenceIds: string[];
  uncertaintyReason?: UncertaintyReason;
}

export interface LlmSuggestion {
  suggestedStatus: MatchStatus;
  reasoning: string;
  citations: Array<{
    evidenceId: string;
    source: string;
    sourceDate: string;
    excerpt: string;
  }>;
  uncertaintyReason?: UncertaintyReason;
  temporalAnalysis?: {
    relevantDate: string;
    referenceDate: string;
    intervalDays: number;
    windowDays: number;
    withinWindow: boolean;
    arithmetic: string;
  };
  negationAnalysis?: {
    assertionStatus: AssertionStatus;
    rawPhrase: string;
    confidence: "high" | "medium" | "low";
  };
  fuzzyResolution?: {
    originalText: string;
    resolvedThreshold: string;
    labValuesUsed: Array<{
      name: string;
      value: number;
      unit: string;
      meetsThreshold: boolean;
    }>;
  };
  confidence: "high" | "medium" | "low";
  provider: string;
  model: string;
  promptVersion: string;
  modelRunId: string;
  completedAt: string;
}

export interface NormalizedCriterion {
  id: string;
  trialId: string;
  label: string;
  type: "inclusion" | "exclusion";
  computability: Computability;
  threshold: string;
  owner: string;
  note: string;
  conceptTags?: string[];
  temporalAnchor?: string;
  temporalWindow?: string;
  qaStatus?: "approved" | "needs_review" | "manual_only";
  protocolSource?: string;
  ruleKind?: CompiledCriterionRuleKind;
  assertionSensitive?: boolean;
  normalizationConfidence?: "high" | "medium" | "low";
  compiledRule?: CompiledCriterionRule;
  criterionCategory?: ImportedCriterionCategory;
  countsTowardAutomationReadiness?: boolean;
  sourceText?: string;
  sourceLocation?: string;
  deterministicParseOutput?: string;
  llmNormalizedOutput?: string;
  normalizationJobId?: string;
  normalizationSource?: NormalizationSource;
}

export interface NormalizedCriterionVersion {
  id: string;
  trialId: string;
  versionLabel: string;
  status: NormalizationJobStatus;
  normalizationSource: NormalizationSource;
  protocolArtifactId?: string;
  normalizationJobId?: string;
  criteria: NormalizedCriterion[];
  deterministicCriteria: NormalizedCriterion[];
  llmNormalizedCriteria: NormalizedCriterion[];
  promptVersion?: string;
  modelRunId?: string;
  provider?: string;
  model?: string;
  generatedAt: string;
  approvedAt?: string;
}

export interface NormalizationJob {
  id: string;
  trialId: string;
  protocolArtifactId?: string;
  status: NormalizationJobStatus;
  normalizationSource: NormalizationSource;
  reviewGate: ReviewGate;
  sourceText: string;
  sourceLocation?: string;
  deterministicCriteria: NormalizedCriterion[];
  llmNormalizedCriteria: NormalizedCriterion[];
  finalCriteria: NormalizedCriterion[];
  promptVersion?: string;
  modelRunId?: string;
  provider?: string;
  model?: string;
  warnings: string[];
  errorMessage?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerNotes?: string;
  startedAt: string;
  completedAt?: string;
}

export interface CriterionAdjudication {
  id: string;
  criterionId: string;
  patientId: string;
  trialId: string;
  operationalStatus: MatchStatus;
  reviewGate: ReviewGate;
  deterministicOutcome?: DeterministicOutcome;
  llmSuggestion?: LlmSuggestion;
  finalReasoning: string;
  finalCitationIds: string[];
  promptVersion?: string;
  modelRunId?: string;
  createdAt: string;
}

export interface ImportedCriterionDraft extends NormalizedCriterion {
  source: "clinicaltrials_gov";
  sourceText: string;
  sectionLabel: string;
}

export interface ImportedTrialProjection extends Trial {
  nctId: string;
  source: "clinicaltrials_gov";
  importedAt: string;
  sourceUrl: string;
  sponsorName?: string;
  registryOverallStatus?: string;
  conditions: string[];
  eligibilityRawText: string;
  criteriaCount: number;
  onboardingState: "draft_import";
  screeningWindowSource?: string;
  screeningIntent: ImportedTrialScreeningIntent;
  automationBlockerReason?: string;
  linkedInstitutionalTrialId?: string;
  promotionState?: "not_promoted" | "linked";
  promotedAt?: string;
}

export interface ImportedTrialListItem {
  nctId: string;
  fetchedAt: string;
  sourceUrl: string;
  importStatus: "ready" | "error";
  latestNormalizationJobId?: string;
  normalizationStatus: NormalizationJobStatus;
  normalizationReviewState: ImportedTrialNormalizationReviewState;
  projection: ImportedTrialProjection;
  criteria: ImportedCriterionDraft[];
  versions: ImportedTrialVersionDraft[];
  normalizationJobs: NormalizationJob[];
}

export interface ImportedTrialRecord extends ImportedTrialListItem {
  rawStudy: unknown;
}

export interface ImportedTrialsRuntimeStore {
  updatedAt: string | null;
  items: ImportedTrialListItem[];
}

export interface InstitutionalTrialCatalogStore {
  updatedAt: string | null;
  items: InstitutionalTrial[];
  versions: InstitutionalTrialVersion[];
  sourceRecords: TrialSourceRecord[];
  protocolArtifacts: ProtocolArtifact[];
  criteriaVersions: NormalizedCriterionVersion[];
  normalizationJobs: NormalizationJob[];
}

export interface ImportedTrialPromotionResponse {
  institutionalTrialId: string;
  createdDraft: boolean;
  trial: InstitutionalTrial;
  trialVersion: InstitutionalTrialVersion;
  criteriaVersion: NormalizedCriterionVersion;
  normalizationJob: NormalizationJob;
  importedRecord: ImportedTrialRecord;
}

export interface ImportedTrialNormalizationResponse {
  importedRecord: ImportedTrialRecord;
  normalizationJob: NormalizationJob;
}

export interface NormalizationJobReviewPayload {
  reviewerName?: string;
  reviewerNotes?: string;
  finalCriteria?: NormalizedCriterion[];
}

export interface NormalizationJobReviewResponse {
  normalizationJob: NormalizationJob;
  importedRecord?: ImportedTrialRecord;
  trial?: InstitutionalTrial;
}

export interface NormalizationJobApprovalResponse {
  normalizationJob: NormalizationJob;
  trial: InstitutionalTrial;
  trialVersion: InstitutionalTrialVersion;
  criteriaVersion: NormalizedCriterionVersion;
  importedRecord?: ImportedTrialRecord;
  institutionalTrialId: string;
  createdDraft?: boolean;
}

export interface TrialRemovalResult {
  requestedTrialId: string;
  canonicalTrialId?: string;
  removedTrialIds: string[];
  hiddenTrialIds: string[];
  redirectTrialId?: string;
}

/*
 * Rich clinical record types — used by the Live Screening feature to give
 * the LLM a realistic EHR-like patient record to evaluate against trial
 * criteria. Each section mirrors a real EHR data feed: structured (labs,
 * meds, problems, vitals) and unstructured (clinical notes).
 */

export interface LabResult {
  test: string;
  value: string;
  unit: string;
  referenceRange: string;
  date: string;
  flag?: "normal" | "high" | "low" | "critical";
}

export interface Medication {
  name: string;
  route: string;
  status: "active" | "completed" | "discontinued";
  startDate: string;
  endDate?: string;
  indication?: string;
}

export interface ClinicalNote {
  type: "pathology" | "genomic" | "imaging" | "progress" | "discharge" | "procedure";
  title: string;
  date: string;
  author: string;
  text: string;
}

export interface PatientClinicalRecord {
  patientId: string;
  demographics: {
    age: number | null;
    sex: string;
    weight: string;
    height: string;
    bmi: string;
    race?: string;
    ethnicity?: string;
  };
  ecogPerformanceStatus: number | null;
  problemList: Array<{ code: string; description: string; onset: string }>;
  labs: LabResult[];
  medications: Medication[];
  notes: ClinicalNote[];
  /** All notes + labs + meds concatenated as one text block for LLM input. */
  fullRecordText: string;
}

export type PatientCatalogSource = "seed" | "upload";
export type PatientParseStatus = "structured" | "partial" | "failed";
export type PatientRemovalMode = "hard_delete" | "tombstone";

export interface PatientCatalogItem {
  patient: Patient;
  clinicalRecord: PatientClinicalRecord;
  source: PatientCatalogSource;
  rawRecordText: string;
  parseStatus: PatientParseStatus;
  parseWarnings: string[];
  uploadedAt?: string;
  fileName?: string;
  contentHash?: string;
}

export interface PatientRemovalRecord {
  patientId: string;
  source: PatientCatalogSource;
  removedAt: string;
  removalMode: PatientRemovalMode;
}

export interface PatientCatalogRuntimeStore {
  updatedAt: string | null;
  items: PatientCatalogItem[];
  removedPatients: PatientRemovalRecord[];
}

export interface PatientRemovalResult {
  requestedPatientId: string;
  removedPatientId: string;
  source: PatientCatalogSource;
  removalMode: PatientRemovalMode;
}

export interface PatientOption {
  id: string;
  label: string;
}

export interface TrialOption {
  id: string;
  label: string;
  status?: Trial["localStatus"];
}

export interface MatchContextOption {
  matchId: string;
  patientId: string;
  trialId: string;
  patientLabel: string;
  trialLabel: string;
}

export interface FunnelMetric {
  label: string;
  value: number;
  tone: "neutral" | "positive" | "warning";
}

export interface TaskModeCard {
  id: TaskMode;
  label: string;
  metric: string;
  detail: string;
  promise: string;
}

export interface HeatmapRow {
  family: string;
  uncertainRate: string;
  overrideRate: string;
  hotspot: string;
}

export interface OverrideCluster {
  family: string;
  reason: string;
  count: number;
  action: string;
}

export interface TrialMetricCard {
  trialId: string;
  shortCode: string;
  screened: number;
  piEscalations: number;
  outreachReady: number;
  enrolled: number;
  mainBlocker: string;
}

export interface DemoStory {
  id: string;
  title: string;
  patientId: string;
  trialId: string;
  category: string;
  promise: string;
  visibleBlocker: string;
  nextAction: string;
  managerMetric: string;
  wowFactor: string;
}

export interface MissingDataSignal {
  id: string;
  label: string;
  status: Freshness;
  detail: string;
  owner: string;
  dueBy: string;
}

export interface ContradictionSignal {
  id: string;
  title: string;
  severity: Priority;
  summary: string;
  action: string;
  evidenceIds: string[];
}

export interface ScreeningJob {
  id: string;
  patientId: string;
  trialScope: string;
  status: "queued" | "running" | "completed" | "needs_review";
  startedAt: string;
  completedAt: string;
  trigger: string;
  screenedTrialIds?: string[];
  ruleVersion?: string;
  promptVersion?: string;
  modelVersion?: string;
  normalizationVersion?: string;
}

export interface ScreeningRunResponse {
  patientId: string;
  trialId: string;
  screeningMode: "deterministic_first" | "full_record_llm";
  overallEligibility: "eligible" | "not_eligible" | "requires_review";
  assessments: CriterionAssessment[];
  criteriaVersionId?: string;
  readinessLabel?: "Screenable" | "Partial automation" | "Manual-review heavy";
  readinessDetail?: string;
  runtimeMode: "demo" | "live";
  providerOrder: string[];
  attemptedProviders: string[];
  finalProvider: string | null;
  finalModel: string | null;
  fallbackPath: "none" | "demo_fixture" | "deterministic_first";
  fallbackReason: string | null;
  summary: string;
  promptVersion?: string;
  modelRunId?: string;
  runStartedAt: string;
  runCompletedAt: string;
  rawRecordChars: number;
  promptChars: number;
  providerAttempts: Array<{
    provider: string;
    status: "started" | "skipped" | "succeeded" | "failed";
    attemptedAt: string;
    completedAt?: string;
    model?: string;
    wallTimeMs?: number;
    reason?: string;
    errorName?: string;
    schemaPath?: string;
    schemaMessage?: string;
    schemaSummary?: string;
    schemaRawSummary?: string;
    errorCategory?:
      | "quota"
      | "network"
      | "schema"
      | "safety"
      | "fallback"
      | "configuration"
      | "unknown";
  }>;
}

export interface ReviewAction {
  id: string;
  matchId: string;
  criterionId?: string;
  actor: string;
  actionType: "override" | "finalize" | "outcome_recorded";
  result: string;
  rationale: string;
  timestamp: string;
}

export interface PatientEvidenceItem {
  id: string;
  label: string;
  sourceType: string;
  sourceDate: string;
  freshness: Freshness;
  linkedCriterionIds: string[];
  sourceSystem?: string;
  excerpt?: string;
  domain?: string;
  normalizedConcepts?: string[];
  assertionStatus?: AssertionStatus;
  experiencer?: "patient" | "family" | "possible";
  temporalDate?: string;
  numericValue?: number;
  unit?: string;
  referenceRange?: string;
}

export interface PatientEvidenceDomainCoverage {
  domain: string;
  freshness: Freshness;
  itemCount: number;
}

export interface ScreeningEngineVersions {
  normalizationVersion: string;
  ruleVersion: string;
  promptVersion: string;
  modelVersion: string;
  generatedAt: string;
}

export interface PatientEvidenceBundle {
  id: string;
  patientId: string;
  coverageSummary: string;
  missingDomains: string[];
  freshnessSummary: string;
  items: PatientEvidenceItem[];
  coverageByDomain?: PatientEvidenceDomainCoverage[];
  generatedAt?: string;
  engineVersions?: ScreeningEngineVersions;
}

export interface TrialCriterion {
  id: string;
  trialId: string;
  label: string;
  type: "inclusion" | "exclusion";
  computability: Computability;
  threshold: string;
  owner: string;
}

export interface ScreeningMetricSnapshot {
  medianReviewTime: string;
  reviewedToday: number;
  needsPiReview: number;
  falseExclusionRate: string;
}

export interface AiQualityMetricSnapshot {
  evaluatedPairs: number;
  negationAccuracy: string;
  temporalAccuracy: string;
  fuzzyCriteriaAccuracy: string;
  evidenceFaithfulness: string;
  falseExclusionRate: string;
  biasToUncertain: string;
}

export interface MatchReviewPackage {
  match: MatchRecommendation;
  patient: Patient;
  trial: Trial;
  assessments: CriterionAssessment[];
  evidence: EvidenceSnippet[];
  timeline: TimelineEvent[];
  audit: AuditEvent[];
  missingData: MissingDataSignal[];
  contradictions: ContradictionSignal[];
  piHandoff?: PiHandoffPacket;
  screeningJob?: ScreeningJob;
  engineVersions?: ScreeningEngineVersions;
}

// Re-exported here for co-location with MatchReviewPackage. Canonical definition is in collab.ts.
export type { AuditEvent, PiHandoffPacket } from "./collab.ts";
