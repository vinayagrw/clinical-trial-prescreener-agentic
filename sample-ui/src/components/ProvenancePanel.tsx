import type { Citation } from "../types";

interface ProvenancePanelProps {
  citations: Citation[];
}

export function ProvenancePanel({
  citations,
}: ProvenancePanelProps) {
  return (
    <section className="surface handoff-surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Why this sentence exists</p>
          <h3>Sentence-level provenance</h3>
        </div>
      </div>

      <div className="provenance-stack">
        {citations.map((citation) => (
          <article key={citation.id} id={citation.id} className="provenance-card">
            <div className="provenance-card__header">
              <strong>{citation.documentTitle}</strong>
              <span>{citation.service}</span>
            </div>
            <blockquote>{citation.quotedEvidence}</blockquote>
            <p>{new Date(citation.authoredAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
