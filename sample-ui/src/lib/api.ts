import type {
  AiRun,
  AiRunAuditResponse,
  AiRunListResponse,
  AiRunUpsertInput,
  CreateInstitutionalProjectInput,
  CreateResearchProfileInput,
  GenerateDigestInput,
  GenerateDigestResult,
  HandoffAuditResponse,
  HandoffPublicationCommit,
  HandoffRecord,
  ImportedTrialNormalizationResponse,
  InstitutionalTrial,
  InstitutionalTrialCatalogStore,
  InstitutionalTrialVersion,
  ImportedTrialRecord,
  ImportedTrialsRuntimeStore,
  IngestRunResult,
  InstitutionalProject,
  NormalizationJob,
  NormalizedCriterionVersion,
  PatientCatalogItem,
  PatientCatalogRuntimeStore,
  PatientRemovalResult,
  PatientDocumentsResponse,
  PublicationDetail,
  RecomputeResult,
  ResearchDigestDetail,
  ResearchDigestPublicationCommit,
  ResearchProfileDetail,
  ResearchProfileDigestsResponse,
  ResearchProfilesResponse,
  ScreeningRunResponse,
  CriterionAdjudication,
  NormalizationJobApprovalResponse,
  NormalizationJobReviewPayload,
  NormalizationJobReviewResponse,
  TrialRemovalResult,
  UpdateResearchProfileInput,
  WindowHours,
  WorklistResponse,
  ReviewDecisionPayload,
  ReviewCommitPayload,
  ReviewRerunPayload,
  TrialReviewCommit,
  TrialReviewCommitPayload,
} from "../types";
import { normalizeLocalApiError } from "./localApiErrors";

const API_BASE = import.meta.env.VITE_CLINICAL_API_BASE ?? "/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (error) {
    throw new Error(normalizeLocalApiError(error, "Unable to reach the local API."));
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      normalizeLocalApiError(
        message || `Request failed with status ${response.status}`,
        `Request failed with status ${response.status}`,
      ),
    );
  }

  return (await response.json()) as T;
}

export const handoffApi = {
  getWorklist() {
    return requestJson<WorklistResponse>("/worklist");
  },
  getHandoff(handoffId: string) {
    return requestJson<HandoffRecord>(`/handoffs/${handoffId}`);
  },
  getAudit(handoffId: string) {
    return requestJson<HandoffAuditResponse>(`/handoffs/${handoffId}/audit`);
  },
  getPatientDocuments(patientId: string, windowHours: WindowHours) {
    return requestJson<PatientDocumentsResponse>(
      `/patients/${patientId}/documents?windowHours=${windowHours}`,
    );
  },
  generateHandoff(input: {
    patientId?: string;
    encounterId?: string;
    windowHours: WindowHours;
  }) {
    return requestJson<HandoffRecord>("/handoffs/generate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  reindexDocuments() {
    return requestJson<{ reindexed: boolean; documentCount: number; handoffCount: number }>(
      "/documents/reindex",
      {
        method: "POST",
      },
    );
  },
  finalizeHandoff(handoffId: string, input: ReviewCommitPayload & { runId: string }) {
    return requestJson<AiRun>(`/handoffs/${handoffId}/finalize`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getFinalizedHandoff(handoffId: string) {
    return requestJson<HandoffPublicationCommit | null>(`/handoffs/${handoffId}/finalized`);
  },
};

export const aiReviewApi = {
  listRuns() {
    return requestJson<AiRunListResponse>("/ai/runs");
  },
  listPendingRuns() {
    return requestJson<AiRunListResponse>("/ai/reviews/pending");
  },
  upsertRun(input: AiRunUpsertInput) {
    return requestJson<AiRun>("/ai/runs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getRun(runId: string) {
    return requestJson<AiRun>(`/ai/runs/${runId}`);
  },
  getAudit(runId: string) {
    return requestJson<AiRunAuditResponse>(`/ai/runs/${runId}/audit`);
  },
  submitDecision(runId: string, checkpointId: string, input: ReviewDecisionPayload) {
    return requestJson<AiRun>(`/ai/runs/${runId}/checkpoints/${checkpointId}/decision`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  requestRerun(runId: string, input: ReviewRerunPayload) {
    return requestJson<AiRun>(`/ai/runs/${runId}/rerun`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  commitRun(runId: string, input: ReviewCommitPayload) {
    return requestJson<AiRun>(`/ai/runs/${runId}/commit`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export const trialReviewApi = {
  getCommit(entityId: string) {
    return requestJson<TrialReviewCommit>(`/trial-reviews/${encodeURIComponent(entityId)}`);
  },
  commit(
    entityId: string,
    input: TrialReviewCommitPayload & { runId: string; featureLabel: string },
  ) {
    return requestJson<AiRun>(`/trial-reviews/${encodeURIComponent(entityId)}/commit`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export const researchApi = {
  listProfiles() {
    return requestJson<ResearchProfilesResponse>("/research/profiles");
  },
  createProfile(input: CreateResearchProfileInput) {
    return requestJson<ResearchProfileDetail["profile"]>("/research/profiles", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getProfile(profileId: string) {
    return requestJson<ResearchProfileDetail>(`/research/profiles/${profileId}`);
  },
  updateProfile(profileId: string, input: UpdateResearchProfileInput) {
    return requestJson<ResearchProfileDetail["profile"]>(`/research/profiles/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  addProject(profileId: string, input: CreateInstitutionalProjectInput) {
    return requestJson<InstitutionalProject>(`/research/profiles/${profileId}/projects`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  listDigests(profileId: string) {
    return requestJson<ResearchProfileDigestsResponse>(`/research/profiles/${profileId}/digests`);
  },
  runIngest(profileId?: string) {
    return requestJson<IngestRunResult>("/research/ingest/run", {
      method: "POST",
      body: JSON.stringify(profileId ? { profileId } : {}),
    });
  },
  recompute(profileId?: string) {
    return requestJson<RecomputeResult>("/research/relevance/recompute", {
      method: "POST",
      body: JSON.stringify(profileId ? { profileId } : {}),
    });
  },
  generateDigests(input: GenerateDigestInput) {
    return requestJson<GenerateDigestResult>("/research/digests/generate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getDigest(digestId: string) {
    return requestJson<ResearchDigestDetail>(`/research/digests/${digestId}`);
  },
  getDigestPublication(digestId: string) {
    return requestJson<ResearchDigestPublicationCommit | null>(
      `/research/digests/${digestId}/publication`,
    );
  },
  publishDigest(digestId: string, input: ReviewCommitPayload & { runId: string }) {
    return requestJson<AiRun>(`/research/digests/${digestId}/publish`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  archiveDigest(digestId: string, input: ReviewCommitPayload & { runId: string }) {
    return requestJson<AiRun>(`/research/digests/${digestId}/archive`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getPublication(publicationId: string) {
    return requestJson<PublicationDetail>(`/research/publications/${publicationId}`);
  },
};

export const trialImportApi = {
  listImportedTrials() {
    return requestJson<ImportedTrialsRuntimeStore>("/trials/imports");
  },
  importClinicalTrial(nctId: string) {
    return requestJson<ImportedTrialRecord>("/trials/imports/clinicaltrialsgov", {
      method: "POST",
      body: JSON.stringify({ nctId }),
    });
  },
  getImportedTrial(nctId: string) {
    return requestJson<ImportedTrialRecord>(`/trials/imports/${nctId}`);
  },
  getImportedTrialRaw(nctId: string) {
    return requestJson<unknown>(`/trials/imports/${nctId}/raw`);
  },
  normalizeImportedTrial(
    trialId: string,
    runtimeMode?: "demo" | "live",
  ) {
    const query = runtimeMode ? `?runtimeMode=${runtimeMode}` : "";
    return requestJson<ImportedTrialNormalizationResponse>(
      `/trials/imports/${encodeURIComponent(trialId)}/normalize${query}`,
      {
        method: "POST",
      },
    );
  },
};

export const patientCatalogApi = {
  listPatientCatalog() {
    return requestJson<PatientCatalogRuntimeStore>("/patients/catalog");
  },
  uploadPatientRecord(input: { fileName: string; rawRecordText: string }) {
    return requestJson<PatientCatalogItem>("/patients/catalog/uploads", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  deletePatient(patientId: string) {
    return requestJson<PatientRemovalResult>(
      `/patients/catalog/${encodeURIComponent(patientId)}`,
      {
        method: "DELETE",
      },
    );
  },
  deleteUploadedPatient(patientId: string) {
    return requestJson<PatientRemovalResult>(
      `/patients/catalog/uploads/${encodeURIComponent(patientId)}`,
      {
        method: "DELETE",
      },
    );
  },
};

export const institutionalTrialApi = {
  listInstitutionalTrials() {
    return requestJson<InstitutionalTrialCatalogStore>("/trials/institutional");
  },
  syncInstitutionalTrials() {
    return requestJson<InstitutionalTrialCatalogStore>("/trials/sync/institutional", {
      method: "POST",
    });
  },
  normalizeInstitutionalTrial(
    trialId: string,
    runtimeMode?: "demo" | "live",
  ) {
    const query = runtimeMode ? `?runtimeMode=${runtimeMode}` : "";
    return requestJson<{
      trial: InstitutionalTrial;
      trialVersion: InstitutionalTrialVersion;
      normalizationJob: NormalizationJob;
    }>(`/trials/${trialId}/normalize${query}`, {
      method: "POST",
    });
  },
  getInstitutionalCriteriaVersion(trialId: string) {
    return requestJson<NormalizedCriterionVersion>(`/trials/${trialId}/criteria-version`);
  },
  removeTrial(trialId: string) {
    return requestJson<TrialRemovalResult>(`/trials/${encodeURIComponent(trialId)}`, {
      method: "DELETE",
    });
  },
};

export const normalizationJobApi = {
  reviewNormalizationJob(jobId: string, input: NormalizationJobReviewPayload) {
    return requestJson<NormalizationJobReviewResponse>(
      `/normalization-jobs/${encodeURIComponent(jobId)}/review`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },
  approveNormalizationJob(jobId: string, input: NormalizationJobReviewPayload) {
    return requestJson<NormalizationJobApprovalResponse>(
      `/normalization-jobs/${encodeURIComponent(jobId)}/approve`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};

export const screeningApi = {
  runPatientTrialScreening(input: {
    patientId: string;
    trialId: string;
    screeningMode: "deterministic_first" | "full_record_llm";
    runtimeMode?: "demo" | "live";
  }) {
    return requestJson<ScreeningRunResponse>(
      `/patients/${input.patientId}/screen/${input.trialId}`,
      {
        method: "POST",
        body: JSON.stringify({
          screeningMode: input.screeningMode,
          runtimeMode: input.runtimeMode,
        }),
      },
    );
  },
  adjudicateCriterion(input: {
    criterionId: string;
    patientId: string;
    trialId: string;
    runtimeMode?: "demo" | "live";
  }) {
    return requestJson<CriterionAdjudication>(
      `/criteria/${input.criterionId}/adjudicate`,
      {
        method: "POST",
        body: JSON.stringify({
          patientId: input.patientId,
          trialId: input.trialId,
          runtimeMode: input.runtimeMode,
        }),
      },
    );
  },
};
