import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAiRunAuditQuery,
  useAiRunCommitMutation,
  useAiRunRerunMutation,
  useReviewDecisionMutation,
} from "../data/queries/aiReviews";
import {
  getCommitBanner,
  getEffectiveReviewVersion,
  parseReviewValue,
  stringifyReviewValue,
} from "../lib/reviews";
import { useUiStore } from "../stores/ui";
import type {
  AiRun,
  AiRunStatus,
  ReviewerDecisionAction,
  ReviewPolicy,
} from "../types";
import { StatusChip } from "./StatusChip";

interface HumanReviewPanelProps {
  run: AiRun | null | undefined;
  title?: string;
  compact?: boolean;
  onRerun?: (editedInput: unknown) => Promise<void> | void;
}

function toneForStatus(status: AiRunStatus) {
  switch (status) {
    case "approved":
      return "moss";
    case "overridden":
      return "teal";
    case "rejected":
      return "brick";
    case "finalized":
      return "slate";
    case "needs_review":
      return "amber";
    case "draft":
    default:
      return "paper";
  }
}

function labelForStatus(status: AiRunStatus) {
  switch (status) {
    case "needs_review":
      return "Needs review";
    default:
      return status.replace(/_/g, " ");
  }
}

function toneForPolicy(policy: ReviewPolicy) {
  switch (policy) {
    case "required_before_apply":
      return "amber";
    case "required_before_continue":
      return "teal";
    case "preview_only":
    default:
      return "paper";
  }
}

function policyLabel(policy: ReviewPolicy) {
  switch (policy) {
    case "preview_only":
      return "Preview only";
    case "required_before_continue":
      return "Approve before continue";
    case "required_before_apply":
    default:
      return "Approve before apply";
  }
}

function commitActionLabel(run: AiRun) {
  switch (run.commitTargetType) {
    case "trial_review":
      return "Finalize / apply to trial decision";
    case "handoff":
      return "Finalize / publish handoff";
    case "research_digest":
      return "Finalize / publish digest";
    default:
      return "Finalize / apply";
  }
}

function hasAction(run: AiRun, action: ReviewerDecisionAction) {
  return run.allowedActions?.includes(action) ?? true;
}

function actionButtonLabel(action: ReviewerDecisionAction) {
  switch (action) {
    case "approve_as_is":
      return "Approve as-is";
    case "edit_output":
      return "Save edited output";
    case "edit_input_and_rerun":
      return "Request rerun";
    case "modify_evidence":
      return "Save evidence edits";
    case "override":
      return "Override result";
    case "reject":
      return "Reject";
    case "escalate_manual_review":
      return "Escalate";
    case "finalize_apply":
      return "Finalize / apply";
    case "revert_to_ai_draft":
      return "Revert to AI draft";
  }
}

export function HumanReviewPanel({
  run,
  title = "Human review",
  compact = false,
  onRerun,
}: HumanReviewPanelProps) {
  const pushToast = useUiStore((state) => state.pushToast);
  const effectiveVersion = getEffectiveReviewVersion(run);
  const decisionMutation = useReviewDecisionMutation(run?.id);
  const rerunMutation = useAiRunRerunMutation(run?.id);
  const commitMutation = useAiRunCommitMutation(run?.id);
  const auditQuery = useAiRunAuditQuery(run?.id);
  const [rationale, setRationale] = useState("");
  const [outputText, setOutputText] = useState("");
  const [inputText, setInputText] = useState("");
  const [selectedCitationIds, setSelectedCitationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!run) {
      return;
    }

    setRationale(run.latestDecision?.rationale ?? "");
    setOutputText(
      stringifyReviewValue(
        effectiveVersion?.output ?? run.outputSnapshot,
      ),
    );
    setInputText(
      stringifyReviewValue(
        effectiveVersion?.input ?? run.inputSnapshot,
      ),
    );
    setSelectedCitationIds(
      effectiveVersion?.selectedCitationIds ??
        run.citations.map((citation) => citation.id),
    );
  }, [effectiveVersion, run]);

  const checkpoint = run?.reviewCheckpoints[0];
  const commitBanner = getCommitBanner(run);
  const outputChanged = useMemo(
    () =>
      stringifyReviewValue(run?.outputSnapshot ?? "") !==
      stringifyReviewValue(parseReviewValue(outputText)),
    [outputText, run?.outputSnapshot],
  );
  const inputChanged = useMemo(
    () =>
      stringifyReviewValue(run?.inputSnapshot ?? "") !==
      stringifyReviewValue(parseReviewValue(inputText)),
    [inputText, run?.inputSnapshot],
  );
  const citationChanged = useMemo(() => {
    const original = [...(run?.citations ?? []).map((citation) => citation.id)].sort().join("|");
    const selected = [...selectedCitationIds].sort().join("|");
    return original !== selected;
  }, [run?.citations, selectedCitationIds]);
  const blockingFlags = useMemo(
    () => (run?.safetyFlags ?? []).filter((flag) => flag.severity !== "info"),
    [run?.safetyFlags],
  );
  const finalizeBlocked = Boolean(
    run &&
      (!hasAction(run, "finalize_apply") ||
        run.policy === "preview_only" ||
        run.commitTargetType === "none" ||
        blockingFlags.length > 0 ||
        run.citations.length === 0),
  );

  async function handleDecision(action: ReviewerDecisionAction) {
    if (!run || !checkpoint) {
      return;
    }

    try {
      const payload = {
        checkpointId: checkpoint.id,
        action,
        rationale:
          rationale.trim() ||
          (action === "approve_as_is"
            ? "Approved without changes."
            : action === "reject"
              ? "Rejected pending manual correction."
              : "Reviewed in local workbench."),
        editedOutput:
          action === "approve_as_is" || action === "reject" || action === "revert_to_ai_draft"
            ? undefined
            : parseReviewValue(outputText),
        editedInput:
          action === "edit_input_and_rerun" || action === "finalize_apply"
            ? parseReviewValue(inputText)
            : undefined,
        selectedCitationIds,
      } as const;

      await decisionMutation.mutateAsync(payload);

      if (action === "edit_input_and_rerun" && onRerun) {
        await rerunMutation.mutateAsync({
          rationale: payload.rationale,
          editedInput: payload.editedInput,
        });
        await onRerun(payload.editedInput);
      }

      if (
        action === "finalize_apply" &&
        run.commitTargetType !== "none" &&
        run.policy !== "preview_only"
      ) {
        await commitMutation.mutateAsync({
          checkpointId: checkpoint.id,
          rationale: payload.rationale,
        });
      }

      pushToast({
        title: "Review action saved",
        description: `${run.featureLabel} was updated with ${actionButtonLabel(action).toLowerCase()}.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Review action failed",
        description: error instanceof Error ? error.message : "Unknown review error.",
        tone: "critical",
      });
    }
  }

  if (!run) {
    return null;
  }

  return (
    <section className={`surface human-review-panel${compact ? " human-review-panel--compact" : ""}`}>
      <div className="human-review-panel__header">
        <div>
          <p className="eyebrow-label">Human-in-the-loop</p>
          <h3>{title}</h3>
          <p className="panel-copy">
            AI drafts stay editable and auditable until a reviewer explicitly approves, overrides, rejects, or finalizes them.
          </p>
        </div>

        <div className="stacked-chips">
          <StatusChip label={labelForStatus(run.status)} tone={toneForStatus(run.status)} compact />
          <StatusChip label={policyLabel(run.policy)} tone={toneForPolicy(run.policy)} compact />
          <StatusChip label={run.featureLabel} tone="paper" compact />
          {commitBanner ? (
            <StatusChip label={commitBanner.label} tone={commitBanner.tone} compact />
          ) : null}
        </div>
      </div>

      <div className="human-review-panel__meta">
        <div>
          <span className="eyebrow-label">Entity</span>
          <strong>{run.entityLabel}</strong>
        </div>
        <div>
          <span className="eyebrow-label">Provider</span>
          <strong>{run.provider ?? "n/a"}</strong>
        </div>
        <div>
          <span className="eyebrow-label">Model</span>
          <strong>{run.model ?? "n/a"}</strong>
        </div>
        <div>
          <span className="eyebrow-label">Updated</span>
          <strong>{new Date(run.updatedAt).toLocaleString()}</strong>
        </div>
      </div>

      {commitBanner ? (
        <div className="callout">
          <strong>{commitBanner.label}</strong>
          <p>
            {run.commitStatus === "applied"
              ? `This reviewed version has been committed to ${run.commitTargetType.replace(/_/g, " ")} state.`
              : run.commitStatus === "failed"
                ? run.commitError ?? "The last commit attempt failed."
                : "Human edits remain review-layer only until someone explicitly commits them."}
          </p>
        </div>
      ) : null}

      {run.safetyFlags.length > 0 ? (
        <div className="human-review-panel__flags">
          {run.safetyFlags.map((flag) => (
            <article
              key={flag.id}
              className={`callout ${
                flag.severity === "critical"
                  ? "callout--critical"
                  : flag.severity === "warning"
                    ? "callout--warning"
                    : ""
              }`}
            >
              <strong>{flag.label}</strong>
              <p>{flag.detail}</p>
            </article>
          ))}
        </div>
      ) : null}

      <div className="human-review-panel__compare">
        <div className="human-review-panel__column">
          <div className="human-review-panel__column-head">
            <strong>AI draft</strong>
            <span>{run.aiDraft.createdAt ? new Date(run.aiDraft.createdAt).toLocaleString() : ""}</span>
          </div>
          <pre>{stringifyReviewValue(run.outputSnapshot)}</pre>
        </div>
        <div className="human-review-panel__column">
          <div className="human-review-panel__column-head">
            <strong>Working reviewed version</strong>
            <span>{effectiveVersion?.actorType ?? "ai"}</span>
          </div>
          <textarea
            className="textarea human-review-panel__editor"
            rows={compact ? 10 : 14}
            value={outputText}
            onChange={(event) => setOutputText(event.target.value)}
          />
        </div>
      </div>

      <div className="detail-list detail-list--tight">
        <div className="detail-list__row">
          <strong>Output diff</strong>
          <span>{outputChanged ? "Changed from AI draft" : "Unchanged"}</span>
        </div>
        <div className="detail-list__row">
          <strong>Input diff</strong>
          <span>{inputChanged ? "Edited before rerun/apply" : "Unchanged"}</span>
        </div>
        <div className="detail-list__row">
          <strong>Citation diff</strong>
          <span>
            {citationChanged
              ? `${selectedCitationIds.length} selected (changed)`
              : `${selectedCitationIds.length} selected (unchanged)`}
          </span>
        </div>
      </div>

      <details className="human-review-panel__details">
        <summary>Input snapshot, evidence selection, and audit</summary>

        <div className="human-review-panel__details-grid">
          <label className="human-review-panel__editor-block">
            <span>Edit inputs and rerun</span>
            <textarea
              className="textarea human-review-panel__editor"
              rows={8}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
            />
          </label>

          <div className="human-review-panel__citations">
            <span>Supporting evidence</span>
            {run.citations.length === 0 ? (
              <p className="panel-copy">No citations were attached to this AI output.</p>
            ) : (
              run.citations.map((citation) => (
                <label key={citation.id} className="human-review-panel__citation">
                  <input
                    type="checkbox"
                    checked={selectedCitationIds.includes(citation.id)}
                    onChange={(event) => {
                      setSelectedCitationIds((current) =>
                        event.target.checked
                          ? [...current, citation.id]
                          : current.filter((item) => item !== citation.id),
                      );
                    }}
                  />
                  <span>
                    <strong>{citation.label}</strong>
                    <small>{citation.detail}</small>
                    {citation.quote ? <em>{citation.quote}</em> : null}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="human-review-panel__audit">
          <div className="human-review-panel__column-head">
            <strong>Audit history</strong>
            <Link to={run.deepLink} className="ghost-link">
              Return to source
            </Link>
          </div>
          {auditQuery.data?.audit.length ? (
            auditQuery.data.audit.map((event) => (
              <article key={event.id} className="human-review-panel__audit-event">
                <strong>{event.eventType.replace(/_/g, " ")}</strong>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <pre>{stringifyReviewValue(event.payload)}</pre>
              </article>
            ))
          ) : (
            <p className="panel-copy">
              {auditQuery.isLoading ? "Loading audit…" : "No audit events recorded yet."}
            </p>
          )}
        </div>
      </details>

      <label className="human-review-panel__rationale">
        <span>Reviewer rationale</span>
        <textarea
          className="textarea human-review-panel__editor"
          rows={3}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>

      <div className="human-review-panel__actions">
        {hasAction(run, "approve_as_is") ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleDecision("approve_as_is")}
            disabled={decisionMutation.isPending || commitMutation.isPending}
          >
            Approve as-is
          </button>
        ) : null}
        {hasAction(run, "edit_output") ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDecision("edit_output")}
            disabled={decisionMutation.isPending || commitMutation.isPending}
          >
            Save edited output
          </button>
        ) : null}
        {hasAction(run, "modify_evidence") ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDecision("modify_evidence")}
            disabled={decisionMutation.isPending || commitMutation.isPending}
          >
            Save evidence edits
          </button>
        ) : null}
        {onRerun && hasAction(run, "edit_input_and_rerun") ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDecision("edit_input_and_rerun")}
            disabled={decisionMutation.isPending || rerunMutation.isPending || commitMutation.isPending}
          >
            Edit inputs and rerun
          </button>
        ) : null}
        {hasAction(run, "override") ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDecision("override")}
            disabled={decisionMutation.isPending || commitMutation.isPending}
          >
            Override
          </button>
        ) : null}
        {hasAction(run, "escalate_manual_review") ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDecision("escalate_manual_review")}
            disabled={decisionMutation.isPending || commitMutation.isPending}
          >
            Escalate
          </button>
        ) : null}
        {hasAction(run, "reject") ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDecision("reject")}
            disabled={decisionMutation.isPending || commitMutation.isPending}
          >
            Reject
          </button>
        ) : null}
        {hasAction(run, "revert_to_ai_draft") ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleDecision("revert_to_ai_draft")}
            disabled={decisionMutation.isPending || commitMutation.isPending}
          >
            Revert
          </button>
        ) : null}
        {hasAction(run, "finalize_apply") ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleDecision("finalize_apply")}
            disabled={decisionMutation.isPending || commitMutation.isPending || finalizeBlocked}
            title={
              finalizeBlocked
                ? "Finalize is blocked until safety flags are resolved, supporting citations are present, and this feature supports domain commit."
                : undefined
            }
          >
            {commitActionLabel(run)}
          </button>
        ) : null}
      </div>
    </section>
  );
}
