import { create } from "zustand";
import type {
  InstitutionalTrial,
  InstitutionalTrialCatalogStore,
  InstitutionalTrialVersion,
  NormalizedCriterion,
  NormalizedCriterionVersion,
  NormalizationJob,
  TrialRemovalResult,
  TrialOption,
} from "../types/index.ts";
import { getImportedTrialByTrialId } from "./importedTrials.ts";

type InstitutionalTrialsStatus = "idle" | "loading" | "ready" | "error";

interface InstitutionalTrialsStore {
  status: InstitutionalTrialsStatus;
  updatedAt: string | null;
  items: InstitutionalTrial[];
  versions: InstitutionalTrialVersion[];
  criteriaVersions: NormalizedCriterionVersion[];
  normalizationJobs: NormalizationJob[];
  error: string | null;
  hydrate: (payload: InstitutionalTrialCatalogStore) => void;
  upsertCatalog: (payload: InstitutionalTrialCatalogStore) => void;
  upsertTrial: (trial: InstitutionalTrial) => void;
  upsertNormalizationJob: (job: NormalizationJob) => void;
  upsertNormalization: (input: {
    trial: InstitutionalTrial;
    trialVersion?: InstitutionalTrialVersion;
    criteriaVersion?: NormalizedCriterionVersion;
    normalizationJob: NormalizationJob;
  }) => void;
  applyRemovalResult: (result: TrialRemovalResult) => void;
  setLoading: () => void;
  setError: (message: string) => void;
}

function mergeById<T extends { id: string }>(existing: T[], next: T[]): T[] {
  const map = new Map(existing.map((item) => [item.id, item] as const));
  next.forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

export const useInstitutionalTrialsStore = create<InstitutionalTrialsStore>((set) => ({
  status: "idle",
  updatedAt: null,
  items: [],
  versions: [],
  criteriaVersions: [],
  normalizationJobs: [],
  error: null,
  hydrate: (payload) =>
    set({
      status: "ready",
      updatedAt: payload.updatedAt,
      items: payload.items,
      versions: payload.versions,
      criteriaVersions: payload.criteriaVersions,
      normalizationJobs: payload.normalizationJobs,
      error: null,
    }),
  upsertCatalog: (payload) =>
    set((state) => ({
      status: "ready",
      updatedAt: payload.updatedAt,
      items: mergeById(state.items, payload.items),
      versions: mergeById(state.versions, payload.versions),
      criteriaVersions: mergeById(state.criteriaVersions, payload.criteriaVersions),
      normalizationJobs: mergeById(state.normalizationJobs, payload.normalizationJobs),
      error: null,
    })),
  upsertTrial: (trial) =>
    set((state) => ({
      status: "ready",
      updatedAt: new Date().toISOString(),
      items: mergeById(state.items, [trial]),
      error: null,
    })),
  upsertNormalizationJob: (job) =>
    set((state) => ({
      status: "ready",
      updatedAt: job.completedAt ?? job.reviewedAt ?? job.startedAt,
      normalizationJobs: mergeById(state.normalizationJobs, [job]),
      error: null,
    })),
  upsertNormalization: ({ trial, trialVersion, criteriaVersion, normalizationJob }) =>
    set((state) => ({
      status: "ready",
      updatedAt:
        normalizationJob.completedAt ??
        normalizationJob.reviewedAt ??
        normalizationJob.startedAt,
      items: mergeById(state.items, [trial]),
      versions: trialVersion ? mergeById(state.versions, [trialVersion]) : state.versions,
      criteriaVersions: criteriaVersion
        ? mergeById(state.criteriaVersions, [criteriaVersion])
        : state.criteriaVersions,
      normalizationJobs: mergeById(state.normalizationJobs, [normalizationJob]),
      error: null,
    })),
  applyRemovalResult: (result) =>
    set((state) => {
      const removedTrialIds = new Set(result.removedTrialIds);
      const hiddenTrialIds = new Set(result.hiddenTrialIds);
      const hiddenAt = new Date().toISOString();

      return {
        updatedAt: hiddenAt,
        items: state.items
          .filter((trial) => !removedTrialIds.has(trial.id))
          .map((trial) =>
            hiddenTrialIds.has(trial.id)
              ? {
                  ...trial,
                  uiVisibility: "hidden" as const,
                  hiddenAt,
                }
              : trial,
          ),
        versions: state.versions.filter((version) => !removedTrialIds.has(version.trialId)),
        criteriaVersions: state.criteriaVersions.filter(
          (version) => !removedTrialIds.has(version.trialId),
        ),
        normalizationJobs: state.normalizationJobs.filter(
          (job) => !removedTrialIds.has(job.trialId),
        ),
      };
    }),
  setLoading: () =>
    set((state) => ({
      status: state.items.length > 0 ? state.status : "loading",
      error: null,
    })),
  setError: (message) =>
    set((state) => ({
      status: state.items.length > 0 ? state.status : "error",
      error: message,
    })),
}));

export function getInstitutionalTrialById(
  trialId: string,
): InstitutionalTrial | undefined {
  return useInstitutionalTrialsStore
    .getState()
    .items.find(
      (trial) =>
        trial.id === trialId && (trial.uiVisibility ?? "visible") !== "hidden",
    );
}

export function getInstitutionalTrialOptions(): TrialOption[] {
  return useInstitutionalTrialsStore
    .getState()
    .items.filter((trial) => (trial.uiVisibility ?? "visible") !== "hidden")
    .map((trial) => ({
      id: trial.id,
      label: `${trial.shortCode} | ${trial.title}`,
      status: trial.localStatus,
    }));
}

export function getScreenableInstitutionalTrialOptions(): TrialOption[] {
  return useInstitutionalTrialsStore
    .getState()
    .items.filter((trial) => {
      if ((trial.uiVisibility ?? "visible") === "hidden") {
        return false;
      }
      if (trial.localStatus === "inactive") {
        return false;
      }
      const approvedCriteriaVersion = getInstitutionalCriteriaVersionForTrial(trial.id);
      if (!approvedCriteriaVersion) {
        return false;
      }
      if (trial.pilotScope) {
        return true;
      }
      if (!trial.linkedImportedTrialId) {
        return false;
      }

      const linkedImportedTrial = getImportedTrialByTrialId(trial.linkedImportedTrialId);
      return linkedImportedTrial?.screeningIntent !== "retrospective_manual_only";
    })
    .map((trial) => ({
      id: trial.id,
      label: `${trial.shortCode} | ${trial.title}`,
      status: trial.localStatus,
    }));
}

export function getInstitutionalTrialVersionsForTrial(
  trialId: string,
): InstitutionalTrialVersion[] {
  if (!getInstitutionalTrialById(trialId)) {
    return [];
  }
  return useInstitutionalTrialsStore
    .getState()
    .versions.filter((version) => version.trialId === trialId);
}

export function getInstitutionalCriteriaVersionForTrial(
  trialId: string,
): NormalizedCriterionVersion | undefined {
  const state = useInstitutionalTrialsStore.getState();
  const trial = getInstitutionalTrialById(trialId);
  return (
    state.criteriaVersions.find(
      (version) =>
        version.id === trial?.latestCriteriaVersionId && version.status === "approved",
    ) ??
    state.criteriaVersions.find(
      (version) => version.trialId === trialId && version.status === "approved",
    )
  );
}

export function getInstitutionalNormalizedCriteriaForTrial(
  trialId: string,
): NormalizedCriterion[] {
  return getInstitutionalCriteriaVersionForTrial(trialId)?.criteria ?? [];
}

export function getInstitutionalNormalizationJobForTrial(
  trialId: string,
): NormalizationJob | undefined {
  const state = useInstitutionalTrialsStore.getState();
  const trial = getInstitutionalTrialById(trialId);
  return (
    state.normalizationJobs.find((job) => job.id === trial?.latestNormalizationJobId) ??
    state.normalizationJobs.find((job) => job.trialId === trialId)
  );
}
