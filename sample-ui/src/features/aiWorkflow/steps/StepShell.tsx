/*
 * StepShell — shared layout for every stepper body.
 *
 * Renders the step title + description, the per-step status strip
 * (running / success / error), the step body, and a footer with
 * "Run this step" + "Continue" actions. Every step component wraps its
 * feature view in this shell so the visual language stays consistent.
 */

import type { ReactNode } from "react";
import {
  useAiPipelineStore,
  type PipelineStepId,
  PIPELINE_STEPS,
  PIPELINE_STEP_ORDER,
} from "../../../stores/aiPipeline";

interface StepShellProps {
  step: PipelineStepId;
  children: ReactNode;
  /** Optional override for the run button label. */
  runLabel?: string;
  /** Hide the run button for step bodies that auto-run on user input (e.g. Input). */
  hideRun?: boolean;
  /** Optional custom continue handler (e.g. Input step advances without running). */
  onContinue?: () => void;
}

function stepIndex(id: PipelineStepId): number {
  return PIPELINE_STEP_ORDER.indexOf(id);
}

function nextOf(id: PipelineStepId): PipelineStepId | null {
  const idx = stepIndex(id);
  if (idx === -1 || idx >= PIPELINE_STEP_ORDER.length - 1) return null;
  return PIPELINE_STEP_ORDER[idx + 1];
}

export function StepShell({
  step,
  children,
  runLabel,
  hideRun,
  onContinue,
}: StepShellProps) {
  const meta = PIPELINE_STEPS.find((s) => s.id === step)!;
  const stepState = useAiPipelineStore((s) => s.stepState[step]);
  const runStep = useAiPipelineStore((s) => s.runStep);
  const goTo = useAiPipelineStore((s) => s.goTo);
  const isRunning = useAiPipelineStore((s) => s.isRunning);

  const next = nextOf(step);

  const handleRun = async () => {
    await runStep(step);
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
      return;
    }
    if (next) goTo(next);
  };

  return (
    <section className="aif-step" aria-labelledby={`step-title-${step}`}>
      <header className="aif-step__head">
        <div className="aif-step__head-text">
          <span className="aif-step__feature">{meta.feature}</span>
          <h3 id={`step-title-${step}`}>{meta.label}</h3>
          <p className="aif-step__desc">{meta.description}</p>
        </div>
        <div className={`aif-step__status aif-step__status--${stepState.status}`}>
          {stepState.status === "running" && "Running…"}
          {stepState.status === "success" &&
            (typeof stepState.wallTimeMs === "number"
              ? `Done · ${(stepState.wallTimeMs / 1000).toFixed(2)}s`
              : "Done")}
          {stepState.status === "error" &&
            (stepState.error ? `Error · ${stepState.error.slice(0, 64)}` : "Error")}
          {stepState.status === "pending" && "Pending"}
          {stepState.status === "skipped" && "Skipped"}
        </div>
      </header>
      <div className="aif-step__body">{children}</div>
      <footer className="aif-step__foot">
        {!hideRun && (
          <button
            type="button"
            className="aif-btn-primary"
            onClick={() => void handleRun()}
            disabled={isRunning}
          >
            {runLabel ?? `Run ${meta.shortLabel}`}
          </button>
        )}
        {next ? (
          <button
            type="button"
            className="aif-btn-ghost"
            onClick={handleContinue}
            disabled={isRunning}
          >
            Continue →
          </button>
        ) : null}
      </footer>
    </section>
  );
}
