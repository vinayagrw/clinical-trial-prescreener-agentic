import { useImportedTrialsStore } from "../../stores/importedTrials";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { institutionalTrialApi, normalizationJobApi } from "../../lib/api";
import { useInstitutionalTrialsStore } from "../../stores/institutionalTrials";
import type { NormalizedCriterion } from "../../types";

export const institutionalTrialQueryKeys = {
  catalog: ["institutional-trials"] as const,
  criteriaVersion: (trialId: string) =>
    ["institutional-trials", "criteria-version", trialId] as const,
};

export function useInstitutionalTrialsCatalogQuery() {
  return useQuery({
    queryKey: institutionalTrialQueryKeys.catalog,
    queryFn: () => institutionalTrialApi.listInstitutionalTrials(),
  });
}

export function useInstitutionalCriteriaVersionQuery(trialId: string | undefined) {
  return useQuery({
    queryKey: institutionalTrialQueryKeys.criteriaVersion(trialId ?? ""),
    enabled: Boolean(trialId),
    queryFn: () => institutionalTrialApi.getInstitutionalCriteriaVersion(trialId!),
  });
}

export function useSyncInstitutionalTrialsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => institutionalTrialApi.syncInstitutionalTrials(),
    onSuccess: (payload) => {
      useInstitutionalTrialsStore.getState().upsertCatalog(payload);
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.catalog,
      });
    },
  });
}

export function useNormalizeInstitutionalTrialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { trialId: string; runtimeMode?: "demo" | "live" }) =>
      institutionalTrialApi.normalizeInstitutionalTrial(
        input.trialId,
        input.runtimeMode,
      ),
    onSuccess: (payload) => {
      useInstitutionalTrialsStore.getState().upsertNormalization({
        trial: payload.trial,
        trialVersion: payload.trialVersion,
        normalizationJob: payload.normalizationJob,
      });
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.catalog,
      });
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.criteriaVersion(payload.trial.id),
      });
    },
  });
}

export function useReviewNormalizationJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      jobId: string;
      reviewerName?: string;
      reviewerNotes?: string;
      finalCriteria?: NormalizedCriterion[];
    }) =>
      normalizationJobApi.reviewNormalizationJob(input.jobId, {
        reviewerName: input.reviewerName,
        reviewerNotes: input.reviewerNotes,
        finalCriteria: input.finalCriteria,
      }),
    onSuccess: (payload) => {
      if (payload.importedRecord) {
        useImportedTrialsStore.getState().upsert(payload.importedRecord);
      }
      if (payload.trial) {
        useInstitutionalTrialsStore.getState().upsertTrial(payload.trial);
      }
      useInstitutionalTrialsStore.getState().upsertNormalizationJob(payload.normalizationJob);
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.catalog,
      });
      void queryClient.invalidateQueries({
        queryKey: ["trial-imports"],
      });
    },
  });
}

export function useApproveNormalizationJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      jobId: string;
      reviewerName?: string;
      reviewerNotes?: string;
      finalCriteria?: NormalizedCriterion[];
    }) =>
      normalizationJobApi.approveNormalizationJob(input.jobId, {
        reviewerName: input.reviewerName,
        reviewerNotes: input.reviewerNotes,
        finalCriteria: input.finalCriteria,
      }),
    onSuccess: (payload) => {
      useInstitutionalTrialsStore.getState().upsertNormalization({
        trial: payload.trial,
        trialVersion: payload.trialVersion,
        criteriaVersion: payload.criteriaVersion,
        normalizationJob: payload.normalizationJob,
      });
      if (payload.importedRecord) {
        useImportedTrialsStore.getState().upsert(payload.importedRecord);
      }
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.catalog,
      });
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.criteriaVersion(payload.institutionalTrialId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["trial-imports"],
      });
    },
  });
}

export function useRemoveTrialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trialId: string) => institutionalTrialApi.removeTrial(trialId),
    onSuccess: (payload) => {
      useInstitutionalTrialsStore.getState().applyRemovalResult(payload);
      useImportedTrialsStore.getState().applyRemovalResult(payload);
      void queryClient.invalidateQueries({
        queryKey: institutionalTrialQueryKeys.catalog,
      });
      void queryClient.invalidateQueries({
        queryKey: ["trial-imports"],
      });
    },
  });
}
