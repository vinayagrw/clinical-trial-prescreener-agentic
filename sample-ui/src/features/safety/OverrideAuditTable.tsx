/*
 * OverrideAuditTable — coordinator override trail for /safety.
 *
 * Reads `useSafetyEventsStore`, filters to events with
 * `mode === "override_audit"`, and renders a compact table with:
 *   - timestamp
 *   - subject (criterion / match / enrollment id)
 *   - feature
 *   - actor (coordinator id)
 *   - reason
 *   - before / after JSON diff (click row to expand)
 *
 * No writes — this is a pure reader.
 */

import { useMemo, useState } from "react";
import { useSafetyEventsStore } from "../../lib/safety/safetyEvents";

function formatStamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export function OverrideAuditTable() {
  const events = useSafetyEventsStore((s) => s.events);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const overrides = useMemo(
    () => events.filter((ev) => ev.mode === "override_audit"),
    [events],
  );

  return (
    <section className="safety-override-table" aria-label="Override audit trail">
      <header className="safety-override-table__head">
        <h3>Override audit trail</h3>
        <span className="safety-override-table__count">
          {overrides.length} override{overrides.length === 1 ? "" : "s"}
        </span>
      </header>
      {overrides.length === 0 ? (
        <p className="safety-override-table__empty">
          No coordinator overrides yet. Run the "sf-override" fixture or override a verdict
          on the Review Workbench to populate this table.
        </p>
      ) : (
        <div className="safety-override-table__scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Subject</th>
                <th>Feature</th>
                <th>Actor</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((ev) => {
                const detail = ev.detail ?? {};
                const subject = typeof detail.subjectId === "string" ? detail.subjectId : "—";
                const actor = typeof detail.actor === "string" ? detail.actor : "unknown";
                const reason = typeof detail.reason === "string" ? detail.reason : "—";
                const expanded = ev.id === expandedId;
                return (
                  <tr
                    key={ev.id}
                    className={expanded ? "safety-override-row--expanded" : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="safety-override-toggle"
                        onClick={() => setExpandedId(expanded ? null : ev.id)}
                      >
                        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                        {formatStamp(ev.timestamp)}
                      </button>
                      {expanded && ev.mutation ? (
                        <div className="safety-override-diff">
                          <div>
                            <span className="safety-override-diff__label">before</span>
                            <pre>{ev.mutation.before}</pre>
                          </div>
                          <div>
                            <span className="safety-override-diff__label">after</span>
                            <pre>{ev.mutation.after}</pre>
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td><code>{subject}</code></td>
                    <td>{ev.feature}</td>
                    <td>{actor}</td>
                    <td className="safety-override-reason">{reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
