import React from "react";

export interface StatusDotProps {
  status: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  label?: string;
}

export function StatusDot({
  status,
  size = "md",
  pulse = false,
  label,
}: StatusDotProps) {
  const dotClassNames = [
    "status-dot",
    `status-dot--${size}`,
    `status-dot--${status}`,
  ];
  if (pulse) dotClassNames.push("status-dot--pulse");

  const dot = <span className={dotClassNames.join(" ")} />;

  if (label) {
    return (
      <span className="status-dot-label">
        {dot}
        {label}
      </span>
    );
  }

  return dot;
}
