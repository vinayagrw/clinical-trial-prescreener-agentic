/*
 * PipelineStepper — the top-level layout for the guided /ai-features workflow.
 *
 * Structure:
 *   [ PipelineHeader: provider chips + demo/live toggle + Run all + reset ]
 *   [ step rail (tabs): Input | F1 | F2 | F3 | F4 | F5 | Done  ]
 *   [ main pane (active step body) | right rail SafetyConsole ]
 *   [ bottom RunLog timeline                                   ]
 *
 * The stepper is a pure consumer of `useAiPipelineStore` + the feature stores.
 * It does not own any persistent state itself, so every step can be re-run
 * independently and the page re-renders predictably when you toggle demo mode.
 */

import type { ReactNode } from "react";
import {
  PIPELINE_STEPS,
  useAiPipelineStore,
  type PipelineStepId,
  type PipelineStepMeta,
} from "../../stores/aiPipeline";
import { PipelineHeader } from "./PipelineHeader";
import { SafetyConsole } from "./SafetyConsole";
import { RunLog } from "./RunLog";
import { ProtocolInputStep } from "./steps/ProtocolInputStep";
import { DecomposedCriteriaStep } from "./steps/DecomposedCriteriaStep";
import { RetrievalStep } from "./steps/RetrievalStep";
import { EvaluationStep } from "./steps/EvaluationStep";
import { TemporalStep } from "./steps/TemporalStep";
import { AgentStep } from "./steps/AgentStep";
import { DoneStep } from "./steps/DoneStep";

function stepBody(id: PipelineStepId): ReactNode {
  switch (id) {
    case "input":
      return <ProtocolInputStep />;
    case "decomposition":
      return <DecomposedCriteriaStep />;
    case "retrieval":
      return <RetrievalStep />;
    case "evaluation":
      return <EvaluationStep />;
    case "temporal":
      return <TemporalStep />;
    case "agent":
      return <AgentStep />;
    case "done":
      return <DoneStep />;
  }
}

function statusChip(meta: PipelineStepMeta, active: boolean, status: string): string {
  const base = "aif-step-tab";
  const activeClass = active ? ` ${base}--active` : "";
  return `${base} ${base}--${status}${activeClass}`;
}

export function PipelineStepper() {
  const currentStep = useAiPipelineStore((s) => s.currentStep);
  const stepState = useAiPipelineStore((s) => s.stepState);
  const goTo = useAiPipelineStore((s) => s.goTo);

  return (
    <div className="aif-stepper">
      <PipelineHeader />
      <nav className="aif-step-rail" aria-label="Pipeline steps">
        {PIPELINE_STEPS.map((meta, idx) => {
          const s = stepState[meta.id];
          const isActive = meta.id === currentStep;
          return (
            <button
              key={meta.id}
              type="button"
              className={statusChip(meta, isActive, s.status)}
              onClick={() => goTo(meta.id)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="aif-step-tab__num">{idx + 1}</span>
              <span className="aif-step-tab__body">
                <span className="aif-step-tab__label">{meta.shortLabel}</span>
                <span className="aif-step-tab__sub">{meta.label.replace(/^F\d\s·\s/, "")}</span>
              </span>
              <span
                className={`aif-step-tab__dot aif-step-tab__dot--${s.status}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </nav>
      <div className="aif-stepper-body">
        <main className="aif-step-main">{stepBody(currentStep)}</main>
        <aside className="aif-step-side">
          <SafetyConsole />
        </aside>
      </div>
      <RunLog />
    </div>
  );
}
