import type { IncomingMessage, ServerResponse } from "node:http";
import { compileCriterionForScreening } from "../../src/lib/screening/patientTrialEvaluator.ts";
import type {
  InstitutionalTrial,
  InstitutionalTrialCatalogStore,
  InstitutionalTrialVersion,
  NormalizationJob,
  NormalizationJobApprovalResponse,
  NormalizationJobReviewPayload,
  NormalizationJobReviewResponse,
  NormalizedCriterion,
  NormalizedCriterionVersion,
  ReviewGate,
} from "../../src/types/clinical.ts";
import {
  makePromotedInstitutionalTrialId,
  promoteImportedTrialToInstitutionalDraft,
  readInstitutionalTrialCatalog,
  writeInstitutionalTrialCatalog,
} from "./institutionalTrials.ts";
import {
  getImportedNormalizationJobById,
  getImportedTrialRecordByTrialId,
  linkImportedTrialToInstitutionalDraft,
  updateImportedNormalizationJob,
} from "./trialImports.ts";

interface NormalizationReviewRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
  readBody: (request: IncomingMessage) => Promise<unknown>;
}

class NormalizationReviewError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "NormalizationReviewError";
    this.statusCode = statusCode;
  }
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function makeId(prefix: string, suffix: string): string {
  return `${prefix}-${suffix}`;
}

function normalizeVersionLabel(value: string): string {
  return value.replace(/\s+/g, "-").toLowerCase();
}

function mergeUniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    seen.set(item.id, item);
  }
  return [...seen.values()];
}

function reviewGateForCriteria(criteria: NormalizedCriterion[]): ReviewGate {
  return criteria.some((criterion) => criterion.computability === "manual_only")
    ? "policy_locked_manual_only"
    : "human_required";
}

function compileReviewedCriteria(
  trialId: string,
  jobId: string,
  criteria: NormalizedCriterion[],
): NormalizedCriterion[] {
  return criteria.map((criterion, index) =>
    compileCriterionForScreening({
      ...criterion,
      id: criterion.id?.trim() || `norm-${trialId}-${String(index + 1).padStart(3, "0")}`,
      trialId,
      threshold:
        criterion.threshold?.trim() ||
        criterion.sourceText?.trim() ||
        criterion.label,
      owner: criterion.owner?.trim() || "Trial Admin reviewer",
      note: criterion.note?.trim() || "Edited during Trial Admin review.",
      qaStatus:
        criterion.computability === "manual_only" ? "manual_only" : "needs_review",
      sourceText:
        criterion.sourceText?.trim() || criterion.threshold?.trim() || criterion.label,
      sourceLocation:
        criterion.sourceLocation?.trim() || criterion.protocolSource,
      deterministicParseOutput:
        criterion.deterministicParseOutput ??
        criterion.sourceText ??
        criterion.threshold,
      normalizationJobId: jobId,
      normalizationSource: "reviewer_approved",
      countsTowardAutomationReadiness:
        criterion.countsTowardAutomationReadiness ??
        criterion.criterionCategory !== "administrative",
    }),
  );
}

function remapCriteriaToInstitutionalTrial(
  criteria: NormalizedCriterion[],
  institutionalTrialId: string,
  jobId: string,
): NormalizedCriterion[] {
  return criteria.map((criterion, index) =>
    compileCriterionForScreening({
      ...criterion,
      id: `norm-${institutionalTrialId}-${String(index + 1).padStart(3, "0")}`,
      trialId: institutionalTrialId,
      normalizationJobId: jobId,
      normalizationSource: "reviewer_approved",
      qaStatus:
        criterion.computability === "manual_only" ? "manual_only" : "approved",
    }),
  );
}

function applyReviewPayloadToJob(
  job: NormalizationJob,
  payload: NormalizationJobReviewPayload,
): NormalizationJob {
  const reviewedAt = new Date().toISOString();
  const finalCriteria = payload.finalCriteria
    ? compileReviewedCriteria(job.trialId, job.id, payload.finalCriteria)
    : job.finalCriteria;

  return {
    ...job,
    status: job.status === "approved" ? "approved" : "needs_review",
    reviewGate: reviewGateForCriteria(finalCriteria),
    finalCriteria,
    reviewedAt,
    reviewedBy: payload.reviewerName?.trim() || job.reviewedBy || "Local reviewer",
    reviewerNotes: payload.reviewerNotes?.trim() || job.reviewerNotes,
    completedAt: job.completedAt ?? reviewedAt,
  };
}

function publishApprovedCriteriaVersion(input: {
  trial: InstitutionalTrial;
  trialVersion: InstitutionalTrialVersion;
  store: InstitutionalTrialCatalogStore;
  job: NormalizationJob;
  sourceCriteria: NormalizedCriterion[];
}): {
  store: InstitutionalTrialCatalogStore;
  trial: InstitutionalTrial;
  trialVersion: InstitutionalTrialVersion;
  criteriaVersion: NormalizedCriterionVersion;
  normalizationJob: NormalizationJob;
} {
  const approvedAt = new Date().toISOString();
  const approvedJobId = makeId("normalization-job", `${input.trial.id}-${Date.now()}`);
  const deterministicCriteria = remapCriteriaToInstitutionalTrial(
    input.job.deterministicCriteria,
    input.trial.id,
    approvedJobId,
  );
  const llmCriteria = remapCriteriaToInstitutionalTrial(
    input.job.llmNormalizedCriteria,
    input.trial.id,
    approvedJobId,
  );
  const finalCriteria = remapCriteriaToInstitutionalTrial(
    input.sourceCriteria,
    input.trial.id,
    approvedJobId,
  );

  const approvedJob: NormalizationJob = {
    ...input.job,
    id: approvedJobId,
    trialId: input.trial.id,
    status: "approved",
    normalizationSource: "reviewer_approved",
    reviewGate: reviewGateForCriteria(finalCriteria),
    deterministicCriteria,
    llmNormalizedCriteria: llmCriteria,
    finalCriteria,
    warnings: [
      ...input.job.warnings,
      "Reviewer approved this normalization draft and published it into the institutional screening catalog.",
    ],
    completedAt: approvedAt,
    reviewedAt: input.job.reviewedAt ?? approvedAt,
    reviewedBy: input.job.reviewedBy ?? "Local reviewer",
  };

  const criteriaVersion: NormalizedCriterionVersion = {
    id: makeId(
      "criteria-version",
      `${input.trial.id}-${normalizeVersionLabel(input.trial.protocolVersion)}-${Date.now()}`,
    ),
    trialId: input.trial.id,
    versionLabel: `${input.trial.protocolVersion} reviewer approved`,
    status: "approved",
    normalizationSource: "reviewer_approved",
    protocolArtifactId: input.job.protocolArtifactId,
    normalizationJobId: approvedJob.id,
    criteria: finalCriteria,
    deterministicCriteria,
    llmNormalizedCriteria: llmCriteria,
    promptVersion: input.job.promptVersion,
    modelRunId: input.job.modelRunId,
    provider: input.job.provider,
    model: input.job.model,
    generatedAt: input.job.completedAt ?? input.job.startedAt,
    approvedAt,
  };

  const nextTrial: InstitutionalTrial = {
    ...input.trial,
    latestCriteriaVersionId: criteriaVersion.id,
    latestNormalizationJobId: approvedJob.id,
    normalizationStatus: "approved",
    lastSyncedAt: approvedAt,
  };
  const nextTrialVersion: InstitutionalTrialVersion = {
    ...input.trialVersion,
    criteriaVersionId: criteriaVersion.id,
  };

  return {
    store: {
      ...input.store,
      updatedAt: approvedAt,
      items: mergeUniqueById([
        ...input.store.items.map((trial) =>
          trial.id === nextTrial.id ? nextTrial : trial,
        ),
        nextTrial,
      ]),
      versions: mergeUniqueById([
        ...input.store.versions.map((version) =>
          version.trialId === nextTrial.id
            ? { ...version, criteriaVersionId: criteriaVersion.id }
            : version,
        ),
        nextTrialVersion,
      ]),
      criteriaVersions: mergeUniqueById([...input.store.criteriaVersions, criteriaVersion]),
      normalizationJobs: mergeUniqueById([...input.store.normalizationJobs, approvedJob]),
      sourceRecords: input.store.sourceRecords,
      protocolArtifacts: input.store.protocolArtifacts,
    },
    trial: nextTrial,
    trialVersion: nextTrialVersion,
    criteriaVersion,
    normalizationJob: approvedJob,
  };
}

async function reviewInstitutionalNormalizationJob(
  jobId: string,
  payload: NormalizationJobReviewPayload,
): Promise<NormalizationJobReviewResponse> {
  const store = await readInstitutionalTrialCatalog();
  const existingJob = store.normalizationJobs.find((job) => job.id === jobId);
  if (!existingJob) {
    throw new NormalizationReviewError(404, `Normalization job ${jobId} was not found.`);
  }

  const updatedJob = applyReviewPayloadToJob(existingJob, payload);
  const nextStore: InstitutionalTrialCatalogStore = {
    ...store,
    updatedAt: updatedJob.reviewedAt ?? new Date().toISOString(),
    items: store.items.map((trial) =>
      trial.id === updatedJob.trialId
        ? {
            ...trial,
            latestNormalizationJobId: updatedJob.id,
            normalizationStatus: "needs_review",
            lastSyncedAt: updatedJob.reviewedAt ?? trial.lastSyncedAt,
          }
        : trial,
    ),
    normalizationJobs: mergeUniqueById(
      store.normalizationJobs.map((job) => (job.id === jobId ? updatedJob : job)),
    ),
  };
  await writeInstitutionalTrialCatalog(nextStore);

  return {
    normalizationJob: updatedJob,
    trial: nextStore.items.find((trial) => trial.id === updatedJob.trialId),
  };
}

async function reviewImportedNormalizationJob(
  jobId: string,
  payload: NormalizationJobReviewPayload,
): Promise<NormalizationJobReviewResponse> {
  const importedRecord = await updateImportedNormalizationJob(jobId, (record, job) => {
    const updatedJob = applyReviewPayloadToJob(job, payload);
    return {
      ...record,
      latestNormalizationJobId: updatedJob.id,
      normalizationStatus: updatedJob.status,
      normalizationReviewState: "approved_for_promotion",
      normalizationJobs: record.normalizationJobs.map((candidate) =>
        candidate.id === jobId ? updatedJob : candidate,
      ),
    };
  });

  const normalizationJob =
    importedRecord.normalizationJobs.find((job) => job.id === jobId) ?? null;
  if (!normalizationJob) {
    throw new NormalizationReviewError(404, `Normalization job ${jobId} was not found.`);
  }

  return {
    normalizationJob,
    importedRecord,
  };
}

async function approveInstitutionalNormalizationJob(
  jobId: string,
  payload: NormalizationJobReviewPayload,
): Promise<NormalizationJobApprovalResponse> {
  const reviewed = await reviewInstitutionalNormalizationJob(jobId, payload);
  if (reviewed.normalizationJob.finalCriteria.length === 0) {
    throw new NormalizationReviewError(
      400,
      "At least one reviewed criterion is required before approval.",
    );
  }
  const store = await readInstitutionalTrialCatalog();
  const trial = store.items.find((item) => item.id === reviewed.normalizationJob.trialId);
  if (!trial) {
    throw new NormalizationReviewError(404, `Institutional trial ${reviewed.normalizationJob.trialId} was not found.`);
  }
  const trialVersion =
    store.versions.find((version) => version.trialId === trial.id) ??
    ({
      id: makeId("trial-version", `${trial.id}-${Date.now()}`),
      trialId: trial.id,
      version: trial.protocolVersion,
      releasedAt: new Date().toISOString().slice(0, 10),
      summary: "Reviewer-approved institutional criteria version.",
      status: "Reviewer approved",
      sourceKind: trial.canonicalSourceKind,
      protocolArtifactId: trial.protocolArtifactIds[0],
    } satisfies InstitutionalTrialVersion);

  const published = publishApprovedCriteriaVersion({
    trial,
    trialVersion,
    store,
    job: reviewed.normalizationJob,
    sourceCriteria: reviewed.normalizationJob.finalCriteria,
  });
  await writeInstitutionalTrialCatalog(published.store);

  return {
    normalizationJob: published.normalizationJob,
    trial: published.trial,
    trialVersion: published.trialVersion,
    criteriaVersion: published.criteriaVersion,
    institutionalTrialId: published.trial.id,
  };
}

async function approveImportedNormalizationJob(
  jobId: string,
  payload: NormalizationJobReviewPayload,
): Promise<NormalizationJobApprovalResponse> {
  const reviewed = await reviewImportedNormalizationJob(jobId, payload);
  if (!reviewed.importedRecord) {
    throw new NormalizationReviewError(404, `Imported normalization job ${jobId} was not found.`);
  }
  if (reviewed.normalizationJob.finalCriteria.length === 0) {
    throw new NormalizationReviewError(
      400,
      "At least one reviewed criterion is required before approval.",
    );
  }

  const importedRecord = await updateImportedNormalizationJob(jobId, (record, job) => ({
    ...record,
    latestNormalizationJobId: job.id,
    normalizationStatus: "approved",
    normalizationReviewState: "approved_for_promotion",
    normalizationJobs: record.normalizationJobs.map((candidate) =>
      candidate.id === jobId
        ? {
            ...job,
            status: "approved",
            reviewedAt: job.reviewedAt ?? new Date().toISOString(),
            reviewedBy: job.reviewedBy ?? payload.reviewerName ?? "Local reviewer",
            reviewerNotes: payload.reviewerNotes?.trim() || job.reviewerNotes,
          }
        : candidate,
    ),
  }));
  const approvedImportedJob =
    importedRecord.normalizationJobs.find((job) => job.id === jobId) ?? null;
  if (!approvedImportedJob) {
    throw new NormalizationReviewError(404, `Imported normalization job ${jobId} was not found.`);
  }

  const promoted = await promoteImportedTrialToInstitutionalDraft(importedRecord);
  const store = await readInstitutionalTrialCatalog();
  const trial = store.items.find((item) => item.id === promoted.trial.id);
  if (!trial) {
    throw new NormalizationReviewError(404, `Institutional draft ${promoted.trial.id} was not found.`);
  }
  const trialVersion =
    store.versions.find((version) => version.trialId === trial.id) ?? promoted.trialVersion;

  const published = publishApprovedCriteriaVersion({
    trial,
    trialVersion,
    store,
    job: approvedImportedJob,
    sourceCriteria: approvedImportedJob.finalCriteria,
  });
  await writeInstitutionalTrialCatalog(published.store);

  const linkedImportedRecord = await linkImportedTrialToInstitutionalDraft(
    importedRecord.projection.id,
    published.trial.id,
  );

  return {
    normalizationJob: approvedImportedJob,
    trial: published.trial,
    trialVersion: published.trialVersion,
    criteriaVersion: published.criteriaVersion,
    importedRecord: linkedImportedRecord,
    institutionalTrialId: published.trial.id,
    createdDraft: promoted.createdDraft,
  };
}

export async function handleNormalizationReviewApiRequest({
  request,
  response,
  path,
  readBody,
}: NormalizationReviewRequestContext): Promise<boolean> {
  const reviewMatch = path.match(/^\/normalization-jobs\/([^/]+)\/review$/);
  if (request.method === "PATCH" && reviewMatch) {
    const payload = ((await readBody(request)) ?? {}) as NormalizationJobReviewPayload;
    try {
      const importedJob = await getImportedNormalizationJobById(reviewMatch[1]);
      const result = importedJob
        ? await reviewImportedNormalizationJob(reviewMatch[1], payload)
        : await reviewInstitutionalNormalizationJob(reviewMatch[1], payload);
      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof NormalizationReviewError) {
        sendJson(response, error.statusCode, { error: error.message });
        return true;
      }
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Normalization review failed.",
      });
    }
    return true;
  }

  const approveMatch = path.match(/^\/normalization-jobs\/([^/]+)\/approve$/);
  if (request.method === "POST" && approveMatch) {
    const payload = ((await readBody(request)) ?? {}) as NormalizationJobReviewPayload;
    try {
      const importedJob = await getImportedNormalizationJobById(approveMatch[1]);
      const result = importedJob
        ? await approveImportedNormalizationJob(approveMatch[1], payload)
        : await approveInstitutionalNormalizationJob(approveMatch[1], payload);
      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof NormalizationReviewError) {
        sendJson(response, error.statusCode, { error: error.message });
        return true;
      }
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Normalization approval failed.",
      });
    }
    return true;
  }

  return false;
}
