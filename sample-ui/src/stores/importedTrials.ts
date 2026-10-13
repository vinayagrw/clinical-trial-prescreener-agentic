import { create } from "zustand";
import type {
  ImportedTrialListItem,
  ImportedTrialProjection,
  ImportedTrialRecord,
  ImportedTrialsRuntimeStore,
  NormalizedCriterion,
  TrialRemovalResult,
  TrialOption,
  TrialVersion,
} from "../types/index.ts";

type ImportedTrialsStatus = "idle" | "loading" | "ready" | "error";

interface ImportedTrialsStore {
  status: ImportedTrialsStatus;
  updatedAt: string | null;
  items: ImportedTrialListItem[];
  detailByNctId: Record<string, ImportedTrialRecord>;
  error: string | null;
  hydrate: (payload: ImportedTrialsRuntimeStore) => void;
  upsert: (record: ImportedTrialRecord) => void;
  applyRemovalResult: (result: TrialRemovalResult) => void;
  setLoading: () => void;
  setError: (message: string) => void;
}

function toListItem(record: ImportedTrialRecord): ImportedTrialListItem {
  const { rawStudy: _rawStudy, ...listItem } = record;
  return listItem;
}

function findItemByTrialId(
  items: ImportedTrialListItem[],
  trialId: string,
): ImportedTrialListItem | undefined {
  return items.find((item) => item.projection.id === trialId);
}

export const useImportedTrialsStore = create<ImportedTrialsStore>((set) => ({
  status: "idle",
  updatedAt: null,
  items: [],
  detailByNctId: {},
  error: null,
  hydrate: (payload) =>
    set((state) => {
      const detailByNctId = { ...state.detailByNctId };
      payload.items.forEach((item) => {
        if (detailByNctId[item.nctId]) {
          detailByNctId[item.nctId] = {
            ...detailByNctId[item.nctId],
            ...item,
          };
        }
      });

      return {
        status: "ready",
        updatedAt: payload.updatedAt,
        items: payload.items,
        detailByNctId,
        error: null,
      };
    }),
  upsert: (record) =>
    set((state) => {
      const nextItem = toListItem(record);
      const existingIndex = state.items.findIndex((item) => item.nctId === record.nctId);
      const items =
        existingIndex >= 0
          ? state.items.map((item, index) => (index === existingIndex ? nextItem : item))
          : [nextItem, ...state.items];

      return {
        status: "ready",
        updatedAt: new Date().toISOString(),
        items,
        detailByNctId: {
          ...state.detailByNctId,
          [record.nctId]: record,
        },
        error: null,
      };
    }),
  applyRemovalResult: (result) =>
    set((state) => {
      const removedTrialIds = new Set(result.removedTrialIds);
      const items = state.items.filter(
        (item) => !removedTrialIds.has(item.projection.id),
      );
      const detailByNctId = Object.fromEntries(
        Object.entries(state.detailByNctId).filter(
          ([, record]) => !removedTrialIds.has(record.projection.id),
        ),
      );

      return {
        updatedAt: new Date().toISOString(),
        items,
        detailByNctId,
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

export function getImportedTrialByTrialId(
  trialId: string,
): ImportedTrialProjection | undefined {
  return findItemByTrialId(useImportedTrialsStore.getState().items, trialId)?.projection;
}

export function getImportedTrialOptions(): TrialOption[] {
  return useImportedTrialsStore
    .getState()
    .items.filter((item) => item.projection.linkedInstitutionalTrialId == null)
    .map((item) => ({
      id: item.projection.id,
      label: `${item.projection.shortCode} | ${item.projection.title}`,
      status: item.projection.localStatus,
    }));
}

export function getScreenableImportedTrialOptions(): TrialOption[] {
  return [];
}

export function isImportedTrialScreeningEligible(trialId: string): boolean {
  const projection = getImportedTrialByTrialId(trialId);
  if (!projection) {
    return true;
  }

  return false;
}

export function getImportedCriteriaForTrial(trialId: string): NormalizedCriterion[] {
  const item = findItemByTrialId(useImportedTrialsStore.getState().items, trialId);
  if (!item) {
    return [];
  }

  const latestJob =
    item.normalizationJobs.find((job) => job.id === item.latestNormalizationJobId) ??
    item.normalizationJobs[item.normalizationJobs.length - 1];
  return latestJob?.finalCriteria ?? item.criteria;
}

export function getImportedTrialVersionsForTrial(trialId: string): TrialVersion[] {
  return findItemByTrialId(useImportedTrialsStore.getState().items, trialId)?.versions ?? [];
}

export function getImportedTrialRecordByNctId(
  nctId: string,
): ImportedTrialRecord | undefined {
  return useImportedTrialsStore.getState().detailByNctId[nctId];
}

export function getImportedNormalizationJobForTrial(
  trialId: string,
) {
  const item = findItemByTrialId(useImportedTrialsStore.getState().items, trialId);
  if (!item) {
    return undefined;
  }

  return (
    item.normalizationJobs.find((job) => job.id === item.latestNormalizationJobId) ??
    item.normalizationJobs[item.normalizationJobs.length - 1]
  );
}

export function isImportedTrialId(trialId: string): boolean {
  return trialId.startsWith("ctg-");
}
