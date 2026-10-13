import type { ClinicalDocument } from "../types";

interface DocumentFeedProps {
  documents: ClinicalDocument[];
}

export function DocumentFeed({
  documents,
}: DocumentFeedProps) {
  return (
    <section className="surface handoff-surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Source window</p>
          <h3>Normalized documents</h3>
        </div>
      </div>

      <div className="document-feed">
        {documents.map((document) => (
          <article key={document.id} className="document-card">
            <div className="document-card__header">
              <strong>{document.title}</strong>
              <span>{document.docType.replace("_", " ")}</span>
            </div>
            <p className="handoff-worklist__meta">
              {document.service} | {document.author} | {new Date(document.authoredAt).toLocaleString()}
            </p>
            <p>{document.rawText}</p>
            <p className="document-card__hash">hash {document.hash.slice(0, 12)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
