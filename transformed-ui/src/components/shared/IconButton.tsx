import React from "react";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  badge?: number;
}

export function IconButton({ icon, label, onClick, badge }: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        className="icon-btn"
        onClick={onClick}
        aria-label={label}
        type="button"
      >
        {icon}
        {badge != null && badge > 0 && <span className="badge">{badge}</span>}
      </button>
    </Tooltip>
  );
}
