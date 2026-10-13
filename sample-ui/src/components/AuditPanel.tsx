import type { AuditEvent } from "../types";

interface AuditPanelProps {
  events: AuditEvent[];
}

export function AuditPanel({ events }: AuditPanelProps) {
  return (
    <section className="audit-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Audit view</p>
          <h4>Decision trace</h4>
        </div>
      </div>

      <div className="audit-feed">
        {events.map((event) => (
          <article key={event.id} className="audit-feed__item">
            <div className="audit-feed__header">
              <strong>{event.eventType}</strong>
              <span>{event.timestamp}</span>
            </div>
            <p>{event.summary}</p>
            <div className="audit-feed__meta">
              <span>{event.actor}</span>
              <span>{event.ruleVersion}</span>
              <span>{event.promptVersion}</span>
              <span>{event.modelVersion}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
