/*
 * F1 — Protocol Criterion Decomposition & Computability Tagging.
 *
 * Interactive view:
 * - Textarea seeded with the default CTP protocol excerpt (see aiDecomposition store).
 * - "Decompose" button runs the protocol paste through `getOrchestrator().generate()`
 *   with the F1 prompt + `DecompositionResponseSchema`. In demo mode the demo
 *   provider returns the canned fixture; in live mode Ollama / Gemini / Groq
 *   produce structured JSON validated by Zod.
 * - Result is a `ProtocolDecomposition` envelope (same shape the static mock used)
 *   so the existing criterion list rendering is unchanged.
 * - Also kicks an initial run on mount so the page renders with data immediately.
 *
 * Loading / error / empty states are all handled locally — no SuspenseBoundary.
 */

import { useEffect } from "react";
import { HumanReviewPanel } from "../HumanReviewPanel";
import { getEffectiveReviewOutput, parseReviewValue, useAiReviewRunSync } from "../../lib/reviews";
import type {
  DecomposedCriterion,
  DecompositionConfidence,
  ProtocolDecomposition,
} from "../../types/aiFeatures";
import type { Computability } from "../../types/clinical";
import { useAiDecompositionStore } from "../../stores/aiDecomposition";

function typePillClass(type: DecomposedCriterion["type"]): string {
  return type === "inclusion" ? "aif-pill aif-pill-teal" : "aif-pill aif-pill-amber";
}

function computabilityPillClass(computability: Computability): string {
  switch (computability) {
    case "deterministic":
      return "aif-pill aif-pill-moss";
    case "hybrid":
      return "aif-pill aif-pill-teal";
    case "manual_only":
      return "aif-pill aif-pill-violet";
  }
}

function confidencePillClass(confidence: DecompositionConfidence): string {
  switch (confidence) {
    case "high":
      return "aif-pill aif-pill-moss";
    case "medium":
      return "aif-pill aif-pill-amber";
    case "low":
      return "aif-pill aif-pill-brick";
  }
}

function humanizeComputability(computability: Computability): string {
  switch (computability) {
    case "deterministic":
      return "deterministic";
    case "hybrid":
      return "hybrid";
    case "manual_only":
      return "manual only";
  }
}

function formatParsedAt(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  } catch {
    return iso;
  }
}

function DecompositionBody({
  decomposition,
}: {
  decomposition: ProtocolDecomposition;
}) {
  const { stats, criteria } = decomposition;
  return (
    <>
      <div className="aif-decomp-meta">
        <div className="aif-decomp-meta-row">
          <span className="aif-label">Protocol</span>
          <span className="aif-value">{decomposition.protocolId}</span>
        </div>
        <div className="aif-decomp-meta-row">
          <span className="aif-label">Pages parsed</span>
          <span className="aif-value">{decomposition.pageCount}</span>
        </div>
        <div className="aif-decomp-meta-row">
          <span className="aif-label">Wall time</span>
          <span className="aif-value">{decomposition.wallTimeSeconds.toFixed(1)}s</span>
        </div>
        <div className="aif-decomp-meta-row">
          <span className="aif-label">Parsed at</span>
          <span className="aif-value">{formatParsedAt(decomposition.parsedAt)}</span>
        </div>
        <div className="aif-decomp-meta-row">
          <span className="aif-label">Inclusion / Exclusion</span>
          <span className="aif-value">
            {stats.inclusion} / {stats.exclusion}
          </span>
        </div>
        <div className="aif-decomp-meta-row">
          <span className="aif-label">Deterministic / Hybrid / Manual</span>
          <span className="aif-value">
            {stats.deterministic} / {stats.hybrid} / {stats.manual_only}
          </span>
        </div>
        <div className="aif-decomp-meta-row">
          <span className="aif-label">Flagged for review</span>
          <span className="aif-value">{stats.flaggedForReview}</span>
        </div>
      </div>

      <p className="aif-section-subhead">Decomposed criteria</p>

      <div className="aif-decomp-list">
        {criteria.map((criterion) => (
          <details key={criterion.id} className="aif-decomp-item">
            <summary className="aif-decomp-summary">
              <span className="aif-decomp-code">{criterion.id.toUpperCase()}</span>
              <span className="aif-decomp-label">{criterion.label}</span>
              <span className="aif-feature-pills">
                <span className={typePillClass(criterion.type)}>{criterion.type}</span>
                <span className={computabilityPillClass(criterion.computability)}>
                  {humanizeComputability(criterion.computability)}
                </span>
                <span className={confidencePillClass(criterion.confidence)}>
                  {criterion.confidence} confidence
                </span>
              </span>
            </summary>

            <div className="aif-decomp-detail">
              <div className="aif-kv">
                <span className="aif-label">Threshold</span>
                <span className="aif-val">{criterion.threshold}</span>
              </div>
              <div className="aif-kv">
                <span className="aif-label">Source</span>
                <span className="aif-val">{criterion.source.pageRef}</span>
              </div>
              <div className="aif-kv">
                <span className="aif-label">Original text</span>
                <span className="aif-val">
                  <blockquote className="aif-decomp-original">
                    {criterion.source.originalText}
                  </blockquote>
                </span>
              </div>
              {criterion.normalizedConcepts.length > 0 && (
                <div className="aif-kv">
                  <span className="aif-label">Concepts</span>
                  <span className="aif-val">
                    {criterion.normalizedConcepts.map((concept) => (
                      <span key={concept} className="aif-decomp-concept">
                        {concept}
                      </span>
                    ))}
                  </span>
                </div>
              )}
              {criterion.dependsOn && criterion.dependsOn.length > 0 && (
                <div className="aif-kv">
                  <span className="aif-label">Depends on</span>
                  <span className="aif-val">{criterion.dependsOn.join(", ")}</span>
                </div>
              )}
              {criterion.reviewNote && (
                <div className="aif-kv">
                  <span className="aif-label">Review note</span>
                  <span className="aif-val">{criterion.reviewNote}</span>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

export function ProtocolDecompositionView() {
  const status = useAiDecompositionStore((s) => s.status);
  const view = useAiDecompositionStore((s) => s.view);
  const error = useAiDecompositionStore((s) => s.error);
  const protocolText = useAiDecompositionStore((s) => s.protocolText);
  const provider = useAiDecompositionStore((s) => s.provider);
  const model = useAiDecompositionStore((s) => s.model);
  const setProtocolText = useAiDecompositionStore((s) => s.setProtocolText);
  const runDecomposition = useAiDecompositionStore((s) => s.runDecomposition);
  const reviewRun = useAiReviewRunSync(
    view
      ? {
          sourceKey: "ai-features:f1:trial-001",
          featureKey: "F1_protocol_decomposition",
          featureLabel: "F1 Protocol decomposition",
          stageKey: "decomposition",
          workspace: "ai_features",
          entityType: "trial_protocol",
          entityId: "trial-001",
          entityLabel: view.protocolTitle,
          deepLink: "/ai-features",
          summary: `Decomposed ${view.criteria.length} trial criteria into computable review units.`,
          promptSnapshot: {
            protocolId: view.protocolId,
            provider,
            model,
          },
          inputSnapshot: {
            protocolText,
          },
          outputSnapshot: view,
          provider,
          model,
          policy: "required_before_continue",
          allowedActions: [
            "approve_as_is",
            "edit_output",
            "modify_evidence",
            "edit_input_and_rerun",
            "override",
            "reject",
            "escalate_manual_review",
            "revert_to_ai_draft",
          ],
          editableFields: ["inputSnapshot", "outputSnapshot", "citations"],
          requiredFields: ["rationale"],
          citations: view.criteria.map((criterion) => ({
            id: criterion.id,
            label: `${criterion.label} · ${criterion.source.pageRef}`,
            detail: criterion.threshold,
            quote: criterion.source.originalText,
            tone: criterion.reviewNote ? "warning" : "supporting",
          })),
          safetyFlags: view.criteria
            .filter((criterion) => criterion.reviewNote || criterion.confidence === "low")
            .map((criterion) => ({
              id: `review-${criterion.id}`,
              label: `${criterion.label} needs human attention`,
              detail:
                criterion.reviewNote ??
                "Low-confidence decomposition should be approved before it drives downstream retrieval.",
              severity: criterion.confidence === "low" ? "warning" : "info",
            })),
        }
      : null,
  );
  const reviewView = getEffectiveReviewOutput(reviewRun.run, view);

  // Kick an initial decomposition on first mount so the page renders with
  // data immediately instead of an empty placeholder.
  useEffect(() => {
    if (status === "idle" && !view) {
      void runDecomposition();
    }
  }, [status, view, runDecomposition]);

  const running = status === "running";

  return (
    <div className="aif-decomp">
      <div className="aif-decomp-controls">
        <label className="aif-decomp-textarea-label" htmlFor="aif-protocol-text">
          Protocol eligibility text
        </label>
        <textarea
          id="aif-protocol-text"
          className="aif-decomp-textarea"
          value={protocolText}
          onChange={(e) => setProtocolText(e.target.value)}
          rows={8}
          spellCheck={false}
        />
        <div className="aif-decomp-controls-row">
          <button
            type="button"
            className="aif-btn aif-btn-primary"
            onClick={() => void runDecomposition()}
            disabled={running || protocolText.trim().length === 0}
          >
            {running ? "Decomposing…" : "Decompose"}
          </button>
          {provider && model && (
            <span className="aif-decomp-provider">
              via <strong>{provider}</strong> · {model}
            </span>
          )}
        </div>
      </div>

      {status === "error" && error && (
        <div className="aif-retr-error" role="alert">
          <strong>Decomposition failed:</strong> {error}
        </div>
      )}

      {running && !view && (
        <div className="aif-retr-empty">
          Decomposing protocol… expect 1–5 seconds in demo mode.
        </div>
      )}

      {reviewView && <DecompositionBody decomposition={reviewView} />}

      {!reviewView && status !== "error" && !running && (
        <div className="aif-retr-empty">
          No decomposition yet. Paste protocol text and click <em>Decompose</em>.
        </div>
      )}

      {reviewView ? (
        <HumanReviewPanel
          run={reviewRun.run}
          title="Review decomposition before downstream AI steps"
          compact
          onRerun={async (editedInput) => {
            const nextInput = parseReviewValue(
              typeof editedInput === "string"
                ? editedInput
                : JSON.stringify(editedInput),
            );
            const nextProtocolText =
              typeof nextInput === "string"
                ? nextInput
                : typeof nextInput === "object" &&
                    nextInput &&
                    "protocolText" in nextInput &&
                    typeof nextInput.protocolText === "string"
                  ? nextInput.protocolText
                  : protocolText;
            setProtocolText(nextProtocolText);
            await runDecomposition(nextProtocolText);
          }}
        />
      ) : null}
    </div>
  );
}
