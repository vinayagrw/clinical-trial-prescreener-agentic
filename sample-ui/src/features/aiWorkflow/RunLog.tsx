/*
 * RunLog — bottom-docked timeline of pipeline step transitions.
 *
 * Reads `useAiPipelineStore.runLog` — the store pushes entries every time
 * a step starts, finishes, or fails. Each entry shows the feature tag,
 * the message, optional provider/model, and wall-time.
 *
 * This is distinct from the SafetyConsole (which shows guard events). This
 * is the "what the orchestrator did" log — useful for the pitch because it
 * shows the per-provider routing + elapsed time per step at a glance.
 */

import { useAiPipelineStore, type RunLogEntry } from "../../stores/aiPipeline";

function toneClass(tone: RunLogEntry["tone"]): string {
  return `aif-runlog-entry aif-runlog-entry--${tone}`;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function RunLog() {
  const entries = useAiPipelineStore((s) => s.runLog);
  if (entries.length === 0) {
    return (
      <section className="aif-runlog">
        <header className="aif-runlog__head">
          <span className="aif-runlog__eyebrow">Run log</span>
          <h3>Pipeline timeline</h3>
        </header>
        <p className="aif-runlog__empty">
          No entries yet. Click <strong>Run all</strong> above or kick a step
          manually to see the orchestrator's per-step wall-time + provider
          route land here.
        </p>
      </section>
    );
  }
  return (
    <section className="aif-runlog">
      <header className="aif-runlog__head">
        <span className="aif-runlog__eyebrow">Run log</span>
        <h3>Pipeline timeline ({entries.length})</h3>
      </header>
      <ul className="aif-runlog__list" role="list">
        {entries.map((entry) => (
          <li key={entry.id} className={toneClass(entry.tone)}>
            <span className="aif-runlog-entry__time">{timeLabel(entry.at)}</span>
            <span className="aif-runlog-entry__feature">{entry.feature}</span>
            <span className="aif-runlog-entry__message">{entry.message}</span>
            {entry.provider ? (
              <span className="aif-runlog-entry__provider">
                {entry.provider}
                {entry.model ? ` / ${entry.model}` : ""}
              </span>
            ) : null}
            {typeof entry.wallTimeMs === "number" && entry.wallTimeMs > 0 ? (
              <span className="aif-runlog-entry__wall">
                {(entry.wallTimeMs / 1000).toFixed(2)}s
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
