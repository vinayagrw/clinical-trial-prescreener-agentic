export type ReviewPolicy =
  | "preview_only"
  | "required_before_continue"
  | "required_before_apply";

export type AiRunStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "overridden"
  | "rejected"
  | "finalized";

export type ReviewCommitStatus = "pending" | "applied" | "failed";
export type ReviewCommitTargetType =
  | "none"
  | "trial_review"
  | "handoff"
  | "research_digest";

export type ReviewerDecisionAction =
  | "approve_as_is"
  | "edit_output"
  | "edit_input_and_rerun"
  | "modify_evidence"
  | "override"
  | "reject"
  | "escalate_manual_review"
  | "finalize_apply"
  | "revert_to_ai_draft";

export type ReviewCheckpointStatus =
  | "pending"
  | "approved"
  | "overridden"
  | "rejected"
  | "finalized"
  | "escalated";

export interface AiReviewCitation {
  id: string;
  label: string;
  detail: string;
  quote?: string;
  sourceId?: string;
  tone: "supporting" | "warning" | "context";
}

export interface AiReviewSafetyFlag {
  id: string;
  label: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface AiVersionSnapshot {
  output: unknown;
  input?: unknown;
  selectedCitationIds?: string[];
  rationale?: string;
  createdAt: string;
  actorId: string;
  actorType: "ai" | "human" | "system";
}

export interface HumanOverride {
  fieldPath: string;
  originalValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface ReviewCheckpoint {
  id: string;
  runId: string;
  stageKey: string;
  policy: ReviewPolicy;
  proposedAction: {
    kind: string;
    summary: string;
  };
  editableFields: string[];
  requiredFields: string[];
  status: ReviewCheckpointStatus;
  createdAt: string;
  decidedAt?: string;
  lastDecisionId?: string;
}

export interface ReviewerDecision {
  checkpointId: string;
  action: ReviewerDecisionAction;
  rationale: string;
  editedOutput?: unknown;
  editedInput?: unknown;
  selectedCitationIds?: string[];
  disposition?: string;
  finalRecommendation?: string;
}

export interface ReviewAuditEvent {
  id: string;
  actorId: string;
  actorType: "ai" | "human" | "system";
  eventType: string;
  targetId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AiRun {
  id: string;
  sourceKey: string;
  featureKey: string;
  featureLabel: string;
  stageKey: string;
  workspace: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  deepLink: string;
  summary: string;
  promptSnapshot: unknown;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  provider?: string | null;
  model?: string | null;
  citations: AiReviewCitation[];
  safetyFlags: AiReviewSafetyFlag[];
  policy: ReviewPolicy;
  status: AiRunStatus;
  allowedActions: ReviewerDecisionAction[];
  commitStatus: ReviewCommitStatus;
  commitTargetType: ReviewCommitTargetType;
  commitTargetId?: string | null;
  committedAt?: string | null;
  commitError?: string | null;
  aiDraft: AiVersionSnapshot;
  humanEdits?: AiVersionSnapshot | null;
  approvedVersion?: AiVersionSnapshot | null;
  finalizedVersion?: AiVersionSnapshot | null;
  latestDecision?: (ReviewerDecision & {
    actorId: string;
    actorType: "human" | "system";
    decidedAt: string;
  }) | null;
  reviewCheckpoints: ReviewCheckpoint[];
  overrides: HumanOverride[];
  audit: ReviewAuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AiRunUpsertInput {
  sourceKey: string;
  featureKey: string;
  featureLabel: string;
  stageKey: string;
  workspace: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  deepLink: string;
  summary: string;
  promptSnapshot: unknown;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  provider?: string | null;
  model?: string | null;
  citations?: AiReviewCitation[];
  safetyFlags?: AiReviewSafetyFlag[];
  policy: ReviewPolicy;
  allowedActions?: ReviewerDecisionAction[];
  commitTargetType?: ReviewCommitTargetType;
  commitTargetId?: string | null;
  editableFields?: string[];
  requiredFields?: string[];
}

export interface AiRunAuditResponse {
  runId: string;
  audit: ReviewAuditEvent[];
}

export interface AiRunListResponse {
  items: AiRun[];
}

export interface ReviewDecisionPayload extends ReviewerDecision {
  actorId?: string;
}

export interface ReviewRerunPayload {
  actorId?: string;
  rationale: string;
  editedInput?: unknown;
}

export interface ReviewCommitPayload {
  actorId?: string;
  checkpointId: string;
  rationale: string;
}

export interface TrialReviewCommit {
  id: string;
  entityId: string;
  patientId: string;
  trialId: string;
  runId: string;
  checkpointId: string;
  featureLabel: string;
  overallEligibility: "eligible" | "not_eligible" | "requires_review" | null;
  screeningMode: "deterministic_first" | "full_record_llm" | null;
  disposition?: string;
  finalRecommendation?: string | null;
  latestOverride?: {
    criterionId: string;
    criterionLabel: string;
    reviewerStatus: string;
    rationale: string;
    updatedAt: string;
  } | null;
  rationale: string;
  actorId: string;
  committedAt: string;
}

export interface TrialReviewCommitPayload extends ReviewCommitPayload {
  override?: {
    criterionId: string;
    criterionLabel: string;
    reviewerStatus: string;
  };
  disposition?: string;
  finalRecommendation?: string;
}

export interface HandoffPublicationCommit {
  id: string;
  handoffId: string;
  runId: string;
  checkpointId: string;
  featureLabel: string;
  rationale: string;
  actorId: string;
  committedAt: string;
  record: import("./handoff.js").HandoffRecord;
}

export interface ResearchDigestPublicationCommit {
  id: string;
  digestId: string;
  runId: string;
  checkpointId: string;
  featureLabel: string;
  rationale: string;
  actorId: string;
  committedAt: string;
  publicationState: "published" | "archived";
  detail: import("./research.js").ResearchDigestDetail;
}
