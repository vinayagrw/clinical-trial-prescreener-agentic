/*
 * AiLiveOverlay — composed AI Live panel for the Review Workbench.
 *
 * This is the single lazy-loadable entry point that ReviewWorkbenchPage
 * pulls in when the AI Live toggle goes from OFF → ON. Bundling the four
 * review-AI panels + stores behind one dynamic import means the default
 * read-only page ships zero extra bytes for the overlay — the acceptance
 * criterion from the plan.
 *
 * Layout:
 *   [ DecompositionDrawer (F1) | RetrievalTracePopover (F2) ]
 *   [ LiveMatrixOverlay (F3)                                ]
 *   [ TemporalPanel (F4)                                    ]
 */

import { DecompositionDrawer } from "./DecompositionDrawer";
import { RetrievalTracePopover } from "./RetrievalTracePopover";
import { LiveMatrixOverlay } from "./LiveMatrixOverlay";
import { TemporalPanel } from "./TemporalPanel";

export default function AiLiveOverlay() {
  return (
    <section className="review-ai-overlay-root" aria-label="AI Live overlay">
      <div className="review-ai-overlay-root__banner">
        <span className="review-ai-overlay-root__eyebrow">AI Live</span>
        <p>
          Live AI overlay is running against the same orchestrator, deterministic retrieval
          libs, and 10-mode safety guard stack that drive <code>/ai-features</code> and
          <code>/safety</code>. Toggle this off to return to the byte-for-byte identical
          read-only review workbench.
        </p>
      </div>
      <div className="review-ai-overlay-root__row">
        <DecompositionDrawer />
        <RetrievalTracePopover />
      </div>
      <LiveMatrixOverlay />
      <TemporalPanel />
    </section>
  );
}
