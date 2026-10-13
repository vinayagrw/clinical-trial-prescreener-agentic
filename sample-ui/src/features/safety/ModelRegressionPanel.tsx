/*
 * ModelRegressionPanel — surfaces model drift on the /safety dashboard.
 *
 * Reads `useSafetyEventsStore` and filters to events with
 * `mode === "model_regression"`. For each drift event we show the previous
 * signature vs. the fresh signature (both come from the check's `detail`
 * payload — see `lib/safety/modelRegressionCheck.ts`).
 *
 * The reset button wipes the in-memory signature cache via
 * `clearModelRegressionCache()`, which lets reviewers re-prime the check
 * from the dashboard without touching code.
 */

import { useMemo } from "react";
import { useSafetyEventsStore } from "../../lib/safety/safetyEvents";
import { clearModelRegressionCache } from "../../lib/safety/modelRegressionCheck";

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatTimestamp(value: unknown): string {
  const s = asString(value);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export function ModelRegressionPanel() {
  const events = useSafetyEventsStore((s) => s.events);

  const regressions = useMemo(
    () => events.filter((ev) => ev.mode === "model_regression"),
    [events],
  );

  return (
    <section className="safety-regression-panel" aria-label="Model regression drift">
      <header className="safety-regression-panel__head">
        <div>
          <h3>Model regression drift</h3>
          <p className="safety-regression-panel__blurb">
            Compares the shape of each AI output against the last-known-good run of the same
            input. Drift fires a <code>warn</code> — it never blocks the pipeline. Reset the
            cache to re-prime the first run as the new baseline.
          </p>
        </div>
        <button
          type="button"
          className="safety-regression-panel__reset"
          onClick={() => clearModelRegressionCache()}
        >
          Reset regression cache
        </button>
      </header>
      {regressions.length === 0 ? (
        <p className="safety-regression-panel__empty">
          No drift events. Run the "sf-regression" fixture twice or re-run F3 evaluation on
          the same criterion with different outputs to see drift appear here.
        </p>
      ) : (
        <ul className="safety-regression-panel__list">
          {regressions.map((ev) => {
            const detail = ev.detail ?? {};
            const prev = asString(detail.previousSignature);
            const fresh = asString(detail.freshSignature);
            const lastSeen = formatTimestamp(detail.lastSeenAt);
            return (
              <li key={ev.id} className="safety-regression-item">
                <header className="safety-regression-item__head">
                  <span className="safety-regression-item__feature">{ev.feature}</span>
                  <span className="safety-regression-item__message">{ev.message}</span>
                  <span className="safety-regression-item__time">
                    {new Date(ev.timestamp).toLocaleString()}
                  </span>
                </header>
                <dl className="safety-regression-item__diff">
                  <div>
                    <dt>previous</dt>
                    <dd>
                      <code>{prev}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>fresh</dt>
                    <dd>
                      <code>{fresh}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>last seen</dt>
                    <dd>{lastSeen}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
