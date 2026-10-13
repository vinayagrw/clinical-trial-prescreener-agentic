import { useEffect, useRef } from "react";
import {
  usePatientCatalogQuery,
  useUploadPatientRecordMutation,
} from "../data/queries/patientCatalog";
import { normalizeLocalApiError } from "../lib/localApiErrors";
import { usePatientCatalogStore } from "../stores/patientCatalog";

const LEGACY_UPLOAD_KEY = "screening-uploaded-patients";

interface LegacyUploadedRecord {
  fileName: string;
  recordText: string;
}

interface LegacyUploadedRecordDraft {
  fileName?: string;
  recordText?: string;
}

interface LegacyPersistEnvelope {
  state?: {
    uploadedRecords?: LegacyUploadedRecordDraft[];
  };
  uploadedRecords?: LegacyUploadedRecordDraft[];
}

function readLegacyUploadedRecords(): LegacyUploadedRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LEGACY_UPLOAD_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as LegacyPersistEnvelope | LegacyUploadedRecordDraft[];
    let records: LegacyUploadedRecordDraft[] = [];

    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (parsed.uploadedRecords) {
      records = parsed.uploadedRecords;
    } else if (parsed.state?.uploadedRecords) {
      records = parsed.state.uploadedRecords;
    }

    return records
      .filter(
        (record: LegacyUploadedRecordDraft): record is { fileName?: string; recordText: string } =>
          typeof record?.recordText === "string" && record.recordText.trim().length > 0,
      )
      .map((record: { fileName?: string; recordText: string }) => ({
        fileName: record.fileName?.trim() || "Migrated uploaded record",
        recordText: record.recordText,
      }));
  } catch {
    return [];
  }
}

export function PatientCatalogBootstrap() {
  const { data, error, isLoading, isSuccess } = usePatientCatalogQuery();
  const hydrate = usePatientCatalogStore((state) => state.hydrate);
  const setLoading = usePatientCatalogStore((state) => state.setLoading);
  const setError = usePatientCatalogStore((state) => state.setError);
  const uploadMutation = useUploadPatientRecordMutation();
  const migrationStartedRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      setLoading();
    }
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (data) {
      hydrate(data);
    }
  }, [data, hydrate]);

  useEffect(() => {
    if (error instanceof Error) {
      setError(normalizeLocalApiError(error, "Unable to load patient catalog."));
    }
  }, [error, setError]);

  useEffect(() => {
    if (!isSuccess || migrationStartedRef.current) {
      return;
    }

    const legacyRecords = readLegacyUploadedRecords();
    if (legacyRecords.length === 0) {
      return;
    }

    migrationStartedRef.current = true;

    void (async () => {
      try {
        for (const record of legacyRecords) {
          await uploadMutation.mutateAsync({
            fileName: record.fileName,
            rawRecordText: record.recordText,
          });
        }

        window.localStorage.removeItem(LEGACY_UPLOAD_KEY);
      } catch (migrationError) {
        migrationStartedRef.current = false;
        setError(normalizeLocalApiError(migrationError, "Legacy upload migration failed."));
      }
    })();
  }, [isSuccess, setError, uploadMutation]);

  return null;
}
