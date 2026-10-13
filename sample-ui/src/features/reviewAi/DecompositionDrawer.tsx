/*
 * DecompositionDrawer — F1 protocol decomposition panel for the Review Workbench.
 *
 * Reads `useAiDecompositionStore`. Renders the criterion list with source
 * pageRef, computability tag, confidence, and the normalized ontology
 * concepts (post biomarker-ontology guard rewrite). A "Run F1 decomposition"
 * button kicks the store action — demo mode returns the canned fixture;
 * live mode hits the configured provider chain.
 *
 * The drawer is rendered inline inside the Review Workbench AI Live section,
 * not as a modal; the class name uses the `review-ai-drawer` prefix so CSS
 * can treat it as either a side rail or a stacked card.
 */

import { useAiDecompositionStore } from "../../stores/aiDecomposition";

function pill(kind: string): string {
  return `review-ai-drawer__pill review-ai-drawer__pill--${kind}`;
}

export function DecompositionDrawer() {
  const status = useAiDecompositionStore((s) => s.status);
  const view = useAiDecompositionStore((s) => s.view);
  const error = useAiDecompositionStore((s) => s.error);
  const wallTimeMs = useAiDecompositionStore((s) => s.wallTimeMs);
  const provider = useAiDecompositionStore((s) => s.provider);
  const model = useAiDecompositionStore((s) => s.model);
  const run = useAiDecompositionStore((s) => s.runDecomposition);

  const running = status === "running";

  return (
    <section className="review-ai-drawer" aria-label="AI Live: F1 decomposition">
      <header className="review-ai-drawer__head">
        <div>
          <span className="review-ai-drawer__eyebrow">F1 · Protocol decomposition</span>
          <h3>Criterion decomposition</h3>
          <p className="review-ai-drawer__sub">
            Decompose the active protocol into structured criteria with source spans,
            computability tags, and normalized ontology concepts (guard-rewritten).
          </p>
        </div>
        <button
          type="button"
          className="review-ai-drawer__run"
          onClick={() => void run()}
          disabled={running}
        >
          {running ? "Running F1…" : view ? "Re-run F1" : "Run F1 decomposition"}
        </button>
      </header>

      {error ? (
        <div className="review-ai-drawer__error" role="alert">
          {error}
        </div>
      ) : null}

      {view ? (
        <>
          <div className="review-ai-drawer__meta">
            <span>{view.criteria.length} criteria</span>
            <span>·</span>
            <span>{view.stats.inclusion} inclusion</span>
            <span>·</span>
            <span>{view.stats.exclusion} exclusion</span>
            <span>·</span>
            <span>{view.stats.flaggedForReview} flagged</span>
            {provider ? (
              <>
                <span>·</span>
                <span>
                  {provider} {model ? `(${model})` : null}
                </span>
              </>
            ) : null}
            {wallTimeMs !== null ? (
              <>
                <span>·</span>
                <span>{Math.round(wallTimeMs)} ms</span>
              </>
            ) : null}
          </div>
          <ol className="review-ai-drawer__list">
            {view.criteria.map((c) => (
              <li key={c.id} className="review-ai-drawer__item">
                <header>
                  <span className={pill(c.type)}>{c.type}</span>
                  <span className={pill(c.computability)}>{c.computability}</span>
                  <span className={pill(`conf-${c.confidence}`)}>{c.confidence}</span>
                  <code className="review-ai-drawer__id">{c.id}</code>
                </header>
                <p className="review-ai-drawer__label">{c.label}</p>
                {c.threshold ? (
                  <p className="review-ai-drawer__threshold">
                    threshold: <code>{c.threshold}</code>
                  </p>
                ) : null}
                <p className="review-ai-drawer__source">
                  <em>{c.source.pageRef}</em> — {c.source.originalText}
                </p>
                {c.normalizedConcepts.length > 0 ? (
                  <div className="review-ai-drawer__concepts">
                    {c.normalizedConcepts.map((concept) => (
                      <span key={concept} className="review-ai-drawer__concept">
                        {concept}
                      </span>
                    ))}
                  </div>
                ) : null}
                {c.reviewNote ? (
                  <p className="review-ai-drawer__note">Review note: {c.reviewNote}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      ) : !error ? (
        <p className="review-ai-drawer__empty">
          F1 has not run for this case yet. Click the button above to decompose the
          active protocol.
        </p>
      ) : null}
    </section>
  );
}
