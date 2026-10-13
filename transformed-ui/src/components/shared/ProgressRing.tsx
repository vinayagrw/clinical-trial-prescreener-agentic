import React from "react";

export interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: "teal" | "moss" | "amber" | "brick";
  showLabel?: boolean;
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  color = "teal",
  showLabel = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

  return (
    <div className="progress-ring">
      <svg
        className="progress-ring__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="progress-ring__track"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className={`progress-ring__fill progress-ring__fill--${color}`}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel && (
        <span className="progress-ring__label">{value}</span>
      )}
    </div>
  );
}
