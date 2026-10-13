import React from "react";

export interface TooltipProps {
  content: string;
  position?: "top" | "bottom";
  children: React.ReactNode;
}

export function Tooltip({ content, position = "top", children }: TooltipProps) {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className={`tooltip tooltip--${position}`}>{content}</span>
    </span>
  );
}
