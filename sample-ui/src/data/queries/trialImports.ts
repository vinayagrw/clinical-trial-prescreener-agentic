import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trialImportApi } from "../../lib/api";
import { useImportedTrialsStore } from "../../stores/importedTrials";
import { institutionalTrialQueryKeys } from "./institutionalTrials";

export const trialImportQueryKeys = {
  imports: ["trial-imports"] as const,
  detail: (nctId: string) => ["trial-imports", "detail", nctId] as const,
  raw: (nctId: string) => ["trial-imports", "raw", nctId] as const,
};

export function useImportedTrialsCatalogQuery() {
  return useQuery({
    queryKey: trialImportQueryKeys.imports,
    queryFn: () => trialImportApi.listImportedTrials(),
  });
}

export function useImportedTrialDetailQuery(nctId: string | undefined) {
  return useQuery({
    queryKey: trialImportQueryKeys.detail(nctId ?? ""),
    enabled: Boolean(nctId),
    queryFn: () => trialImportApi.getImportedTrial(nctId!),
  });
}

export function useImportedTrialRawQuery(nctId: string | undefined) {
  return useQuery({
    queryKey: trialImportQueryKeys.raw(nctId ?? ""),
    enabled: Boolean(nctId),
    queryFn: () => trialImportApi.getImportedTrialRaw(nctId!),
  });
}

export function useImportClinicalTrialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nctId: string) => trialImportApi.importClinicalTrial(nctId),
    onSuccess: (record) => {
      void queryClient.invalidateQueries({ queryKey: trialImportQueryKeys.imports });
      void queryClient.invalidateQueries({
        queryKey: trialImportQueryKeys.detail(record.nctId),
      });
      void queryClient.invalidateQueries({
        queryKey: trialImportQueryKeys.raw(record.nctId),
      });
    },
  });
}

export function useNormalizeImportedTrialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { trialId: string; runtimeMode?: "demo" | "live" }) =>
      trialImportApi.normalizeImportedTrial(input.trialId, input.runtimeMode),
    onSuccess: (payload) => {
      useImportedTrialsStore.getState().upsert(payload.importedRecord);
      void queryClient.invalidateQueries({ queryKey: trialImportQueryKeys.imports });
      void queryClient.invalidateQueries({
        queryKey: trialImportQueryKeys.detail(payload.importedRecord.nctId),
      });
      void queryClient.invalidateQueries({
        queryKey: trialImportQueryKeys.raw(payload.importedRecord.nctId),
      });
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.catalog,
      });
    },
  });
}
