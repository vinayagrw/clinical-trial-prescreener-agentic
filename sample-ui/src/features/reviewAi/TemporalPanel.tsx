/*
 * TemporalPanel — F4 temporal reasoning panel for the Review Workbench.
 *
 * Reads `useAiTemporalStore`. Shows the three moving parts of the F4 story:
 *   - washout + other dated windows
 *   - lab freshness gates (tone colored)
 *   - earliest enrollment date decision + blockers
 *
 * A date input lets the reviewer slide the "today" anchor forward/backward
 * so they can see when the case becomes eligible. The store recomputes
 * synchronously — no network, no LLM.
 */

import { useAiTemporalStore } from "../../stores/aiTemporal";
import type { TemporalTone } from "../../types/aiFeatures";

function tonePill(tone: TemporalTone): string {
  return `review-ai-panel__tone review-ai-panel__tone--${tone}`;
}

export function TemporalPanel() {
  const run = useAiTemporalStore((s) => s.run);
  const todayIso = useAiTemporalStore((s) => s.todayIso);
  const setTodayIso = useAiTemporalStore((s) => s.setTodayIso);
  const error = useAiTemporalStore((s) => s.error);

  return (
    <section className="review-ai-panel" aria-label="AI Live: F4 temporal reasoning">
      <header className="review-ai-panel__head">
        <div>
          <span className="review-ai-panel__eyebrow">F4 · Temporal reasoning</span>
          <h3>Temporal gates and earliest enrollment</h3>
          <p className="review-ai-panel__sub">
            Deterministic washout clear-dates, imaging windows, lab freshness, and
            earliest enrollment date — recomputes instantly when you drag the today
            anchor.
          </p>
        </div>
        <label className="review-ai-panel__today">
          <span>Today</span>
          <input
            type="date"
            value={todayIso}
            onChange={(e) => setTodayIso(e.target.value)}
          />
        </label>
      </header>

      {error ? (
        <div className="review-ai-panel__error" role="alert">
          {error}
        </div>
      ) : null}

      {run ? (
        <>
          <div className={`review-ai-panel__decision review-ai-panel__decision--${run.decision.tone}`}>
            <div>
              <span className="review-ai-panel__decision-label">Earliest enrollment</span>
              <strong className="review-ai-panel__decision-date">
                {run.decision.earliestEnrollmentDate}
              </strong>
              <span className="review-ai-panel__decision-window">
                {run.decision.windowLabel}
              </span>
            </div>
            {run.decision.blockers.length > 0 ? (
              <ul className="review-ai-panel__blockers">
                {run.decision.blockers.map((b, i) => (
                  <li key={`${b}-${i}`}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="review-ai-panel__no-blockers">No temporal blockers remain.</p>
            )}
          </div>

          <div className="review-ai-panel__section">
            <h4>Windows</h4>
            <ul className="review-ai-panel__windows">
              {run.windows.map((w) => (
                <li key={w.id}>
                  <div className="review-ai-panel__window-head">
                    <span className={tonePill(w.tone)}>{w.tone}</span>
                    <strong>{w.label}</strong>
                    <span className="review-ai-panel__window-dates">
                      {w.startDate} → {w.endDate}
                    </span>
                    <span className="review-ai-panel__window-delta">
                      {w.daysFromToday >= 0
                        ? `+${w.daysFromToday}d`
                        : `${w.daysFromToday}d`}
                    </span>
                  </div>
                  <p className="review-ai-panel__window-detail">{w.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="review-ai-panel__section">
            <h4>Lab freshness</h4>
            <ul className="review-ai-panel__labs">
              {run.labFreshness.map((lab) => (
                <li key={lab.id}>
                  <div className="review-ai-panel__lab-head">
                    <span className={tonePill(lab.tone)}>{lab.tone}</span>
                    <strong>{lab.labName}</strong>
                    <span>{lab.lastValue}</span>
                  </div>
                  <div className="review-ai-panel__lab-meta">
                    <span>drawn {lab.lastDrawn}</span>
                    <span>·</span>
                    <span>window {lab.windowDays} d</span>
                    <span>·</span>
                    <span>fresh through {lab.freshThrough}</span>
                    <span>·</span>
                    <span>
                      {lab.daysUntilStale >= 0
                        ? `${lab.daysUntilStale} d remaining`
                        : `${Math.abs(lab.daysUntilStale)} d overdue`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}
