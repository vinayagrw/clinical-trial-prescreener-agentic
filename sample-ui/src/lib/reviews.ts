import { useEffect, useMemo, useRef, useState } from "react";
import { useAiRunQuery, useUpsertAiRunMutation } from "../data/queries/aiReviews";
import type { AiRun, AiRunUpsertInput } from "../types";

export function stringifyReviewValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function parseReviewValue(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

export function getEffectiveReviewVersion(run: AiRun | null | undefined) {
  if (!run) {
    return null;
  }

  return run.finalizedVersion ?? run.approvedVersion ?? run.humanEdits ?? run.aiDraft;
}

export function getEffectiveReviewOutput<T>(
  run: AiRun | null | undefined,
  fallback: T,
): T {
  const version = getEffectiveReviewVersion(run);
  if (!version) {
    return fallback;
  }

  return (version.output as T) ?? fallback;
}

export function getCommitBanner(run: AiRun | null | undefined) {
  if (!run) {
    return null;
  }

  if (run.commitStatus === "applied") {
    if (run.commitTargetType === "trial_review") {
      return { label: "Applied to trial decision", tone: "moss" as const };
    }
    if (run.commitTargetType === "handoff") {
      return { label: "Published handoff", tone: "moss" as const };
    }
    if (run.commitTargetType === "research_digest") {
      return { label: "Published digest", tone: "moss" as const };
    }
  }

  if (run.commitStatus === "failed") {
    return { label: "Commit failed", tone: "brick" as const };
  }

  if (run.commitTargetType === "none" || run.policy === "preview_only") {
    return { label: "Draft only", tone: "paper" as const };
  }

  if (run.status === "approved" || run.status === "overridden" || run.status === "finalized") {
    return { label: "Reviewed but not applied", tone: "amber" as const };
  }

  return { label: "Draft only", tone: "paper" as const };
}

export function useAiReviewRunSync(input: AiRunUpsertInput | null) {
  const mutation = useUpsertAiRunMutation();
  const [runId, setRunId] = useState<string | null>(null);
  const runQuery = useAiRunQuery(runId ?? undefined);
  const signature = useMemo(
    () => (input ? JSON.stringify(input) : ""),
    [input],
  );
  const lastSignature = useRef("");

  useEffect(() => {
    if (!input || !signature || signature === lastSignature.current) {
      return;
    }

    lastSignature.current = signature;
    mutation.mutate(input, {
      onSuccess: (run) => {
        setRunId(run.id);
      },
    });
  }, [input, mutation, signature]);

  return {
    runId,
    run: runQuery.data ?? mutation.data ?? null,
    isSyncing: mutation.isPending || runQuery.isFetching,
    error: mutation.error ?? runQuery.error ?? null,
  };
}
