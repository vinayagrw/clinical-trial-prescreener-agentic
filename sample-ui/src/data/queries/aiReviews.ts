import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiReviewApi } from "../../lib/api";
import type {
  AiRunUpsertInput,
  ReviewCommitPayload,
  ReviewDecisionPayload,
  ReviewRerunPayload,
} from "../../types";
import { handoffQueryKeys } from "./handoffs";
import { researchQueryKeys } from "./research";
import { trialReviewQueryKeys } from "./trialReviews";

export const aiReviewQueryKeys = {
  runs: ["ai-review-runs"] as const,
  pending: ["ai-review-pending"] as const,
  run: (runId: string) => ["ai-review-run", runId] as const,
  audit: (runId: string) => ["ai-review-audit", runId] as const,
};

export function useAiRunsQuery() {
  return useQuery({
    queryKey: aiReviewQueryKeys.runs,
    queryFn: () => aiReviewApi.listRuns(),
  });
}

export function usePendingAiRunsQuery() {
  return useQuery({
    queryKey: aiReviewQueryKeys.pending,
    queryFn: () => aiReviewApi.listPendingRuns(),
  });
}

export function useAiRunQuery(runId: string | undefined) {
  return useQuery({
    queryKey: aiReviewQueryKeys.run(runId ?? ""),
    enabled: Boolean(runId),
    queryFn: () => aiReviewApi.getRun(runId!),
  });
}

export function useAiRunAuditQuery(runId: string | undefined) {
  return useQuery({
    queryKey: aiReviewQueryKeys.audit(runId ?? ""),
    enabled: Boolean(runId),
    queryFn: () => aiReviewApi.getAudit(runId!),
  });
}

export function useUpsertAiRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AiRunUpsertInput) => aiReviewApi.upsertRun(input),
    onSuccess: (run) => {
      queryClient.setQueryData(aiReviewQueryKeys.run(run.id), run);
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.runs });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.pending });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.audit(run.id) });
      if (run.commitTargetType === "trial_review" && run.commitTargetId) {
        void queryClient.invalidateQueries({
          queryKey: trialReviewQueryKeys.commit(run.commitTargetId),
        });
      }
    },
  });
}

export function useReviewDecisionMutation(runId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewDecisionPayload & { checkpointId: string }) =>
      aiReviewApi.submitDecision(runId!, input.checkpointId, input),
    onSuccess: (run) => {
      queryClient.setQueryData(aiReviewQueryKeys.run(run.id), run);
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.runs });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.pending });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.audit(run.id) });
      if (run.commitTargetType === "handoff" && run.commitTargetId) {
        void queryClient.invalidateQueries({
          queryKey: handoffQueryKeys.finalized(run.commitTargetId),
        });
        void queryClient.invalidateQueries({
          queryKey: handoffQueryKeys.handoff(run.commitTargetId),
        });
      }
      if (run.commitTargetType === "research_digest" && run.commitTargetId) {
        void queryClient.invalidateQueries({
          queryKey: researchQueryKeys.digestPublication(run.commitTargetId),
        });
        void queryClient.invalidateQueries({
          queryKey: researchQueryKeys.digest(run.commitTargetId),
        });
      }
      if (run.commitTargetType === "trial_review" && run.commitTargetId) {
        void queryClient.invalidateQueries({
          queryKey: trialReviewQueryKeys.commit(run.commitTargetId),
        });
      }
    },
  });
}

export function useAiRunRerunMutation(runId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewRerunPayload) => aiReviewApi.requestRerun(runId!, input),
    onSuccess: (run) => {
      queryClient.setQueryData(aiReviewQueryKeys.run(run.id), run);
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.runs });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.pending });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.audit(run.id) });
    },
  });
}

export function useAiRunCommitMutation(runId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewCommitPayload) => aiReviewApi.commitRun(runId!, input),
    onSuccess: (run) => {
      queryClient.setQueryData(aiReviewQueryKeys.run(run.id), run);
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.runs });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.pending });
      void queryClient.invalidateQueries({ queryKey: aiReviewQueryKeys.audit(run.id) });
    },
  });
}
