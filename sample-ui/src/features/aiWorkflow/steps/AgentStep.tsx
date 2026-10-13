/*
 * AgentStep — step 6 (F5 Grounded Ask Agent).
 *
 * Now fully wired: the pipeline store calls the LLM orchestrator via
 * `runAskAgent()` and stores the result in `f5Result`. This component
 * renders the live answer, citations, grounding status, and provider
 * metadata inline — no need to open the floating widget.
 *
 * The canned question card and "Copy question" button stay so the
 * coordinator can also use the GlobalAskWidget manually.
 */

import { AskAgentFeatureCard } from "../../../components/aiFeatures/AskAgentFeatureCard";
import {
  useAiPipelineStore,
  DEFAULT_PIPELINE_AGENT_QUESTION,
} from "../../../stores/aiPipeline";
import { StepShell } from "./StepShell";

function GroundingBadge({ status }: { status: string }) {
  const tone =
    status === "grounded"
      ? "var(--color-moss, #2d6a4f)"
      : status === "partial"
        ? "var(--color-amber, #b5651d)"
        : "var(--color-brick, #9b2226)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: tone,
        border: `1px solid ${tone}`,
        borderRadius: "999px",
        padding: "0.15rem 0.6rem",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: tone,
        }}
      />
      {status}
    </span>
  );
}

export function AgentStep() {
  const logEntry = useAiPipelineStore((s) => s.logEntry);
  const f5 = useAiPipelineStore((s) => s.f5Result);

  return (
    <StepShell step="agent" runLabel="Run F5 Ask Agent">
      <div className="aif-agent-step">
        {/* ---- Canned question card ---- */}
        <div className="aif-agent-step__prompt-card">
          <span className="aif-agent-step__eyebrow">
            Canned coordinator question
          </span>
          <p className="aif-agent-step__prompt">
            &ldquo;{DEFAULT_PIPELINE_AGENT_QUESTION}&rdquo;
          </p>
          <p className="aif-agent-step__hint">
            Click <strong>Run F5 Ask Agent</strong> above to send this question
            through the orchestrator. The pipeline runs the pre-flight injection
            filter, calls the LLM, and passes the response through the F5 guard
            stack (schema &rarr; citation enforcer &rarr; contraindication
            check).
          </p>
          <button
            type="button"
            className="aif-btn-ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(
                DEFAULT_PIPELINE_AGENT_QUESTION,
              );
              logEntry({
                step: "agent",
                feature: "F5",
                tone: "info",
                message: "Copied canned question to clipboard.",
              });
            }}
          >
            Copy question
          </button>
        </div>

        {/* ---- Live LLM result ---- */}
        {f5.status === "running" && (
          <div
            className="callout"
            role="status"
            aria-live="polite"
            style={{ borderLeft: "3px solid var(--color-teal, #0077b6)" }}
          >
            <strong>F5 Agent running&hellip;</strong>
            <p>
              Sending question to the LLM orchestrator. The answer will appear
              here once the safety guard pipeline completes.
            </p>
          </div>
        )}

        {f5.status === "error" && (
          <div
            className="callout callout--warning"
            role="alert"
            style={{ borderLeft: "3px solid var(--color-brick, #9b2226)" }}
          >
            <strong>F5 Agent error</strong>
            <p>{f5.error}</p>
          </div>
        )}

        {f5.status === "success" && f5.answer && (
          <div
            className="aif-agent-step__result"
            style={{
              background: "var(--surface-1, #1a1a2e)",
              borderRadius: "var(--radius-2, 8px)",
              padding: "var(--space-4, 1rem)",
              marginTop: "var(--space-3, 0.75rem)",
              border: "1px solid var(--border-1, #333)",
            }}
          >
            {/* Header row: grounding + provider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: "0.9rem" }}>
                Live answer
              </strong>
              <GroundingBadge status={f5.answer.groundingStatus} />
              {f5.provider && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    opacity: 0.7,
                  }}
                >
                  via <strong>{f5.provider}</strong>
                  {f5.model ? ` · ${f5.model}` : ""}
                </span>
              )}
            </div>

            {/* Answer body */}
            <p
              style={{
                lineHeight: 1.55,
                marginBottom: "0.75rem",
              }}
            >
              {f5.answer.answer}
            </p>

            {/* Citations */}
            {f5.answer.citations.length > 0 && (
              <div>
                <strong
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    opacity: 0.7,
                  }}
                >
                  Citations ({f5.answer.citations.length})
                </strong>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0.4rem 0 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  {f5.answer.citations.map((c) => (
                    <li
                      key={c.evidenceId}
                      style={{
                        fontSize: "0.8rem",
                        padding: "0.4rem 0.6rem",
                        background: "var(--surface-2, #252540)",
                        borderRadius: "var(--radius-1, 4px)",
                        border: "1px solid var(--border-1, #333)",
                      }}
                    >
                      <strong>{c.source}</strong>
                      <span style={{ opacity: 0.6 }}> · {c.sourceDate}</span>
                      <br />
                      <em style={{ opacity: 0.8 }}>&ldquo;{c.excerpt}&rdquo;</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ---- Static feature card (pitch / demo fallback) ---- */}
        <AskAgentFeatureCard />
      </div>
    </StepShell>
  );
}
