import { StatusChip } from "./StatusChip";
import type { Disagreement } from "../types";

interface DisagreementPanelProps {
  disagreements: Disagreement[];
}

function toneForSeverity(severity: Disagreement["severity"]) {
  if (severity === "critical") return "brick";
  if (severity === "high") return "amber";
  return "paper";
}

export function DisagreementPanel({
  disagreements,
}: DisagreementPanelProps) {
  return (
    <section className="surface handoff-surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Disagreements</p>
          <h3>Multi-service conflicts</h3>
        </div>
      </div>

      {disagreements.length === 0 ? (
        <p className="panel-copy">No unresolved service-level disagreement was detected in the selected window.</p>
      ) : (
        <div className="disagreement-stack">
          {disagreements.map((item) => (
            <article key={item.id} className="disagreement-card">
              <div className="disagreement-card__header">
                <strong>{item.topic}</strong>
                <StatusChip label={item.severity} tone={toneForSeverity(item.severity)} compact />
              </div>
              <p>{item.summary}</p>
              <div className="disagreement-positions">
                {item.positions.map((position) => (
                  <div key={`${item.id}-${position.service}`} className="disagreement-position">
                    <strong>{position.service}</strong>
                    <p>{position.assertion}</p>
                    <span>
                      {new Date(position.authoredAt).toLocaleString()} | certainty {position.certainty}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
