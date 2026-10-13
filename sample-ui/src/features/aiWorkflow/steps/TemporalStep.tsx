/*
 * TemporalStep — step 5 (F4 Temporal Reasoning + washout calculator).
 */

import { TemporalReasoningView } from "../../../components/aiFeatures/TemporalReasoningView";
import { StepShell } from "./StepShell";

export function TemporalStep() {
  return (
    <StepShell step="temporal" runLabel="Recompute F4 temporal">
      <TemporalReasoningView />
    </StepShell>
  );
}
