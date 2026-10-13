import React, { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { enrichedQueueItems, laneConfigs } from "../../data/extendedMockData";
import { groupByLane, sortByUrgency } from "../../data/helpers";
import type { QueueItemEnriched, TaskMode } from "../../types/extended";
import { TaskLane } from "./TaskLane";

interface TaskBoardProps {
  /**
   * Optional job-mode filter from TaskModeStrip. Filters at the item level
   * (not the lane level) so keyboard-nav indices and lane structure stay
   * stable. Defaults to "all" which shows every item.
   */
  activeMode?: TaskMode | "all";
}

/** Filter predicates per task-mode. Returning true keeps the item visible. */
function matchesMode(item: QueueItemEnriched, mode: TaskMode | "all"): boolean {
  switch (mode) {
    case "all":
      return true;
    case "today":
      // Same-day action list — critical priority items across every lane.
      return item.priority === "critical";
    case "clinic_prep":
      return item.lane === "action_now";
    case "needs_pi_review":
      return item.lane === "needs_pi";
    case "ready_for_outreach":
      return item.lane === "ready_outreach";
    case "watchlist":
      return item.lane === "watching";
    case "ops":
      // Ops is a portfolio view handled by MissionControlPage routing to
      // /insights — if the mode still reaches here, show nothing rather than
      // silently displaying the full board.
      return false;
    default:
      return true;
  }
}

export function TaskBoard({ activeMode = "all" }: TaskBoardProps) {
  const { selectedMatchId, setSelectedMatchId } = useApp();
  const navigate = useNavigate();
  const boardRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(
    () => enrichedQueueItems.filter((item) => matchesMode(item, activeMode)),
    [activeMode]
  );
  const grouped = useMemo(() => groupByLane(filteredItems), [filteredItems]);

  const handleCardClick = (matchId: string) => {
    setSelectedMatchId(matchId);
    navigate(`/review/${matchId}`);
  };

  // Keyboard navigation: arrow keys move focus between patient cards.
  // ArrowUp/Down moves within a lane, ArrowLeft/Right jumps between lanes.
  // Scope-gated: only triggers when the focused element is a patient card
  // inside this board, so global shortcuts in KeyboardContext are unaffected.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = document.activeElement as HTMLElement | null;
    if (!target || !target.dataset.lane) return;
    if (!boardRef.current?.contains(target)) return;

    const currentLane = target.dataset.lane;
    const currentIndex = Number(target.dataset.cardIndex ?? -1);
    if (Number.isNaN(currentIndex) || currentIndex < 0) return;

    const laneIds: string[] = laneConfigs.map((l) => l.id);
    const laneIndex = laneIds.indexOf(currentLane);

    function focusCard(lane: string, index: number) {
      const el = boardRef.current?.querySelector<HTMLElement>(
        `[data-lane="${lane}"][data-card-index="${index}"]`
      );
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    function focusFirstInLane(lane: string) {
      const el = boardRef.current?.querySelector<HTMLElement>(
        `[data-lane="${lane}"][data-card-index="0"]`
      );
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        focusCard(currentLane, currentIndex + 1);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (currentIndex > 0) focusCard(currentLane, currentIndex - 1);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        for (let i = laneIndex + 1; i < laneIds.length; i++) {
          const lane = laneIds[i];
          if (grouped[lane as keyof typeof grouped] && grouped[lane as keyof typeof grouped].length > 0) {
            focusFirstInLane(lane);
            break;
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        for (let i = laneIndex - 1; i >= 0; i--) {
          const lane = laneIds[i];
          if (grouped[lane as keyof typeof grouped] && grouped[lane as keyof typeof grouped].length > 0) {
            focusFirstInLane(lane);
            break;
          }
        }
        break;
      }
    }
  };

  if (enrichedQueueItems.length === 0) {
    return (
      <div className="task-board task-board--empty glass-surface glass-surface--card">
        <div className="task-board__empty-title">No items in queue</div>
        <div className="task-board__empty-body">
          Check back after the next screening sweep — new candidates will appear here.
        </div>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="task-board task-board--empty glass-surface glass-surface--card">
        <div className="task-board__empty-title">No items match this mode</div>
        <div className="task-board__empty-body">
          Switch back to "All active work" to see every case in the pilot stack.
        </div>
      </div>
    );
  }

  return (
    <div
      className="task-board"
      ref={boardRef}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Patient task board"
    >
      {laneConfigs.map((config) => (
        <TaskLane
          key={config.id}
          config={config}
          items={sortByUrgency(grouped[config.id])}
          selectedMatchId={selectedMatchId}
          onCardClick={handleCardClick}
        />
      ))}
    </div>
  );
}
