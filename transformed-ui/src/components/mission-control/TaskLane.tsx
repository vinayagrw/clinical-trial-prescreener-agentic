import React, { useState } from "react";
import type { QueueItemEnriched, TaskLaneConfig } from "../../types/extended";
import { LaneHeader } from "./LaneHeader";
import { PatientCard } from "./PatientCard";

interface TaskLaneProps {
  config: TaskLaneConfig;
  items: QueueItemEnriched[];
  selectedMatchId: string | null;
  onCardClick: (matchId: string) => void;
}

export function TaskLane({ config, items, selectedMatchId, onCardClick }: TaskLaneProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="task-lane" id={`lane-${config.id}`}>
      <LaneHeader
        config={config}
        count={items.length}
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
      />
      {!collapsed && (
        <div className="task-lane__cards" role="list">
          {items.map((item, index) => (
            <PatientCard
              key={item.matchId}
              item={item}
              selected={selectedMatchId === item.matchId}
              onClick={() => onCardClick(item.matchId)}
              animationDelay={index * 60}
              laneId={config.id}
              cardIndex={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
