import type { HandoffAuditEvent } from "../types";

interface HandoffAuditPanelProps {
  events: HandoffAuditEvent[];
}

export function HandoffAuditPanel({
  events,
}: HandoffAuditPanelProps) {
  return (
    <section className="surface handoff-surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Audit</p>
          <h3>Pipeline trace</h3>
        </div>
      </div>

      <div className="audit-trace">
        {events.map((event) => (
          <article key={event.id} className="audit-trace__event">
            <div className="audit-trace__header">
              <strong>{event.stage.replace(/_/g, " ")}</strong>
              <span>{new Date(event.createdAt).toLocaleString()}</span>
            </div>
            <p>{event.summary}</p>
            <p>{event.detail}</p>
            {event.metrics ? (
              <div className="audit-trace__metrics">
                {Object.entries(event.metrics).map(([key, value]) => (
                  <span key={key}>
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
