import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readJsonFile, writeJsonFile } from "../storage.ts";
import type { HandoffRecord } from "../types.ts";
import type { ResearchDigestDetail } from "../research/types.ts";
import {
  updateTrialReviewCommitDecision,
  upsertCommittedHandoff,
  upsertCommittedResearchDigest,
  upsertTrialReviewCommitFromRun,
} from "./domainCommits.ts";
import type {
  AiRun,
  AiRunStatus,
  AiRunUpsertInput,
  AiVersionSnapshot,
  HumanOverride,
  ReviewAuditEvent,
  ReviewCommitPayload,
  ReviewDecisionPayload,
  ReviewRerunPayload,
  ReviewRuntimeStorePayload,
  TrialReviewCommitPayload,
} from "./types.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const runtimeFile = join(currentDir, "..", "..", ".runtime", "ai-review-runs.json");
const DEFAULT_ACTOR_ID = "local-reviewer";
const DEFAULT_ALLOWED_ACTIONS = [
  "approve_as_is",
  "edit_output",
  "edit_input_and_rerun",
  "modify_evidence",
  "override",
  "reject",
  "escalate_manual_review",
  "finalize_apply",
  "revert_to_ai_draft",
] satisfies AiRun["allowedActions"];

let reviewRuns: AiRun[] | null = null;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function initialStatus(policy: AiRunUpsertInput["policy"]): AiRunStatus {
  return policy === "preview_only" ? "draft" : "needs_review";
}

function createVersion(
  output: unknown,
  input: unknown,
  actorType: "ai" | "human" | "system",
  actorId: string,
  rationale?: string,
  selectedCitationIds?: string[],
): AiVersionSnapshot {
  return {
    output,
    input,
    rationale,
    selectedCitationIds,
    actorType,
    actorId,
    createdAt: new Date().toISOString(),
  };
}

function defaultOverrides(
  originalValue: unknown,
  newValue: unknown,
  reason: string,
  fieldPath: string,
): HumanOverride[] {
  if (stableJson(originalValue) === stableJson(newValue)) {
    return [];
  }

  return [
    {
      fieldPath,
      originalValue,
      newValue,
      reason,
    },
  ];
}

function appendAudit(
  run: AiRun,
  actorId: string,
  actorType: "ai" | "human" | "system",
  eventType: string,
  payload: Record<string, unknown>,
): ReviewAuditEvent {
  return {
    id: createId("audit"),
    actorId,
    actorType,
    eventType,
    targetId: run.id,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function normalizeRun(run: AiRun): AiRun {
  return {
    ...run,
    allowedActions: [...(run.allowedActions ?? DEFAULT_ALLOWED_ACTIONS)],
    commitStatus: run.commitStatus ?? "pending",
    commitTargetType: run.commitTargetType ?? "none",
    commitTargetId: run.commitTargetId ?? run.entityId,
    committedAt: run.committedAt ?? null,
    commitError: run.commitError ?? null,
  };
}

async function loadRuns(): Promise<AiRun[]> {
  if (reviewRuns) {
    return reviewRuns;
  }

  const parsed = await readJsonFile<ReviewRuntimeStorePayload>(runtimeFile);
  reviewRuns = (parsed?.runs ?? []).map(normalizeRun);
  return reviewRuns;
}

async function persistRuns(): Promise<void> {
  await writeJsonFile(runtimeFile, {
    updatedAt: new Date().toISOString(),
    runs: reviewRuns ?? [],
  } satisfies ReviewRuntimeStorePayload);
}

function ensureRunsLoaded(runs: AiRun[]): AiRun[] {
  reviewRuns = runs;
  return reviewRuns;
}

function createNewRun(input: AiRunUpsertInput): AiRun {
  const now = new Date().toISOString();
  const runId = createId("airun");
  const checkpointId = createId("checkpoint");

  return {
    id: runId,
    sourceKey: input.sourceKey,
    featureKey: input.featureKey,
    featureLabel: input.featureLabel,
    stageKey: input.stageKey,
    workspace: input.workspace,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    deepLink: input.deepLink,
    summary: input.summary,
    promptSnapshot: input.promptSnapshot,
    inputSnapshot: input.inputSnapshot,
    outputSnapshot: input.outputSnapshot,
    provider: input.provider ?? null,
    model: input.model ?? null,
    citations: input.citations ?? [],
    safetyFlags: input.safetyFlags ?? [],
    policy: input.policy,
    status: initialStatus(input.policy),
    allowedActions: [...(input.allowedActions ?? DEFAULT_ALLOWED_ACTIONS)],
    commitStatus: "pending",
    commitTargetType: input.commitTargetType ?? "none",
    commitTargetId: input.commitTargetId ?? input.entityId,
    committedAt: null,
    commitError: null,
    aiDraft: createVersion(
      input.outputSnapshot,
      input.inputSnapshot,
      "ai",
      input.provider ?? "ai-system",
      "Initial AI draft created.",
      (input.citations ?? []).map((citation) => citation.id),
    ),
    humanEdits: null,
    approvedVersion: null,
    finalizedVersion: null,
    latestDecision: null,
    reviewCheckpoints: [
      {
        id: checkpointId,
        runId,
        stageKey: input.stageKey,
        policy: input.policy,
        proposedAction: {
          kind: "review_ai_output",
          summary: input.summary,
        },
        editableFields: input.editableFields ?? ["outputSnapshot", "inputSnapshot", "citations"],
        requiredFields: input.requiredFields ?? ["rationale"],
        status: "pending",
        createdAt: now,
      },
    ],
    overrides: [],
    audit: [],
    createdAt: now,
    updatedAt: now,
  };
}

function updateExistingRun(existing: AiRun, input: AiRunUpsertInput): AiRun {
  const changed =
    stableJson(existing.promptSnapshot) !== stableJson(input.promptSnapshot) ||
    stableJson(existing.inputSnapshot) !== stableJson(input.inputSnapshot) ||
    stableJson(existing.outputSnapshot) !== stableJson(input.outputSnapshot) ||
    stableJson(existing.citations) !== stableJson(input.citations ?? []) ||
    stableJson(existing.safetyFlags) !== stableJson(input.safetyFlags ?? []) ||
    existing.provider !== (input.provider ?? null) ||
    existing.model !== (input.model ?? null) ||
    existing.summary !== input.summary;

  if (!changed) {
    return normalizeRun({
      ...existing,
      featureKey: input.featureKey,
      featureLabel: input.featureLabel,
      stageKey: input.stageKey,
      workspace: input.workspace,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      deepLink: input.deepLink,
      summary: input.summary,
      provider: input.provider ?? existing.provider ?? null,
      model: input.model ?? existing.model ?? null,
      allowedActions: [...(input.allowedActions ?? existing.allowedActions ?? DEFAULT_ALLOWED_ACTIONS)],
      commitTargetType: input.commitTargetType ?? existing.commitTargetType ?? "none",
      commitTargetId: input.commitTargetId ?? existing.commitTargetId ?? input.entityId,
    });
  }

  const updated: AiRun = {
    ...existing,
    featureKey: input.featureKey,
    featureLabel: input.featureLabel,
    stageKey: input.stageKey,
    workspace: input.workspace,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    deepLink: input.deepLink,
    summary: input.summary,
    promptSnapshot: input.promptSnapshot,
    inputSnapshot: input.inputSnapshot,
    outputSnapshot: input.outputSnapshot,
    provider: input.provider ?? null,
    model: input.model ?? null,
    citations: input.citations ?? [],
    safetyFlags: input.safetyFlags ?? [],
    policy: input.policy,
    status: initialStatus(input.policy),
    allowedActions: [...(input.allowedActions ?? existing.allowedActions ?? DEFAULT_ALLOWED_ACTIONS)],
    commitStatus: "pending",
    commitTargetType: input.commitTargetType ?? existing.commitTargetType ?? "none",
    commitTargetId: input.commitTargetId ?? existing.commitTargetId ?? input.entityId,
    committedAt: null,
    commitError: null,
    aiDraft: createVersion(
      input.outputSnapshot,
      input.inputSnapshot,
      "ai",
      input.provider ?? "ai-system",
      "AI draft refreshed after rerun or new output.",
      (input.citations ?? []).map((citation) => citation.id),
    ),
    humanEdits: null,
    approvedVersion: null,
    finalizedVersion: null,
    latestDecision: null,
    overrides: [],
    reviewCheckpoints: existing.reviewCheckpoints.map((checkpoint) => ({
      ...checkpoint,
      policy: input.policy,
      proposedAction: {
        kind: "review_ai_output",
        summary: input.summary,
      },
      editableFields: input.editableFields ?? checkpoint.editableFields,
      requiredFields: input.requiredFields ?? checkpoint.requiredFields,
      status: "pending",
      decidedAt: undefined,
      lastDecisionId: undefined,
    })),
    updatedAt: new Date().toISOString(),
    audit: existing.audit,
  };

  return updated;
}

function currentEffectiveVersion(run: AiRun): AiVersionSnapshot {
  return run.finalizedVersion ?? run.approvedVersion ?? run.humanEdits ?? run.aiDraft;
}

function updateCheckpointStatus(
  run: AiRun,
  decisionId: string,
  status: AiRun["reviewCheckpoints"][number]["status"],
): AiRun["reviewCheckpoints"] {
  return run.reviewCheckpoints.map((checkpoint) => ({
    ...checkpoint,
    status,
    lastDecisionId: decisionId,
    decidedAt: new Date().toISOString(),
  }));
}

function applyDecision(run: AiRun, payload: ReviewDecisionPayload): AiRun {
  const actorId = payload.actorId?.trim() || DEFAULT_ACTOR_ID;
  const decisionId = createId("decision");
  const selectedCitationIds =
    payload.selectedCitationIds ?? run.citations.map((citation) => citation.id);
  const now = new Date().toISOString();
  let next: AiRun = {
    ...run,
    updatedAt: now,
  };

  switch (payload.action) {
    case "approve_as_is": {
      next = {
        ...next,
        status: "approved",
        commitStatus: "pending",
        committedAt: null,
        commitError: null,
        approvedVersion: createVersion(
          run.outputSnapshot,
          run.inputSnapshot,
          "human",
          actorId,
          payload.rationale,
          selectedCitationIds,
        ),
        humanEdits: null,
        overrides: [],
        reviewCheckpoints: updateCheckpointStatus(next, decisionId, "approved"),
      };
      break;
    }
    case "edit_output":
    case "override":
    case "modify_evidence": {
      const editedOutput =
        payload.editedOutput ?? currentEffectiveVersion(run).output;
      next = {
        ...next,
        status: "overridden",
        commitStatus: "pending",
        committedAt: null,
        commitError: null,
        humanEdits: createVersion(
          editedOutput,
          payload.editedInput ?? currentEffectiveVersion(run).input,
          "human",
          actorId,
          payload.rationale,
          selectedCitationIds,
        ),
        approvedVersion: createVersion(
          editedOutput,
          payload.editedInput ?? currentEffectiveVersion(run).input,
          "human",
          actorId,
          payload.rationale,
          selectedCitationIds,
        ),
        overrides: [
          ...defaultOverrides(run.outputSnapshot, editedOutput, payload.rationale, "outputSnapshot"),
          ...defaultOverrides(
            run.citations.map((citation) => citation.id),
            selectedCitationIds,
            payload.rationale,
            "citations",
          ),
        ],
        reviewCheckpoints: updateCheckpointStatus(next, decisionId, "overridden"),
      };
      break;
    }
    case "edit_input_and_rerun": {
      next = {
        ...next,
        status: initialStatus(run.policy),
        commitStatus: "pending",
        committedAt: null,
        commitError: null,
        humanEdits: createVersion(
          currentEffectiveVersion(run).output,
          payload.editedInput ?? currentEffectiveVersion(run).input,
          "human",
          actorId,
          payload.rationale,
          selectedCitationIds,
        ),
        overrides: defaultOverrides(
          run.inputSnapshot,
          payload.editedInput ?? run.inputSnapshot,
          payload.rationale,
          "inputSnapshot",
        ),
      };
      break;
    }
    case "reject": {
      next = {
        ...next,
        status: "rejected",
        commitStatus: "pending",
        committedAt: null,
        commitError: null,
        reviewCheckpoints: updateCheckpointStatus(next, decisionId, "rejected"),
      };
      break;
    }
    case "escalate_manual_review": {
      next = {
        ...next,
        status: "needs_review",
        commitStatus: "pending",
        committedAt: null,
        commitError: null,
        reviewCheckpoints: updateCheckpointStatus(next, decisionId, "escalated"),
      };
      break;
    }
    case "finalize_apply": {
      const effective = currentEffectiveVersion(run);
      next = {
        ...next,
        status: "finalized",
        commitStatus: "pending",
        committedAt: null,
        commitError: null,
        finalizedVersion: createVersion(
          payload.editedOutput ?? effective.output,
          payload.editedInput ?? effective.input,
          "human",
          actorId,
          payload.rationale,
          selectedCitationIds,
        ),
        reviewCheckpoints: updateCheckpointStatus(next, decisionId, "finalized"),
      };
      break;
    }
    case "revert_to_ai_draft": {
      next = {
        ...next,
        status: initialStatus(run.policy),
        commitStatus: "pending",
        committedAt: null,
        commitError: null,
        humanEdits: null,
        approvedVersion: null,
        finalizedVersion: null,
        overrides: [],
        reviewCheckpoints: updateCheckpointStatus(next, decisionId, "pending"),
      };
      break;
    }
  }

  next.latestDecision = {
    ...payload,
    actorId,
    actorType: "human",
    decidedAt: now,
  };

  const audit = appendAudit(next, actorId, "human", payload.action, {
    checkpointId: payload.checkpointId,
    rationale: payload.rationale,
    editedOutputProvided: payload.editedOutput != null,
    editedInputProvided: payload.editedInput != null,
    selectedCitationIds,
  });

  return {
    ...next,
    reviewCheckpoints: next.reviewCheckpoints,
    updatedAt: now,
    // The audit list is stored externally in the runtime payload by convention.
    // We tuck the event into the checkpoint payload through an internal symbol.
    // The HTTP layer reads the cached audit store via listReviewAudit.
    __audit: [...listReviewAudit(run), audit],
  } as AiRun & { __audit: ReviewAuditEvent[] };
}

function applyRerunRequest(run: AiRun, payload: ReviewRerunPayload): AiRun {
  const actorId = payload.actorId?.trim() || DEFAULT_ACTOR_ID;
  const next = {
    ...run,
    status: initialStatus(run.policy),
    commitStatus: "pending" as const,
    committedAt: null,
    commitError: null,
    humanEdits: createVersion(
      currentEffectiveVersion(run).output,
      payload.editedInput ?? currentEffectiveVersion(run).input,
      "human",
      actorId,
      payload.rationale,
      currentEffectiveVersion(run).selectedCitationIds,
    ),
    updatedAt: new Date().toISOString(),
  };
  const audit = appendAudit(next, actorId, "human", "rerun_requested", {
    rationale: payload.rationale,
    editedInputProvided: payload.editedInput != null,
  });

  return {
    ...next,
    __audit: [...listReviewAudit(run), audit],
  } as AiRun & { __audit: ReviewAuditEvent[] };
}

export function listReviewAudit(run: Pick<AiRun, "id">): ReviewAuditEvent[] {
  const runs = reviewRuns ?? [];
  return runs.find((candidate) => candidate.id === run.id)?.audit ?? [];
}

function resolveCommitVersion(run: AiRun): AiVersionSnapshot | null {
  return run.finalizedVersion ?? run.approvedVersion ?? null;
}

function assertCommitAllowed(run: AiRun, payload: ReviewCommitPayload): AiVersionSnapshot {
  if (run.commitTargetType === "none") {
    throw new Error("This AI feature is reviewable but does not support domain commit.");
  }
  if (!run.allowedActions.includes("finalize_apply")) {
    throw new Error("This AI feature does not allow finalize/apply actions.");
  }
  if (!run.reviewCheckpoints.some((checkpoint) => checkpoint.id === payload.checkpointId)) {
    throw new Error("The requested review checkpoint was not found for this AI run.");
  }
  const effective = resolveCommitVersion(run);
  if (!effective) {
    throw new Error("Finalize the reviewed output before committing it to domain state.");
  }
  if ((run.citations ?? []).length === 0) {
    throw new Error("Commit is blocked until supporting citations are attached.");
  }
  if ((run.safetyFlags ?? []).some((flag) => flag.severity !== "info")) {
    throw new Error("Commit is blocked until warning and critical safety flags are resolved.");
  }
  return effective;
}

async function applyCommit(run: AiRun, payload: ReviewCommitPayload): Promise<AiRun> {
  const actorId = payload.actorId?.trim() || DEFAULT_ACTOR_ID;
  const effective = assertCommitAllowed(run, payload);
  const now = new Date().toISOString();
  let committedTargetId = run.commitTargetId ?? run.entityId;

  if (run.commitTargetType === "trial_review") {
    const committed = await upsertTrialReviewCommitFromRun(
      run,
      effective.output as {
        overallEligibility?: "eligible" | "not_eligible" | "requires_review" | null;
        screeningMode?: "deterministic_first" | "full_record_llm" | null;
      },
      payload,
    );
    committedTargetId = committed.entityId;
  } else if (run.commitTargetType === "handoff") {
    const committed = await upsertCommittedHandoff(
      run,
      effective.output as HandoffRecord,
      payload,
    );
    committedTargetId = committed.handoffId;
  } else if (run.commitTargetType === "research_digest") {
    const committed = await upsertCommittedResearchDigest(
      run,
      effective.output as ResearchDigestDetail,
      payload,
      "published",
    );
    committedTargetId = committed.digestId;
  }

  const next: AiRun = {
    ...run,
    commitStatus: "applied",
    commitTargetId: committedTargetId,
    committedAt: now,
    commitError: null,
    updatedAt: now,
  };
  const audit = appendAudit(next, actorId, "human", "domain_commit_applied", {
    checkpointId: payload.checkpointId,
    rationale: payload.rationale,
    commitTargetType: run.commitTargetType,
    commitTargetId: committedTargetId,
  });
  return {
    ...next,
    audit: [...listReviewAudit(run), audit],
  };
}

function applyCommitFailure(run: AiRun, payload: ReviewCommitPayload, error: Error): AiRun {
  const actorId = payload.actorId?.trim() || DEFAULT_ACTOR_ID;
  const next: AiRun = {
    ...run,
    commitStatus: "failed",
    commitError: error.message,
    updatedAt: new Date().toISOString(),
  };
  const audit = appendAudit(next, actorId, "human", "domain_commit_failed", {
    checkpointId: payload.checkpointId,
    rationale: payload.rationale,
    commitTargetType: run.commitTargetType,
    error: error.message,
  });
  return {
    ...next,
    audit: [...listReviewAudit(run), audit],
  };
}

export async function listAiRuns(): Promise<AiRun[]> {
  return [...(await loadRuns())].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export async function listPendingAiRuns(): Promise<AiRun[]> {
  return (await listAiRuns()).filter((run) =>
    run.status === "draft" || run.status === "needs_review",
  );
}

export async function getAiRun(runId: string): Promise<AiRun | null> {
  const runs = await loadRuns();
  return runs.find((run) => run.id === runId) ?? null;
}

export async function upsertAiRun(input: AiRunUpsertInput): Promise<AiRun> {
  const runs = ensureRunsLoaded(await loadRuns());
  const existingIndex = runs.findIndex((run) => run.sourceKey === input.sourceKey);
  let next = existingIndex >= 0 ? updateExistingRun(runs[existingIndex], input) : createNewRun(input);

  const bootstrapAudit =
    existingIndex >= 0
      ? appendAudit(next, input.provider ?? "ai-system", "ai", "ai_draft_refreshed", {
          sourceKey: input.sourceKey,
          featureKey: input.featureKey,
        })
      : appendAudit(next, input.provider ?? "ai-system", "ai", "ai_draft_created", {
          sourceKey: input.sourceKey,
          featureKey: input.featureKey,
        });
  next = {
    ...next,
    audit: [...next.audit, bootstrapAudit],
  };

  if (existingIndex >= 0) {
    runs[existingIndex] = next;
  } else {
    runs.unshift(next);
  }

  reviewRuns = runs;
  await persistRuns();
  return next;
}

export async function recordReviewDecision(
  runId: string,
  payload: ReviewDecisionPayload,
): Promise<AiRun | null> {
  const runs = ensureRunsLoaded(await loadRuns());
  const index = runs.findIndex((run) => run.id === runId);
  if (index === -1) {
    return null;
  }

  const updated = applyDecision(runs[index], payload);
  const audit = (updated as AiRun & { __audit?: ReviewAuditEvent[] }).__audit;
  const sanitized = { ...updated } as AiRun & { __audit?: ReviewAuditEvent[] };
  if (audit) {
    sanitized.audit = audit;
  }
  delete sanitized.__audit;
  runs[index] = sanitized;
  reviewRuns = runs;
  await persistRuns();
  return sanitized;
}

export async function requestAiRunRerun(
  runId: string,
  payload: ReviewRerunPayload,
): Promise<AiRun | null> {
  const runs = ensureRunsLoaded(await loadRuns());
  const index = runs.findIndex((run) => run.id === runId);
  if (index === -1) {
    return null;
  }

  const updated = applyRerunRequest(runs[index], payload);
  const audit = (updated as AiRun & { __audit?: ReviewAuditEvent[] }).__audit;
  const sanitized = { ...updated } as AiRun & { __audit?: ReviewAuditEvent[] };
  if (audit) {
    sanitized.audit = audit;
  }
  delete sanitized.__audit;
  runs[index] = sanitized;
  reviewRuns = runs;
  await persistRuns();
  return sanitized;
}

export async function commitAiRun(
  runId: string,
  payload: ReviewCommitPayload,
): Promise<AiRun | null> {
  const runs = ensureRunsLoaded(await loadRuns());
  const index = runs.findIndex((run) => run.id === runId);
  if (index === -1) {
    return null;
  }

  try {
    const updated = await applyCommit(runs[index], payload);
    runs[index] = updated;
    reviewRuns = runs;
    await persistRuns();
    return updated;
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error("Unknown domain commit error.");
    const failed = applyCommitFailure(runs[index], payload, normalized);
    runs[index] = failed;
    reviewRuns = runs;
    await persistRuns();
    throw normalized;
  }
}

export async function archiveResearchDigestRun(
  runId: string,
  payload: ReviewCommitPayload,
): Promise<AiRun | null> {
  const runs = ensureRunsLoaded(await loadRuns());
  const index = runs.findIndex((run) => run.id === runId);
  if (index === -1) {
    return null;
  }

  const run = runs[index];
  const actorId = payload.actorId?.trim() || DEFAULT_ACTOR_ID;
  const effective = assertCommitAllowed(run, payload);
  if (run.commitTargetType !== "research_digest") {
    throw new Error("Archive is only supported for research digest runs.");
  }

  const committed = await upsertCommittedResearchDigest(
    run,
    effective.output as ResearchDigestDetail,
    payload,
    "archived",
  );
  const next: AiRun = {
    ...run,
    commitStatus: "applied",
    commitTargetId: committed.digestId,
    committedAt: committed.committedAt,
    commitError: null,
    updatedAt: committed.committedAt,
  };
  const audit = appendAudit(next, actorId, "human", "domain_commit_archived", {
    checkpointId: payload.checkpointId,
    rationale: payload.rationale,
    commitTargetType: run.commitTargetType,
    commitTargetId: committed.digestId,
  });
  runs[index] = {
    ...next,
    audit: [...listReviewAudit(run), audit],
  };
  reviewRuns = runs;
  await persistRuns();
  return runs[index];
}

export async function commitTrialReviewDecision(
  entityId: string,
  payload: TrialReviewCommitPayload & { runId: string; featureLabel: string },
): Promise<AiRun | null> {
  const committed = await updateTrialReviewCommitDecision(entityId, payload);
  const runs = ensureRunsLoaded(await loadRuns());
  const index = runs.findIndex((run) => run.id === payload.runId);
  if (index === -1) {
    return null;
  }

  const run = runs[index];
  const actorId = payload.actorId?.trim() || DEFAULT_ACTOR_ID;
  const next: AiRun = {
    ...run,
    commitStatus: "applied",
    commitTargetType: "trial_review",
    commitTargetId: committed.entityId,
    committedAt: committed.committedAt,
    commitError: null,
    updatedAt: committed.committedAt,
  };
  const audit = appendAudit(next, actorId, "human", "trial_review_decision_applied", {
    checkpointId: payload.checkpointId,
    rationale: payload.rationale,
    disposition: payload.disposition ?? null,
    finalRecommendation: payload.finalRecommendation ?? null,
    override: payload.override ?? null,
    entityId,
  });
  runs[index] = {
    ...next,
    audit: [...listReviewAudit(run), audit],
  };
  reviewRuns = runs;
  await persistRuns();
  return runs[index];
}
