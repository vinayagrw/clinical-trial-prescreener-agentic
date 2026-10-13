/*
 * PipelineHeader — top strip of the /ai-features stepper.
 *
 * Shows: provider health chips, the current step label, demo/live toggle,
 * "Run all" button, and "Reset" button. The provider chips come from the
 * `useAiProvidersStore` bridge (wired to the orchestrator's health map);
 * the pipeline state comes from `useAiPipelineStore`.
 */

import { useAiProvidersStore } from "../../stores/aiProviders";
import {
  useAiPipelineStore,
  PIPELINE_STEPS,
  type PipelineStepId,
} from "../../stores/aiPipeline";
import type { ProviderName } from "../../lib/ai/providers";
import type { ProviderStatus } from "../../lib/ai/providers/types";

const PROVIDER_LABELS: Record<ProviderName, string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  gemini: "Gemini",
  groq: "Groq",
  anthropic: "Anthropic",
  demo: "Demo",
};

function statusToTone(status: ProviderStatus): string {
  switch (status) {
    case "healthy":
      return "ok";
    case "unhealthy":
      return "bad";
    case "disabled":
      return "off";
    case "unknown":
    default:
      return "idle";
  }
}

function currentStepLabel(id: PipelineStepId): string {
  return PIPELINE_STEPS.find((s) => s.id === id)?.label ?? "Pipeline";
}

export function PipelineHeader() {
  const health = useAiProvidersStore((s) => s.health);
  const order = useAiProvidersStore((s) => s.order);
  const demoMode = useAiProvidersStore((s) => s.demoMode);
  const setDemoMode = useAiProvidersStore((s) => s.setDemoMode);

  const currentStep = useAiPipelineStore((s) => s.currentStep);
  const isRunning = useAiPipelineStore((s) => s.isRunning);
  const startedAt = useAiPipelineStore((s) => s.startedAt);
  const completedAt = useAiPipelineStore((s) => s.completedAt);
  const runAll = useAiPipelineStore((s) => s.runAll);
  const reset = useAiPipelineStore((s) => s.reset);

  const wallSeconds = (() => {
    if (!startedAt) return null;
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const ms = end - new Date(startedAt).getTime();
    return Math.max(0, Math.round(ms / 100) / 10);
  })();

  return (
    <header className="aif-pipeline-header">
      <div className="aif-pipeline-header__left">
        <span className="aif-pipeline-header__eyebrow">AI Workflow</span>
        <h2 className="aif-pipeline-header__title">{currentStepLabel(currentStep)}</h2>
        <p className="aif-pipeline-header__meta">
          {wallSeconds !== null ? `Elapsed ${wallSeconds.toFixed(1)}s` : "No run in progress"}
          {isRunning ? " · running" : completedAt ? " · complete" : ""}
        </p>
      </div>
      <div className="aif-pipeline-header__center">
        <div className="aif-provider-chips" role="group" aria-label="Provider health">
          {order.map((name) => {
            const status = health[name] ?? "unknown";
            return (
              <span
                key={name}
                className={`aif-provider-chip aif-provider-chip--${statusToTone(status)}`}
                title={`${PROVIDER_LABELS[name]}: ${status}`}
              >
                <span className="aif-provider-chip__dot" aria-hidden="true" />
                {PROVIDER_LABELS[name]}
              </span>
            );
          })}
        </div>
      </div>
      <div className="aif-pipeline-header__right">
        <label className="aif-toggle">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
          />
          <span>Demo mode</span>
        </label>
        <button
          type="button"
          className="aif-btn-primary"
          onClick={() => void runAll()}
          disabled={isRunning}
        >
          {isRunning ? "Running…" : "Run all"}
        </button>
        <button
          type="button"
          className="aif-btn-ghost"
          onClick={() => reset()}
          disabled={isRunning}
        >
          Reset
        </button>
      </div>
    </header>
  );
}
