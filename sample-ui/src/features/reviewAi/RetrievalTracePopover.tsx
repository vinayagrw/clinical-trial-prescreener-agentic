/*
 * RetrievalTracePopover — F2 hybrid retrieval trace for the Review Workbench.
 *
 * The "popover" framing in the plan is shorthand — we render this as an
 * inline panel (not a floating popover) so it can live inside the Review
 * Workbench's AI Live rail alongside the other three panels. The content
 * still matches the plan: BM25 score, embedding score, hybrid blended score,
 * reranker score, final score, and the freshness gate decision per hit.
 *
 * Reads `useAiRetrievalStore`. A "Run F2 retrieval" button kicks the store
 * action against the currently selected criterion option. Switching the
 * select box changes the stored criterion so the next run targets a
 * different query.
 */

import {
  useAiRetrievalStore,
  RETRIEVAL_CRITERIA,
} from "../../stores/aiRetrieval";

function scoreCell(score: number): string {
  return score.toFixed(3);
}

export function RetrievalTracePopover() {
  const status = useAiRetrievalStore((s) => s.status);
  const run = useAiRetrievalStore((s) => s.runRetrieval);
  const runState = useAiRetrievalStore((s) => s.run);
  const error = useAiRetrievalStore((s) => s.error);
  const selectedId = useAiRetrievalStore((s) => s.selectedCriterionId);
  const setSelected = useAiRetrievalStore((s) => s.setSelectedCriterion);

  const running = status === "running";

  return (
    <section className="review-ai-popover" aria-label="AI Live: F2 retrieval trace">
      <header className="review-ai-popover__head">
        <div>
          <span className="review-ai-popover__eyebrow">F2 · Hybrid retrieval</span>
          <h3>Retrieval trace</h3>
          <p className="review-ai-popover__sub">
            BM25 + embedding + blended score with a freshness gate. Deterministic,
            runs in-browser, no network.
          </p>
        </div>
        <button
          type="button"
          className="review-ai-popover__run"
          onClick={() => void run()}
          disabled={running}
        >
          {running ? "Running F2…" : runState ? "Re-run F2" : "Run F2 retrieval"}
        </button>
      </header>

      <label className="review-ai-popover__select">
        <span>Criterion</span>
        <select
          value={selectedId}
          onChange={(e) => setSelected(e.target.value)}
        >
          {RETRIEVAL_CRITERIA.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <div className="review-ai-popover__error" role="alert">
          {error}
        </div>
      ) : null}

      {runState ? (
        <>
          <div className="review-ai-popover__meta">
            <span>{runState.results.length} hits</span>
            <span>·</span>
            <span>corpus {runState.corpusSizeNotes} notes</span>
            <span>·</span>
            <span>
              BM25 {runState.query.hybridWeights.bm25.toFixed(2)} / embed{" "}
              {runState.query.hybridWeights.embedding.toFixed(2)}
            </span>
            <span>·</span>
            <span>{runState.wallTimeMs} ms</span>
          </div>
          <div className="review-ai-popover__table-wrap">
            <table className="review-ai-popover__table">
              <thead>
                <tr>
                  <th>Evidence</th>
                  <th>BM25</th>
                  <th>Embed</th>
                  <th>Hybrid</th>
                  <th>Rerank</th>
                  <th>Final</th>
                  <th>Fresh</th>
                </tr>
              </thead>
              <tbody>
                {runState.results.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      r.passesFreshnessGate
                        ? undefined
                        : "review-ai-popover__row--stale"
                    }
                  >
                    <td>
                      <div className="review-ai-popover__evidence">
                        <code>{r.id}</code>
                        <span>{r.source}</span>
                        <em>{r.sourceDate}</em>
                      </div>
                      <p className="review-ai-popover__excerpt">{r.excerpt}</p>
                    </td>
                    <td>{scoreCell(r.bm25Score)}</td>
                    <td>{scoreCell(r.embeddingScore)}</td>
                    <td>{scoreCell(r.hybridScore)}</td>
                    <td>{scoreCell(r.rerankerScore)}</td>
                    <td>
                      <strong>{scoreCell(r.finalScore)}</strong>
                    </td>
                    <td>
                      <span
                        className={`review-ai-popover__gate review-ai-popover__gate--${
                          r.passesFreshnessGate ? "ok" : "stale"
                        }`}
                      >
                        {r.passesFreshnessGate ? "in window" : "stale"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !error ? (
        <p className="review-ai-popover__empty">
          F2 has not run yet. Pick a criterion and click "Run F2 retrieval".
        </p>
      ) : null}
    </section>
  );
}
