import type { TimelineEvent } from "../types";

interface TimelineLaneProps {
  events: TimelineEvent[];
}

export function TimelineLane({ events }: TimelineLaneProps) {
  return (
    <section className="timeline-lane">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Temporal reasoning lane</p>
          <h4>Key dates around screening</h4>
        </div>
      </div>

      <div className="timeline-events">
        {events.map((event) => (
          <article key={event.id} className={`timeline-event timeline-event--${event.tone}`}>
            <span className="timeline-date">{event.date}</span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
