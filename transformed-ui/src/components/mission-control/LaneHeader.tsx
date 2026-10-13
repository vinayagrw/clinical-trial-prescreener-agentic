import React from "react";
import type { TaskLaneConfig } from "../../types/extended";

interface LaneHeaderProps {
  config: TaskLaneConfig;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function LaneHeader({ config, count, collapsed, onToggle }: LaneHeaderProps) {
  return (
    <div className="lane-header">
      <span className="lane-header__icon">{config.icon}</span>
      <span className="lane-header__label">{config.label}</span>
      <span className="lane-header__count">{count}</span>
      <button
        className={`lane-header__toggle${collapsed ? " lane-header__toggle--collapsed" : ""}`}
        onClick={onToggle}
        aria-label={collapsed ? `Expand ${config.label}` : `Collapse ${config.label}`}
        aria-expanded={!collapsed}
        type="button"
      >
        &#9662;
      </button>
    </div>
  );
}
