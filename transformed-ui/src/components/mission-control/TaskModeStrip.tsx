import React from "react";
import type { TaskMode, TaskModeCard } from "../../types/extended";

interface TaskModeStripProps {
  modes: TaskModeCard[];
  activeMode: TaskMode | "all";
  onSelect: (mode: TaskMode | "all") => void;
}

/**
 * Job-mode pivots that sit above the TaskBoard. Coordinators operate by job
 * (clinic prep, PI review, outreach, watchlist) rather than by page; selecting
 * a mode filters the board at the *item* level so the lanes and keyboard nav
 * stay stable. Ported from sample-ui/src/components/TaskModeStrip.tsx
 * with 15's glass-surface token vocabulary.
 */
export function TaskModeStrip({ modes, activeMode, onSelect }: TaskModeStripProps) {
  return (
    <section className="task-mode-strip-section glass-surface glass-surface--card">
      <div className="task-mode-strip-section__header">
        <p className="task-mode-strip-section__eyebrow">Task modes</p>
        <h3 className="task-mode-strip-section__title">Operate by job, not by page</h3>
      </div>

      <div className="task-mode-strip">
        <button
          type="button"
          className={`task-mode-card ${activeMode === "all" ? "task-mode-card--active" : ""}`}
          onClick={() => onSelect("all")}
          aria-pressed={activeMode === "all"}
        >
          <span className="task-mode-card__label">All active work</span>
          <strong className="task-mode-card__metric">Cross-queue view</strong>
          <p className="task-mode-card__detail">
            See the full pilot stack without hiding a case family.
          </p>
        </button>

        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`task-mode-card ${
              activeMode === mode.id ? "task-mode-card--active" : ""
            }`}
            onClick={() => onSelect(mode.id)}
            aria-pressed={activeMode === mode.id}
          >
            <span className="task-mode-card__label">{mode.label}</span>
            <strong className="task-mode-card__metric">{mode.metric}</strong>
            <p className="task-mode-card__detail">{mode.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
