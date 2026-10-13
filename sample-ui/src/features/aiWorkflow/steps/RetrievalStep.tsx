/*
 * RetrievalStep — step 3 (F2 Hybrid Retrieval).
 */

import { HybridRetrievalView } from "../../../components/aiFeatures/HybridRetrievalView";
import { StepShell } from "./StepShell";

export function RetrievalStep() {
  return (
    <StepShell step="retrieval" runLabel="Run F2 retrieval">
      <HybridRetrievalView />
    </StepShell>
  );
}
