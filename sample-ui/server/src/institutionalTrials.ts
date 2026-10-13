import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DECOMPOSE_PROTOCOL_FEATURE_KEY,
  DECOMPOSE_PROTOCOL_SYSTEM,
  buildDecomposeProtocolUserPrompt,
} from "../../src/lib/ai/prompts/decomposeProtocol.ts";
import {
  DecompositionResponseSchema,
  type DecompositionResponse,
} from "../../src/lib/ai/schemas.ts";
import { compileCriterionForScreening } from "../../src/lib/screening/patientTrialEvaluator.ts";
import {
  normalizedCriteria as seedCriteria,
  trials as seedTrials,
  trialVersions as seedTrialVersions,
} from "../../src/data/mockData.ts";
import type {
  ImportedTrialRecord,
  InstitutionalTrial,
  InstitutionalTrialCatalogStore,
  InstitutionalTrialVersion,
  NormalizedCriterion,
  NormalizedCriterionVersion,
  NormalizationJob,
  ProtocolArtifact,
  ReviewGate,
  TrialSourceRecord,
} from "../../src/types/clinical.ts";
import { getServerLlmGateway } from "./llmGateway.ts";
import { readJsonFile, writeJsonFile } from "./storage.ts";

interface InstitutionalRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
  url: URL;
}

interface NormalizationMutationResponse {
  trial: InstitutionalTrial;
  trialVersion: InstitutionalTrialVersion;
  normalizationJob: NormalizationJob;
  criteriaVersion?: NormalizedCriterionVersion;
}

export interface ImportedTrialPromotionResponse extends NormalizationMutationResponse {
  institutionalTrialId: string;
  createdDraft: boolean;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const runtimeFile = join(currentDir, "..", ".runtime", "institutional-trials.json");
const NORMALIZATION_PROMPT_VERSION = "f1.normalizeInstitutionalTrial.v1";

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

function buildSeedEligibilityText(criteria: NormalizedCriterion[]): string {
  const inclusion = criteria
    .filter((criterion) => criterion.type === "inclusion")
    .map(
      (criterion, index) =>
        `${index + 1}. ${criterion.label}: ${criterion.sourceText ?? criterion.threshold}`,
    );
  const exclusion = criteria
    .filter((criterion) => criterion.type === "exclusion")
    .map(
      (criterion, index) =>
        `${index + 1}. ${criterion.label}: ${criterion.sourceText ?? criterion.threshold}`,
    );

  return [
    "Inclusion Criteria:",
    ...(inclusion.length > 0 ? inclusion : ["None provided."]),
    "",
    "Exclusion Criteria:",
    ...(exclusion.length > 0 ? exclusion : ["None provided."]),
  ].join("\n");
}

function mergeUniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    seen.set(item.id, item);
  }
  return [...seen.values()];
}

function isTrialVisible(trial: InstitutionalTrial): boolean {
  return (trial.uiVisibility ?? "visible") !== "hidden";
}

function buildSeedCriteriaVersion(
  trialId: string,
  versionLabel: string,
  protocolArtifactId: string,
  criteria: NormalizedCriterion[],
): NormalizedCriterionVersion {
  const compiled = criteria.map((criterion) => ({
    ...compileCriterionForScreening({
      ...criterion,
      trialId,
      normalizationSource: "deterministic_seed",
      sourceLocation: criterion.sourceLocation ?? protocolArtifactId,
      deterministicParseOutput:
        criterion.deterministicParseOutput ?? criterion.sourceText ?? criterion.threshold,
    }),
    normalizationSource: "deterministic_seed" as const,
    sourceLocation: criterion.sourceLocation ?? protocolArtifactId,
    deterministicParseOutput:
      criterion.deterministicParseOutput ?? criterion.sourceText ?? criterion.threshold,
  }));

  return {
    id: makeId("criteria-version", `${trialId}-${normalizeVersionLabel(versionLabel)}`),
    trialId,
    versionLabel,
    status: "approved",
    normalizationSource: "deterministic_seed",
    protocolArtifactId,
    normalizationJobId: makeId("normalization-job", `${trialId}-seed`),
    criteria: compiled,
    deterministicCriteria: compiled,
    llmNormalizedCriteria: [],
    promptVersion: "seed.determine.v1",
    modelRunId: "seeded-catalog",
    provider: "deterministic-seed",
    model: "rule-bootstrap",
    generatedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
  };
}

function buildSeedNormalizationJob(
  trialId: string,
  protocolArtifactId: string,
  criteriaVersion: NormalizedCriterionVersion,
  sourceText: string,
): NormalizationJob {
  return {
    id: makeId("normalization-job", `${trialId}-seed`),
    trialId,
    protocolArtifactId,
    status: "approved",
    normalizationSource: "deterministic_seed",
    reviewGate: "human_optional",
    sourceText,
    sourceLocation: protocolArtifactId,
    deterministicCriteria: criteriaVersion.criteria,
    llmNormalizedCriteria: [],
    finalCriteria: criteriaVersion.criteria,
    promptVersion: "seed.determine.v1",
    modelRunId: "seeded-catalog",
    provider: "deterministic-seed",
    model: "rule-bootstrap",
    warnings: [],
    startedAt: criteriaVersion.generatedAt,
    completedAt: criteriaVersion.generatedAt,
  };
}

function buildSeedStore(
  existing?: InstitutionalTrialCatalogStore | null,
): InstitutionalTrialCatalogStore {
  const existingTrials = new Map(existing?.items.map((item) => [item.id, item]) ?? []);
  const existingVersionsByTrial = new Map<string, InstitutionalTrialVersion[]>();
  for (const version of existing?.versions ?? []) {
    const bucket = existingVersionsByTrial.get(version.trialId) ?? [];
    bucket.push(version);
    existingVersionsByTrial.set(version.trialId, bucket);
  }
  const existingCriteriaVersionsByTrial = new Map<string, NormalizedCriterionVersion[]>();
  for (const version of existing?.criteriaVersions ?? []) {
    const bucket = existingCriteriaVersionsByTrial.get(version.trialId) ?? [];
    bucket.push(version);
    existingCriteriaVersionsByTrial.set(version.trialId, bucket);
  }
  const existingJobsByTrial = new Map<string, NormalizationJob[]>();
  for (const job of existing?.normalizationJobs ?? []) {
    const bucket = existingJobsByTrial.get(job.trialId) ?? [];
    bucket.push(job);
    existingJobsByTrial.set(job.trialId, bucket);
  }

  const nextItems: InstitutionalTrial[] = [];
  const nextVersions: InstitutionalTrialVersion[] = [];
  const nextSourceRecords: TrialSourceRecord[] = [];
  const nextProtocolArtifacts: ProtocolArtifact[] = [];
  const nextCriteriaVersions: NormalizedCriterionVersion[] = [];
  const nextNormalizationJobs: NormalizationJob[] = [];
  const seedTrialIds = new Set(seedTrials.map((trial) => trial.id));

  for (const trial of seedTrials) {
    const protocolArtifactId = makeId("protocol-artifact", `${trial.id}-${normalizeVersionLabel(trial.protocolVersion)}`);
    const criteria = seedCriteria
      .filter((criterion) => criterion.trialId === trial.id)
      .map((criterion) => ({
        ...criterion,
        sourceLocation: criterion.sourceLocation ?? protocolArtifactId,
        deterministicParseOutput:
          criterion.deterministicParseOutput ?? criterion.sourceText ?? criterion.threshold,
      }));
    const sourceText = buildSeedEligibilityText(criteria);
    const seedCriteriaVersion = buildSeedCriteriaVersion(
      trial.id,
      trial.protocolVersion,
      protocolArtifactId,
      criteria,
    );
    const seedJob = buildSeedNormalizationJob(
      trial.id,
      protocolArtifactId,
      seedCriteriaVersion,
      sourceText,
    );
    const priorCriteriaVersions = existingCriteriaVersionsByTrial.get(trial.id) ?? [];
    const priorJobs = existingJobsByTrial.get(trial.id) ?? [];
    const activeCriteriaVersion =
      priorCriteriaVersions.find((version) => version.status === "approved") ?? seedCriteriaVersion;
    const activeJob =
      priorJobs.find((job) => job.status === "approved") ?? seedJob;

    const oncoreSourceRecordId = makeId("trial-source", `${trial.id}-oncore`);
    const protocolSourceRecordId = makeId("trial-source", `${trial.id}-protocol`);

    nextSourceRecords.push(
      {
        id: oncoreSourceRecordId,
        trialId: trial.id,
        sourceKind: "oncore",
        sourceId: `ONCORE-${trial.shortCode}`,
        label: `${trial.shortCode} local activation`,
        lastSyncedAt: new Date().toISOString(),
        metadata: {
          pilotScope: "true",
          localStatus: trial.localStatus,
        },
      },
      {
        id: protocolSourceRecordId,
        trialId: trial.id,
        sourceKind: "protocol_repository",
        sourceId: protocolArtifactId,
        label: `${trial.shortCode} protocol repository`,
        lastSyncedAt: new Date().toISOString(),
        metadata: {
          protocolVersion: trial.protocolVersion,
        },
      },
    );

    nextProtocolArtifacts.push({
      id: protocolArtifactId,
      trialId: trial.id,
      versionLabel: trial.protocolVersion,
      sourceKind: "protocol_repository",
      title: `${trial.shortCode} protocol`,
      sourceLocation: `mock://protocols/${trial.id}/${normalizeVersionLabel(trial.protocolVersion)}`,
      extractedEligibilityText: sourceText,
      amendmentDate: seedTrialVersions.find((version) => version.trialId === trial.id)?.releasedAt,
      importedAt: new Date().toISOString(),
    });

    nextVersions.push(
      ...(existingVersionsByTrial.get(trial.id) ?? []).length > 0
        ? existingVersionsByTrial.get(trial.id)!
        : seedTrialVersions
            .filter((version) => version.trialId === trial.id)
            .map(
              (version): InstitutionalTrialVersion => ({
                ...version,
                sourceKind: "protocol_repository",
                protocolArtifactId,
                criteriaVersionId: activeCriteriaVersion.id,
              }),
            ),
    );

    nextCriteriaVersions.push(...mergeUniqueById([...priorCriteriaVersions, seedCriteriaVersion]));
    nextNormalizationJobs.push(...mergeUniqueById([...priorJobs, seedJob]));

    const priorTrial = existingTrials.get(trial.id);
    nextItems.push({
      ...trial,
      canonicalSourceKind: "oncore",
      pilotScope: true,
      nctId: priorTrial?.nctId,
      oncoreTrialId: priorTrial?.oncoreTrialId ?? `ONCORE-${trial.shortCode}`,
      linkedImportedTrialId: priorTrial?.linkedImportedTrialId,
      latestCriteriaVersionId: priorTrial?.latestCriteriaVersionId ?? activeCriteriaVersion.id,
      latestNormalizationJobId: priorTrial?.latestNormalizationJobId ?? activeJob.id,
      normalizationStatus: priorTrial?.normalizationStatus ?? "approved",
      lastSyncedAt: new Date().toISOString(),
      sourceRecordIds: [oncoreSourceRecordId, protocolSourceRecordId],
      protocolArtifactIds: [protocolArtifactId],
      uiVisibility: priorTrial?.uiVisibility ?? "visible",
      hiddenAt: priorTrial?.hiddenAt,
    });
  }

  const preservedItems = (existing?.items ?? []).filter((item) => !seedTrialIds.has(item.id));
  const preservedVersions = (existing?.versions ?? []).filter(
    (version) => !seedTrialIds.has(version.trialId),
  );
  const preservedCriteriaVersions = (existing?.criteriaVersions ?? []).filter(
    (version) => !seedTrialIds.has(version.trialId),
  );
  const preservedNormalizationJobs = (existing?.normalizationJobs ?? []).filter(
    (job) => !seedTrialIds.has(job.trialId),
  );

  return {
    updatedAt: new Date().toISOString(),
    items: mergeUniqueById([...preservedItems, ...nextItems]),
    versions: mergeUniqueById([...preservedVersions, ...nextVersions]),
    sourceRecords: mergeUniqueById([...(existing?.sourceRecords ?? []), ...nextSourceRecords]),
    protocolArtifacts: mergeUniqueById([
      ...(existing?.protocolArtifacts ?? []),
      ...nextProtocolArtifacts,
    ]),
    criteriaVersions: mergeUniqueById([
      ...preservedCriteriaVersions,
      ...nextCriteriaVersions,
    ]),
    normalizationJobs: mergeUniqueById([
      ...preservedNormalizationJobs,
      ...nextNormalizationJobs,
    ]),
  };
}

function getPreferredCriteriaVersion(
  store: InstitutionalTrialCatalogStore,
  trial: InstitutionalTrial,
): NormalizedCriterionVersion | undefined {
  return (
    store.criteriaVersions.find(
      (version) =>
        version.id === trial.latestCriteriaVersionId && version.status === "approved",
    ) ??
    store.criteriaVersions.find(
      (version) => version.trialId === trial.id && version.status === "approved",
    )
  );
}

function getProtocolArtifactForTrial(
  store: InstitutionalTrialCatalogStore,
  trial: InstitutionalTrial,
): ProtocolArtifact | undefined {
  return (
    trial.protocolArtifactIds
      .map((artifactId) =>
        store.protocolArtifacts.find((artifact) => artifact.id === artifactId),
      )
      .find(Boolean) ??
    store.protocolArtifacts.find((artifact) => artifact.trialId === trial.id)
  );
}

export function makePromotedInstitutionalTrialId(importedTrialId: string): string {
  return `inst-${importedTrialId}`;
}

function buildImportedDraftCriteria(
  importedTrial: ImportedTrialRecord,
  institutionalTrialId: string,
  baseJobId: string,
): NormalizedCriterion[] {
  return importedTrial.criteria.map((criterion, index) => ({
    ...criterion,
    id: makeId("norm", `${institutionalTrialId}-${String(index + 1).padStart(3, "0")}`),
    trialId: institutionalTrialId,
    normalizationJobId: criterion.normalizationJobId ?? baseJobId,
    normalizationSource: criterion.normalizationSource ?? "deterministic_seed",
    sourceLocation: criterion.sourceLocation ?? importedTrial.projection.sourceUrl,
    deterministicParseOutput:
      criterion.deterministicParseOutput ?? criterion.sourceText ?? criterion.threshold,
  }));
}

function buildImportedDraftVersion(
  importedTrial: ImportedTrialRecord,
  institutionalTrialId: string,
  protocolArtifactId: string,
): InstitutionalTrialVersion {
  const sourceVersion = importedTrial.versions[0];

  return {
    id: makeId(
      "trial-version",
      `${institutionalTrialId}-${normalizeVersionLabel(importedTrial.projection.protocolVersion)}`,
    ),
    trialId: institutionalTrialId,
    version: sourceVersion?.version ?? importedTrial.projection.protocolVersion,
    releasedAt: sourceVersion?.releasedAt ?? importedTrial.fetchedAt.split("T")[0],
    summary:
      sourceVersion?.summary ??
      "Institutional draft created from a ClinicalTrials.gov import. Local protocol review and activation still need confirmation.",
    status: sourceVersion?.status ?? "Draft institutional import",
    sourceKind: "clinicaltrials_gov",
    protocolArtifactId,
  };
}

export async function promoteImportedTrialToInstitutionalDraft(
  importedTrial: ImportedTrialRecord,
): Promise<{
  trial: InstitutionalTrial;
  trialVersion: InstitutionalTrialVersion;
  createdDraft: boolean;
}> {
  const store = await readInstitutionalTrialCatalog();
  const institutionalTrialId = makePromotedInstitutionalTrialId(importedTrial.projection.id);
  const existingTrial = store.items.find((item) => item.id === institutionalTrialId);
  const now = new Date().toISOString();
  const protocolArtifactId = makeId(
    "protocol-artifact",
    `${institutionalTrialId}-${normalizeVersionLabel(importedTrial.projection.protocolVersion)}`,
  );
  const registrySourceRecordId = makeId("trial-source", `${institutionalTrialId}-clinicaltrials`);

  const protocolArtifact: ProtocolArtifact = {
    id: protocolArtifactId,
    trialId: institutionalTrialId,
    versionLabel: importedTrial.projection.protocolVersion,
    sourceKind: "clinicaltrials_gov",
    title: `${importedTrial.projection.shortCode} registry import`,
    sourceLocation: importedTrial.projection.sourceUrl,
    extractedEligibilityText: importedTrial.projection.eligibilityRawText,
    amendmentDate: importedTrial.versions[0]?.releasedAt,
    importedAt: now,
  };

  const trialVersion = buildImportedDraftVersion(
    importedTrial,
    institutionalTrialId,
    protocolArtifactId,
  );

  const trial: InstitutionalTrial = {
    id: institutionalTrialId,
    shortCode: importedTrial.projection.shortCode,
    title: importedTrial.projection.title,
    diseaseArea: importedTrial.projection.diseaseArea,
    phase: importedTrial.projection.phase,
    localStatus: "review",
    activationState:
      "Imported from ClinicalTrials.gov and promoted into an institutional draft; local activation unverified",
    protocolVersion: importedTrial.projection.protocolVersion,
    pi: importedTrial.projection.pi,
    screeningWindow: importedTrial.projection.screeningWindow,
    releaseState: "Institutional draft",
    canonicalSourceKind: "clinicaltrials_gov",
    pilotScope: false,
    nctId: importedTrial.nctId,
    linkedImportedTrialId: importedTrial.projection.id,
    latestCriteriaVersionId: existingTrial?.latestCriteriaVersionId,
    latestNormalizationJobId: existingTrial?.latestNormalizationJobId,
    normalizationStatus: existingTrial?.normalizationStatus ?? "draft",
    lastSyncedAt: now,
    sourceRecordIds: mergeUniqueById([
      ...(existingTrial?.sourceRecordIds ?? []).map((id) => ({ id })),
      { id: registrySourceRecordId },
    ]).map((item) => item.id),
    protocolArtifactIds: mergeUniqueById([
      ...(existingTrial?.protocolArtifactIds ?? []).map((id) => ({ id })),
      { id: protocolArtifactId },
    ]).map((item) => item.id),
    uiVisibility: existingTrial?.uiVisibility ?? "visible",
    hiddenAt: existingTrial?.hiddenAt,
  };

  const nextStore: InstitutionalTrialCatalogStore = {
    ...store,
    updatedAt: now,
    items: mergeUniqueById([...store.items, trial]),
    versions: mergeUniqueById([...store.versions, trialVersion]),
    sourceRecords: mergeUniqueById([
      ...store.sourceRecords,
      {
        id: registrySourceRecordId,
        trialId: institutionalTrialId,
        sourceKind: "clinicaltrials_gov",
        sourceId: importedTrial.nctId,
        label: `${importedTrial.projection.shortCode} registry import`,
        lastSyncedAt: now,
        metadata: {
          importedTrialId: importedTrial.projection.id,
          screeningIntent: importedTrial.projection.screeningIntent,
          registryStatus: importedTrial.projection.registryOverallStatus ?? "unknown",
        },
      },
    ]),
    protocolArtifacts: mergeUniqueById([...store.protocolArtifacts, protocolArtifact]),
  };

  await writeInstitutionalTrialCatalog(nextStore);

  return {
    trial: nextStore.items.find((item) => item.id === institutionalTrialId) ?? trial,
    trialVersion:
      nextStore.versions.find((version) => version.id === trialVersion.id) ?? trialVersion,
    createdDraft: !existingTrial,
  };
}

function coerceReviewGate(criteria: NormalizedCriterion[]): ReviewGate {
  return criteria.some((criterion) => criterion.computability === "manual_only")
    ? "policy_locked_manual_only"
    : criteria.some((criterion) => criterion.normalizationConfidence === "low")
      ? "human_required"
      : "human_optional";
}

function mapLlmCriteria(
  trialId: string,
  jobId: string,
  criteria: DecompositionResponse["criteria"],
): NormalizedCriterion[] {
  return criteria.map((criterion, index) => {
    const mapped: NormalizedCriterion = {
      id: makeId("norm", `${trialId}-${String(index + 1).padStart(3, "0")}`),
      trialId,
      label: criterion.label,
      type: criterion.type,
      computability: criterion.computability,
      threshold: criterion.threshold,
      owner: "LLM normalization",
      note:
        criterion.reviewNote ??
        "LLM-assisted normalization candidate generated from institutional source text.",
      conceptTags: criterion.normalizedConcepts,
      protocolSource: criterion.source.pageRef,
      qaStatus:
        criterion.computability === "manual_only" ? "manual_only" : "needs_review",
      normalizationConfidence: criterion.confidence,
      sourceText: criterion.source.originalText,
      sourceLocation: criterion.source.pageRef,
      llmNormalizedOutput: JSON.stringify(criterion),
      normalizationJobId: jobId,
      normalizationSource: "llm_assisted",
      countsTowardAutomationReadiness: true,
    };

    return {
      ...compileCriterionForScreening(mapped),
      normalizationJobId: jobId,
      normalizationSource: "llm_assisted",
      llmNormalizedOutput: JSON.stringify(criterion),
    };
  });
}

export async function writeInstitutionalTrialCatalog(
  store: InstitutionalTrialCatalogStore,
) : Promise<InstitutionalTrialCatalogStore> {
  await writeJsonFile(runtimeFile, store);
  return store;
}

export async function readInstitutionalTrialCatalog(): Promise<InstitutionalTrialCatalogStore> {
  const parsed = await readJsonFile<InstitutionalTrialCatalogStore>(runtimeFile);
  if (!parsed) {
    const seeded = buildSeedStore();
    await writeInstitutionalTrialCatalog(seeded);
    return seeded;
  }

  const merged = buildSeedStore(parsed);
  await writeInstitutionalTrialCatalog(merged);
  return merged;
}

export async function bootstrapInstitutionalTrialCatalog(): Promise<void> {
  await readInstitutionalTrialCatalog();
}

export async function syncInstitutionalTrialCatalog(): Promise<InstitutionalTrialCatalogStore> {
  const current = await readJsonFile<InstitutionalTrialCatalogStore>(runtimeFile);
  const synced = buildSeedStore(current);
  await writeInstitutionalTrialCatalog(synced);
  return synced;
}

export async function normalizeInstitutionalTrial(
  trialId: string,
  runtimeMode: "demo" | "live" | undefined,
): Promise<NormalizationMutationResponse> {
  const store = await readInstitutionalTrialCatalog();
  const trial = store.items.find((item) => item.id === trialId && isTrialVisible(item));
  if (!trial) {
    throw new Error(`Institutional trial ${trialId} was not found.`);
  }

  const protocolArtifact = getProtocolArtifactForTrial(store, trial);
  const baseCriteriaVersion = getPreferredCriteriaVersion(store, trial);
  const activeTrialVersion =
    store.versions.find((version) => version.trialId === trialId) ??
    buildSeedStore().versions.find((version) => version.trialId === trialId);
  const deterministicCriteria = baseCriteriaVersion?.criteria ?? [];
  const startedAt = new Date().toISOString();
  const jobId = makeId("normalization-job", `${trialId}-${Date.now()}`);

  let llmCriteria: NormalizedCriterion[] = [];
  let status: NormalizationJob["status"] = "needs_review";
  let provider: string | undefined;
  let model: string | undefined;
  let modelRunId: string | undefined;
  const warnings: string[] = [];
  let errorMessage: string | undefined;

  try {
    const sourceText =
      protocolArtifact?.extractedEligibilityText ?? buildSeedEligibilityText(deterministicCriteria);
    const result = await getServerLlmGateway().generate({
      featureKey: DECOMPOSE_PROTOCOL_FEATURE_KEY,
      promptVersion: NORMALIZATION_PROMPT_VERSION,
      runtimeMode,
      system: DECOMPOSE_PROTOCOL_SYSTEM,
      user: buildDecomposeProtocolUserPrompt(sourceText),
      schema: DecompositionResponseSchema,
      temperature: 0,
      maxTokens: 2400,
    });

    llmCriteria = mapLlmCriteria(trialId, jobId, result.value.criteria);
    provider = result.provider;
    model = result.model;
    modelRunId = result.modelRunId;
    warnings.push(
      "Normalization created a review draft. Human review and approval are required before this candidate replaces the active institutional criteria version.",
    );
  } catch (error) {
    status = "error";
    errorMessage = error instanceof Error ? error.message : "Normalization failed.";
    warnings.push(
      "LLM-assisted normalization failed; deterministic seed criteria remain the active screening source.",
    );
  }

  const sourceText =
    protocolArtifact?.extractedEligibilityText ?? buildSeedEligibilityText(deterministicCriteria);
  const finalCriteria =
    llmCriteria.length > 0 ? llmCriteria : deterministicCriteria;
  const reviewGate =
    status === "error" ? "human_required" : coerceReviewGate(finalCriteria);
  const completedAt = new Date().toISOString();

  const normalizationJob: NormalizationJob = {
    id: jobId,
    trialId,
    protocolArtifactId: protocolArtifact?.id,
    status,
    normalizationSource: llmCriteria.length > 0 ? "llm_assisted" : "deterministic_seed",
    reviewGate,
    sourceText,
    sourceLocation: protocolArtifact?.sourceLocation,
    deterministicCriteria,
    llmNormalizedCriteria: llmCriteria,
    finalCriteria,
    promptVersion: NORMALIZATION_PROMPT_VERSION,
    modelRunId,
    provider,
    model,
    warnings,
    errorMessage,
    startedAt,
    completedAt,
  };

  const nextStore: InstitutionalTrialCatalogStore = {
    ...store,
    updatedAt: completedAt,
    items: store.items.map((item) =>
      item.id === trialId
        ? {
            ...item,
            latestNormalizationJobId: normalizationJob.id,
            normalizationStatus: status,
            lastSyncedAt: completedAt,
          }
        : item,
    ),
    normalizationJobs: [...store.normalizationJobs, normalizationJob],
  };

  await writeInstitutionalTrialCatalog(nextStore);

  const nextTrial = nextStore.items.find((item) => item.id === trialId);
  if (!nextTrial) {
    throw new Error(`Institutional trial ${trialId} disappeared during normalization.`);
  }

  const nextTrialVersion =
    nextStore.versions.find((version) => version.trialId === trialId) ?? activeTrialVersion;
  if (!nextTrialVersion) {
    throw new Error(`Institutional trial version ${trialId} disappeared during normalization.`);
  }

  return {
    trial: nextTrial,
    trialVersion: nextTrialVersion,
    normalizationJob,
  };
}

export async function getInstitutionalCriteriaVersion(
  trialId: string,
): Promise<NormalizedCriterionVersion | null> {
  const store = await readInstitutionalTrialCatalog();
  const trial = store.items.find((item) => item.id === trialId && isTrialVisible(item));
  if (!trial) {
    return null;
  }
  return getPreferredCriteriaVersion(store, trial) ?? null;
}

export async function handleInstitutionalTrialApiRequest({
  request,
  response,
  path,
  url,
}: InstitutionalRequestContext): Promise<boolean> {
  if (request.method === "GET" && path === "/trials/institutional") {
    sendJson(response, 200, await readInstitutionalTrialCatalog());
    return true;
  }

  if (request.method === "POST" && path === "/trials/sync/institutional") {
    sendJson(response, 200, await syncInstitutionalTrialCatalog());
    return true;
  }

  const normalizeMatch = path.match(/^\/trials\/([^/]+)\/normalize$/);
  if (request.method === "POST" && normalizeMatch) {
    const runtimeMode = url.searchParams.get("runtimeMode");
    sendJson(
      response,
      200,
      await normalizeInstitutionalTrial(
        normalizeMatch[1],
        runtimeMode === "demo" || runtimeMode === "live" ? runtimeMode : undefined,
      ),
    );
    return true;
  }

  const criteriaVersionMatch = path.match(/^\/trials\/([^/]+)\/criteria-version$/);
  if (request.method === "GET" && criteriaVersionMatch) {
    const criteriaVersion = await getInstitutionalCriteriaVersion(criteriaVersionMatch[1]);
    if (!criteriaVersion) {
      sendJson(response, 404, {
        error: `No active criteria version exists for institutional trial ${criteriaVersionMatch[1]}.`,
      });
      return true;
    }
    sendJson(response, 200, criteriaVersion);
    return true;
  }

  return false;
}
