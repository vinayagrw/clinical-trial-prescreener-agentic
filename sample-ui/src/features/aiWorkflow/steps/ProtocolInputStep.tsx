/*
 * ProtocolInputStep — step 1 of the pipeline.
 *
 * The F1 store already owns the protocol textarea state (`protocolText`
 * seeded to `DEFAULT_PROTOCOL_TEXT`), so this step just surfaces the
 * textarea as the pipeline's entry point. The "Start pipeline" action
 * advances the cursor and kicks the next step (decomposition) so the
 * first click on the stepper walks the user all the way through.
 */

import {
  useAiDecompositionStore,
  DEFAULT_PROTOCOL_TEXT,
} from "../../../stores/aiDecomposition";
import { useAiPipelineStore } from "../../../stores/aiPipeline";
import { StepShell } from "./StepShell";

export function ProtocolInputStep() {
  const protocolText = useAiDecompositionStore((s) => s.protocolText);
  const setProtocolText = useAiDecompositionStore((s) => s.setProtocolText);
  const runAll = useAiPipelineStore((s) => s.runAll);
  const isRunning = useAiPipelineStore((s) => s.isRunning);

  return (
    <StepShell
      step="input"
      hideRun
      onContinue={() => void runAll()}
    >
      <div className="aif-input-step">
        <label htmlFor="pipeline-protocol-input" className="aif-input-step__label">
          Eligibility section — paste or edit the trial protocol text. The
          pre-flight prompt-injection filter runs against this exact string
          before it reaches the F1 prompt.
        </label>
        <textarea
          id="pipeline-protocol-input"
          className="aif-input-step__textarea"
          value={protocolText}
          onChange={(e) => setProtocolText(e.target.value)}
          rows={14}
          spellCheck={false}
        />
        <div className="aif-input-step__actions">
          <button
            type="button"
            className="aif-btn-ghost"
            onClick={() => setProtocolText(DEFAULT_PROTOCOL_TEXT)}
            disabled={isRunning}
          >
            Reset to default
          </button>
          <button
            type="button"
            className="aif-btn-primary"
            onClick={() => void runAll()}
            disabled={isRunning || protocolText.trim().length === 0}
          >
            Start pipeline →
          </button>
        </div>
      </div>
    </StepShell>
  );
}
