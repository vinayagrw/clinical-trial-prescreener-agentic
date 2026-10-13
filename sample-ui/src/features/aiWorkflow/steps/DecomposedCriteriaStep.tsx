/*
 * DecomposedCriteriaStep — step 2.
 *
 * Reuses the already-wired `ProtocolDecompositionView` — that component
 * already reads from `useAiDecompositionStore`, so wrapping it in the
 * StepShell is all we need. The Run button re-runs F1 in isolation; the
 * Continue button advances to F2 retrieval.
 */

import { ProtocolDecompositionView } from "../../../components/aiFeatures/ProtocolDecompositionView";
import { StepShell } from "./StepShell";

export function DecomposedCriteriaStep() {
  return (
    <StepShell step="decomposition" runLabel="Run F1 decomposition">
      <ProtocolDecompositionView />
    </StepShell>
  );
}
