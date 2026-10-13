import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readJsonFile, writeJsonFile } from "../storage.ts";
import type { HandoffRecord } from "../types.ts";
import type { ResearchDigestDetail } from "../research/types.ts";
import type {
  AiRun,
  HandoffPublicationCommit,
  ResearchDigestPublicationCommit,
  ReviewCommitPayload,
  TrialReviewCommit,
  TrialReviewCommitPayload,
} from "./types.ts";

interface DomainCommitStorePayload {
  updatedAt: string;
  trialReviews: TrialReviewCommit[];
  handoffs: HandoffPublicationCommit[];
  researchDigests: ResearchDigestPublicationCommit[];
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const runtimeFile = join(currentDir, "..", "..", ".runtime", "domain-review-commits.json");
const DEFAULT_ACTOR_ID = "local-reviewer";

let commitStore: DomainCommitStorePayload | null = null;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadCommitStore(): Promise<DomainCommitStorePayload> {
  if (commitStore) {
    return commitStore;
  }

  const parsed = await readJsonFile<DomainCommitStorePayload>(runtimeFile);
  commitStore = parsed ?? {
    updatedAt: new Date().toISOString(),
    trialReviews: [],
    handoffs: [],
    researchDigests: [],
  };
  return commitStore;
}

async function persistCommitStore(): Promise<void> {
  await writeJsonFile(runtimeFile, {
    ...(commitStore ?? {
      updatedAt: new Date().toISOString(),
      trialReviews: [],
      handoffs: [],
      researchDigests: [],
    }),
    updatedAt: new Date().toISOString(),
  } satisfies DomainCommitStorePayload);
}

export async function getTrialReviewCommit(entityId: string): Promise<TrialReviewCommit | null> {
  const store = await loadCommitStore();
  return store.trialReviews.find((item) => item.entityId === entityId) ?? null;
}

export async function upsertTrialReviewCommitFromRun(
  run: AiRun,
  output: {
    overallEligibility?: "eligible" | "not_eligible" | "requires_review" | null;
    screeningMode?: "deterministic_first" | "full_record_llm" | null;
  },
  payload: ReviewCommitPayload,
): Promise<TrialReviewCommit> {
  const store = await loadCommitStore();
  const input = (run.inputSnapshot ?? {}) as {
    patientId?: string;
    trialId?: string;
  };
  if (!input.patientId || !input.trialId) {
    throw new Error("Trial review commit is missing patientId or trialId.");
  }

  const actorId = payload.actorId?.trim() || DEFAULT_ACTOR_ID;
  const committedAt = new Date().toISOString();
  const existingIndex = store.trialReviews.findIndex((item) => item.entityId === run.entityId);
  const next: TrialReviewCommit = {
    id: existingIndex >= 0 ? store.trialReviews[existingIndex].id : createId("trial-review"),
    entityId: run.entityId,
    patientId: input.patientId,
    trialId: input.trialId,
    runId: run.id,
    checkpointId: payload.checkpointId,
    featureLabel: run.featureLabel,
    overallEligibility: output.overallEligibility ?? null,
    screeningMode: output.screeningMode ?? null,
    disposition:
      existingIndex >= 0 ? store.trialReviews[existingIndex].disposition : undefined,
    finalRecommendation:
      existingIndex >= 0 ? store.trialReviews[existingIndex].finalRecommendation : null,
    latestOverride:
      existingIndex >= 0 ? store.trialReviews[existingIndex].latestOverride ?? null : null,
    rationale: payload.rationale,
    actorId,
    committedAt,
  };

  if (existingIndex >= 0) {
    store.trialReviews[existingIndex] = next;
  } else {
    store.trialReviews.unshift(next);
  }
  commitStore = store;
  await persistCommitStore();
  return next;
}

export async function updateTrialReviewCommitDecision(
  entityId: string,
  payload: TrialReviewCommitPayload & { runId: string; featureLabel: string },
): Promise<TrialReviewCommit> {
  const store = await loadCommitStore();
  const existingIndex = store.trialReviews.findIndex((item) => item.entityId === entityId);
  if (existingIndex === -1) {
    throw new Error("No committed screening artifact exists for this patient/trial pair yet.");
  }

  const existing = store.trialReviews[existingIndex];
  const next: TrialReviewCommit = {
    ...existing,
    runId: payload.runId,
    checkpointId: payload.checkpointId,
    featureLabel: payload.featureLabel,
    rationale: payload.rationale,
    actorId: payload.actorId?.trim() || DEFAULT_ACTOR_ID,
    committedAt: new Date().toISOString(),
    disposition: payload.disposition ?? existing.disposition,
    finalRecommendation: payload.finalRecommendation ?? existing.finalRecommendation,
    latestOverride: payload.override
      ? {
          criterionId: payload.override.criterionId,
          criterionLabel: payload.override.criterionLabel,
          reviewerStatus: payload.override.reviewerStatus,
          rationale: payload.rationale,
          updatedAt: new Date().toISOString(),
        }
      : existing.latestOverride ?? null,
  };

  store.trialReviews[existingIndex] = next;
  commitStore = store;
  await persistCommitStore();
  return next;
}

export async function getCommittedHandoff(handoffId: string): Promise<HandoffPublicationCommit | null> {
  const store = await loadCommitStore();
  return store.handoffs.find((item) => item.handoffId === handoffId) ?? null;
}

export async function upsertCommittedHandoff(
  run: AiRun,
  record: HandoffRecord,
  payload: ReviewCommitPayload,
): Promise<HandoffPublicationCommit> {
  const store = await loadCommitStore();
  const existingIndex = store.handoffs.findIndex((item) => item.handoffId === record.id);
  const next: HandoffPublicationCommit = {
    id: existingIndex >= 0 ? store.handoffs[existingIndex].id : createId("handoff-commit"),
    handoffId: record.id,
    runId: run.id,
    checkpointId: payload.checkpointId,
    featureLabel: run.featureLabel,
    rationale: payload.rationale,
    actorId: payload.actorId?.trim() || DEFAULT_ACTOR_ID,
    committedAt: new Date().toISOString(),
    record,
  };

  if (existingIndex >= 0) {
    store.handoffs[existingIndex] = next;
  } else {
    store.handoffs.unshift(next);
  }
  commitStore = store;
  await persistCommitStore();
  return next;
}

export async function getResearchDigestCommit(
  digestId: string,
): Promise<ResearchDigestPublicationCommit | null> {
  const store = await loadCommitStore();
  return store.researchDigests.find((item) => item.digestId === digestId) ?? null;
}

export async function upsertCommittedResearchDigest(
  run: AiRun,
  detail: ResearchDigestDetail,
  payload: ReviewCommitPayload,
  publicationState: "published" | "archived" = "published",
): Promise<ResearchDigestPublicationCommit> {
  const store = await loadCommitStore();
  const existingIndex = store.researchDigests.findIndex((item) => item.digestId === detail.id);
  const next: ResearchDigestPublicationCommit = {
    id: existingIndex >= 0 ? store.researchDigests[existingIndex].id : createId("digest-commit"),
    digestId: detail.id,
    runId: run.id,
    checkpointId: payload.checkpointId,
    featureLabel: run.featureLabel,
    rationale: payload.rationale,
    actorId: payload.actorId?.trim() || DEFAULT_ACTOR_ID,
    committedAt: new Date().toISOString(),
    publicationState,
    detail,
  };

  if (existingIndex >= 0) {
    store.researchDigests[existingIndex] = next;
  } else {
    store.researchDigests.unshift(next);
  }
  commitStore = store;
  await persistCommitStore();
  return next;
}
