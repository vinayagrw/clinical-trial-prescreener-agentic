import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trialReviewApi } from "../../lib/api";
import type { TrialReviewCommitPayload } from "../../types";

export const trialReviewQueryKeys = {
  commit: (entityId: string) => ["trial-review-commit", entityId] as const,
};

export function useTrialReviewCommitQuery(entityId: string | undefined) {
  return useQuery({
    queryKey: trialReviewQueryKeys.commit(entityId ?? ""),
    enabled: Boolean(entityId),
    queryFn: () => trialReviewApi.getCommit(entityId!),
    retry: false,
  });
}

export function useCommitTrialReviewMutation(entityId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: TrialReviewCommitPayload & { runId: string; featureLabel: string },
    ) => trialReviewApi.commit(entityId!, input),
    onSuccess: () => {
      if (entityId) {
        void queryClient.invalidateQueries({ queryKey: trialReviewQueryKeys.commit(entityId) });
      }
    },
  });
}
