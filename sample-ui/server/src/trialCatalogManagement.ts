import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  InstitutionalTrial,
  InstitutionalTrialCatalogStore,
  TrialRemovalResult,
} from "../../src/types/clinical.ts";
import {
  readInstitutionalTrialCatalog,
  writeInstitutionalTrialCatalog,
} from "./institutionalTrials.ts";
import {
  getImportedTrialRecordByTrialId,
  getImportedTrialRecordByLinkedInstitutionalTrialId,
  readImportedTrialsStore,
  writeImportedTrialsStore,
} from "./trialImports.ts";

interface TrialCatalogRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
}

export class TrialCatalogWorkflowError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "TrialCatalogWorkflowError";
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

function isInstitutionalTrialVisible(trial: InstitutionalTrial): boolean {
  return (trial.uiVisibility ?? "visible") !== "hidden";
}

function isHardDeletableInstitutionalTrial(trial: InstitutionalTrial): boolean {
  return (
    trial.canonicalSourceKind === "clinicaltrials_gov" ||
    trial.linkedImportedTrialId != null
  );
}

function removeInstitutionalTrialArtifacts(
  store: InstitutionalTrialCatalogStore,
  trialId: string,
): InstitutionalTrialCatalogStore {
  const filteredItems = store.items.filter((item) => item.id !== trialId);
  const filteredVersions = store.versions.filter((version) => version.trialId !== trialId);
  const filteredSourceRecords = store.sourceRecords.filter(
    (record) => record.trialId !== trialId,
  );
  const filteredProtocolArtifacts = store.protocolArtifacts.filter(
    (artifact) => artifact.trialId !== trialId,
  );
  const filteredCriteriaVersions = store.criteriaVersions.filter(
    (version) => version.trialId !== trialId,
  );
  const filteredNormalizationJobs = store.normalizationJobs.filter(
    (job) => job.trialId !== trialId,
  );

  return {
    ...store,
    updatedAt: new Date().toISOString(),
    items: filteredItems,
    versions: filteredVersions,
    sourceRecords: filteredSourceRecords,
    protocolArtifacts: filteredProtocolArtifacts,
    criteriaVersions: filteredCriteriaVersions,
    normalizationJobs: filteredNormalizationJobs,
  };
}

function hideInstitutionalTrialInUi(
  store: InstitutionalTrialCatalogStore,
  trialId: string,
): InstitutionalTrialCatalogStore {
  const hiddenAt = new Date().toISOString();

  return {
    ...store,
    updatedAt: hiddenAt,
    items: store.items.map((item) =>
      item.id === trialId
        ? {
            ...item,
            uiVisibility: "hidden",
            hiddenAt,
          }
        : item,
    ),
  };
}

function buildRedirectTrialId(
  institutionalStore: InstitutionalTrialCatalogStore,
  importedStore: Awaited<ReturnType<typeof readImportedTrialsStore>>,
): string | undefined {
  const firstVisibleInstitutional = institutionalStore.items.find(isInstitutionalTrialVisible);
  if (firstVisibleInstitutional) {
    return firstVisibleInstitutional.id;
  }

  const firstVisibleImported = importedStore.items.find(
    (item) => item.projection.linkedInstitutionalTrialId == null,
  );
  return firstVisibleImported?.projection.id;
}

export async function resolveCanonicalInstitutionalTrialReference(
  requestedTrialId: string,
): Promise<{
  requestedTrialId: string;
  canonicalTrialId: string;
  trial: InstitutionalTrial;
  importedTrialId?: string;
}> {
  const institutionalCatalog = await readInstitutionalTrialCatalog();
  const directInstitutionalTrial = institutionalCatalog.items.find(
    (item) => item.id === requestedTrialId,
  );

  if (directInstitutionalTrial) {
    if (!isInstitutionalTrialVisible(directInstitutionalTrial)) {
      throw new TrialCatalogWorkflowError(
        404,
        `Trial ${requestedTrialId} has been removed from the UI.`,
      );
    }

    return {
      requestedTrialId,
      canonicalTrialId: directInstitutionalTrial.id,
      trial: directInstitutionalTrial,
      importedTrialId: directInstitutionalTrial.linkedImportedTrialId,
    };
  }

  const importedTrial = await getImportedTrialRecordByTrialId(requestedTrialId);
  if (!importedTrial) {
    throw new TrialCatalogWorkflowError(404, `Trial ${requestedTrialId} was not found.`);
  }

  const linkedInstitutionalTrialId = importedTrial.projection.linkedInstitutionalTrialId;
  if (!linkedInstitutionalTrialId) {
    throw new TrialCatalogWorkflowError(
      409,
      "This imported trial must be reviewed, approved, and promoted before screening.",
    );
  }

  const linkedInstitutionalTrial = institutionalCatalog.items.find(
    (item) => item.id === linkedInstitutionalTrialId,
  );
  if (!linkedInstitutionalTrial || !isInstitutionalTrialVisible(linkedInstitutionalTrial)) {
    throw new TrialCatalogWorkflowError(
      404,
      `Trial ${requestedTrialId} is no longer available for screening.`,
    );
  }

  return {
    requestedTrialId,
    canonicalTrialId: linkedInstitutionalTrial.id,
    trial: linkedInstitutionalTrial,
    importedTrialId: importedTrial.projection.id,
  };
}

export async function removeOrHideTrial(trialId: string): Promise<TrialRemovalResult> {
  let institutionalCatalog = await readInstitutionalTrialCatalog();
  let importedTrialsStore = await readImportedTrialsStore();
  const removedTrialIds: string[] = [];
  const hiddenTrialIds: string[] = [];
  let canonicalTrialId: string | undefined;
  let shouldPersistInstitutionalCatalog = false;
  let shouldPersistImportedStore = false;

  const directImportedTrial =
    importedTrialsStore.items.find((item) => item.projection.id === trialId) ?? null;

  if (directImportedTrial) {
    canonicalTrialId =
      directImportedTrial.projection.linkedInstitutionalTrialId ??
      directImportedTrial.projection.id;
    importedTrialsStore = {
      ...importedTrialsStore,
      updatedAt: new Date().toISOString(),
      items: importedTrialsStore.items.filter(
        (item) => item.projection.id !== directImportedTrial.projection.id,
      ),
    };
    removedTrialIds.push(directImportedTrial.projection.id);
    shouldPersistImportedStore = true;

    if (directImportedTrial.projection.linkedInstitutionalTrialId) {
      const linkedInstitutionalTrialId =
        directImportedTrial.projection.linkedInstitutionalTrialId;
      const linkedInstitutionalTrial = institutionalCatalog.items.find(
        (item) => item.id === linkedInstitutionalTrialId,
      );
      if (linkedInstitutionalTrial && isHardDeletableInstitutionalTrial(linkedInstitutionalTrial)) {
        institutionalCatalog = removeInstitutionalTrialArtifacts(
          institutionalCatalog,
          linkedInstitutionalTrialId,
        );
        removedTrialIds.push(linkedInstitutionalTrialId);
        shouldPersistInstitutionalCatalog = true;
      }
    }
  } else {
    const directInstitutionalTrial = institutionalCatalog.items.find(
      (item) => item.id === trialId,
    );
    if (!directInstitutionalTrial) {
      throw new TrialCatalogWorkflowError(404, `Trial ${trialId} was not found.`);
    }

    canonicalTrialId = directInstitutionalTrial.id;

    const linkedImportedTrial =
      (directInstitutionalTrial.linkedImportedTrialId
        ? importedTrialsStore.items.find(
            (item) => item.projection.id === directInstitutionalTrial.linkedImportedTrialId,
          ) ?? null
        : null) ??
      (await getImportedTrialRecordByLinkedInstitutionalTrialId(directInstitutionalTrial.id));

    if (isHardDeletableInstitutionalTrial(directInstitutionalTrial)) {
      institutionalCatalog = removeInstitutionalTrialArtifacts(
        institutionalCatalog,
        directInstitutionalTrial.id,
      );
      removedTrialIds.push(directInstitutionalTrial.id);
      shouldPersistInstitutionalCatalog = true;

      if (linkedImportedTrial) {
        importedTrialsStore = {
          ...importedTrialsStore,
          updatedAt: new Date().toISOString(),
          items: importedTrialsStore.items.filter(
            (item) => item.projection.id !== linkedImportedTrial.projection.id,
          ),
        };
        removedTrialIds.push(linkedImportedTrial.projection.id);
        shouldPersistImportedStore = true;
      }
    } else {
      institutionalCatalog = hideInstitutionalTrialInUi(
        institutionalCatalog,
        directInstitutionalTrial.id,
      );
      hiddenTrialIds.push(directInstitutionalTrial.id);
      shouldPersistInstitutionalCatalog = true;
    }
  }

  if (shouldPersistInstitutionalCatalog) {
    await writeInstitutionalTrialCatalog(institutionalCatalog);
  }

  if (shouldPersistImportedStore) {
    importedTrialsStore = await writeImportedTrialsStore(importedTrialsStore.items);
  }

  return {
    requestedTrialId: trialId,
    canonicalTrialId,
    removedTrialIds,
    hiddenTrialIds,
    redirectTrialId: buildRedirectTrialId(institutionalCatalog, importedTrialsStore),
  };
}

export async function handleTrialCatalogManagementApiRequest({
  request,
  response,
  path,
}: TrialCatalogRequestContext): Promise<boolean> {
  const removeMatch = path.match(/^\/trials\/([^/]+)$/);
  if (request.method !== "DELETE" || !removeMatch) {
    return false;
  }

  try {
    const result = await removeOrHideTrial(decodeURIComponent(removeMatch[1]));
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof TrialCatalogWorkflowError) {
      sendJson(response, error.statusCode, { error: error.message });
      return true;
    }

    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Trial removal failed.",
    });
  }

  return true;
}
