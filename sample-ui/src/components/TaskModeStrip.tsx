import type { TaskMode, TaskModeCard } from "../types";

interface TaskModeStripProps {
  modes: TaskModeCard[];
  activeMode: TaskMode | "all";
  onSelect: (mode: TaskMode | "all") => void;
}

export function TaskModeStrip({
  modes,
  activeMode,
  onSelect
}: TaskModeStripProps) {
  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Task modes</p>
          <h3>Operate by job, not by page</h3>
        </div>
      </div>

      <div className="task-mode-strip">
        <button
          type="button"
          className={`task-mode-card ${activeMode === "all" ? "task-mode-card--active" : ""}`}
          onClick={() => onSelect("all")}
        >
          <span>All active work</span>
          <strong>Cross-queue view</strong>
          <p>See the full pilot stack without hiding a case family.</p>
        </button>

        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`task-mode-card ${
              activeMode === mode.id ? "task-mode-card--active" : ""
            }`}
            onClick={() => onSelect(mode.id)}
          >
            <span>{mode.label}</span>
            <strong>{mode.metric}</strong>
            <p>{mode.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
