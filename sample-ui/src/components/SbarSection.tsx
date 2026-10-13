import type { Citation, SbarBullet } from "../types";

interface SbarSectionProps {
  eyebrow: string;
  title: string;
  bullets: SbarBullet[];
  citationMap: Record<string, Citation>;
  emptyMessage: string;
}

export function SbarSection({
  eyebrow,
  title,
  bullets,
  citationMap,
  emptyMessage,
}: SbarSectionProps) {
  return (
    <section className="surface handoff-surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      {bullets.length === 0 ? (
        <p className="panel-copy">{emptyMessage}</p>
      ) : (
        <div className="sbar-bullets">
          {bullets.map((bullet) => (
            <article key={bullet.id} className="sbar-bullet">
              <p>{bullet.text}</p>
              <div className="sbar-bullet__citations">
                {bullet.citationIds.map((citationId) => {
                  const citation = citationMap[citationId];
                  if (!citation) return null;
                  return (
                    <a key={citationId} href={`#${citationId}`} className="citation-chip">
                      {citation.service} | {citation.documentTitle}
                    </a>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
