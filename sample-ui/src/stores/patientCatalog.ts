import { create } from "zustand";
import type {
  Patient,
  PatientCatalogItem,
  PatientCatalogRuntimeStore,
  PatientClinicalRecord,
  PatientOption,
  PatientRemovalRecord,
  PatientRemovalResult,
} from "../types/index.ts";
import { seedPatientCatalogItems } from "../data/patientCatalogSeed.ts";
import { seedPatients } from "../data/patientSeedData.ts";

type PatientCatalogStatus = "idle" | "loading" | "ready" | "error";

interface PatientCatalogStore {
  status: PatientCatalogStatus;
  updatedAt: string | null;
  items: PatientCatalogItem[];
  removedPatients: PatientRemovalRecord[];
  error: string | null;
  hydrate: (payload: PatientCatalogRuntimeStore) => void;
  upsert: (item: PatientCatalogItem) => void;
  remove: (result: PatientRemovalResult) => void;
  setLoading: () => void;
  setError: (message: string) => void;
}

function buildSeedPatientIndex() {
  return new Map(seedPatients.map((patient) => [patient.id, patient] as const));
}

function findItemByPatientId(
  items: PatientCatalogItem[],
  patientId: string,
): PatientCatalogItem | undefined {
  return items.find((item) => item.patient.id === patientId);
}

function sortCatalogItems(items: PatientCatalogItem[]) {
  return [...items].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "seed" ? -1 : 1;
    }

    const leftName = left.patient.name.toLowerCase();
    const rightName = right.patient.name.toLowerCase();
    return leftName.localeCompare(rightName);
  });
}

function sortRemovedPatients(items: PatientRemovalRecord[]) {
  return [...items].sort((left, right) => {
    const byDate = right.removedAt.localeCompare(left.removedAt);
    if (byDate !== 0) {
      return byDate;
    }

    return left.patientId.localeCompare(right.patientId);
  });
}

function getRemovedPatientIdSet(removedPatients: PatientRemovalRecord[]) {
  return new Set(removedPatients.map((item) => item.patientId));
}

export const usePatientCatalogStore = create<PatientCatalogStore>((set) => ({
  status: "idle",
  updatedAt: null,
  items: [],
  removedPatients: [],
  error: null,
  hydrate: (payload) =>
    set({
      status: "ready",
      updatedAt: payload.updatedAt,
      items: sortCatalogItems(payload.items),
      removedPatients: sortRemovedPatients(payload.removedPatients ?? []),
      error: null,
    }),
  upsert: (item) =>
    set((state) => {
      const removedPatients = state.removedPatients.filter(
        (candidate) => candidate.patientId !== item.patient.id,
      );
      const existingIndex = state.items.findIndex(
        (candidate) => candidate.patient.id === item.patient.id,
      );
      const items =
        existingIndex >= 0
          ? state.items.map((candidate, index) =>
              index === existingIndex ? item : candidate,
            )
          : [item, ...state.items];

      return {
        status: "ready",
        updatedAt: new Date().toISOString(),
        items: sortCatalogItems(items),
        removedPatients,
        error: null,
      };
    }),
  remove: (result) =>
    set((state) => ({
      status: "ready",
      updatedAt: new Date().toISOString(),
      items: state.items.filter((item) => item.patient.id !== result.removedPatientId),
      removedPatients: sortRemovedPatients([
        ...state.removedPatients.filter(
          (item) => item.patientId !== result.removedPatientId,
        ),
        {
          patientId: result.removedPatientId,
          source: result.source,
          removedAt: new Date().toISOString(),
          removalMode: result.removalMode,
        },
      ]),
      error: null,
    })),
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

export function getPatientCatalogItems(): PatientCatalogItem[] {
  const state = usePatientCatalogStore.getState();
  const removedIds = getRemovedPatientIdSet(state.removedPatients);
  const items = state.items.filter((item) => !removedIds.has(item.patient.id));
  if (items.length > 0) {
    return items;
  }

  return seedPatientCatalogItems.filter((item) => !removedIds.has(item.patient.id));
}

export function getScreenablePatientItems(): PatientCatalogItem[] {
  return getPatientCatalogItems().filter((item) => item.clinicalRecord);
}

export function isPatientVisible(patientId: string): boolean {
  return !getRemovedPatientIdSet(usePatientCatalogStore.getState().removedPatients).has(
    patientId,
  );
}

export function getPatientById(patientId: string): Patient | undefined {
  if (!isPatientVisible(patientId)) {
    return undefined;
  }

  return (
    findItemByPatientId(getPatientCatalogItems(), patientId)?.patient ??
    buildSeedPatientIndex().get(patientId)
  );
}

export function getClinicalRecordByPatientId(
  patientId: string,
): PatientClinicalRecord | undefined {
  if (!isPatientVisible(patientId)) {
    return undefined;
  }

  return findItemByPatientId(getPatientCatalogItems(), patientId)?.clinicalRecord;
}

export function getPatientCatalogItemById(
  patientId: string,
): PatientCatalogItem | undefined {
  if (!isPatientVisible(patientId)) {
    return undefined;
  }

  return findItemByPatientId(getPatientCatalogItems(), patientId);
}

export function listPatientOptions(): PatientOption[] {
  return getScreenablePatientItems().map((item) => ({
    id: item.patient.id,
    label: `${item.patient.name} | ${item.patient.mrn}`,
  }));
}

export function countUploadedPatientItems() {
  return getPatientCatalogItems().filter((item) => item.source === "upload").length;
}
