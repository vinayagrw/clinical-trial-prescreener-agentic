import React from "react";
import { Sparkline } from "../shared/Sparkline";

interface MetricHeroProps {
  label: string;
  value: number;
  delta?: { value: number; direction: "up" | "down" | "neutral" };
  sparklineData?: number[];
  /** Optional click handler — when set the hero renders as a button and gets focus/hover affordances. */
  onClick?: () => void;
  /** Optional tooltip / accessible description for the drill-down target. */
  title?: string;
}

function formatDelta(delta: { value: number; direction: "up" | "down" | "neutral" }): string {
  if (delta.direction === "neutral") return "--";
  const sign = delta.direction === "up" ? "+" : "-";
  return `${sign}${delta.value}`;
}

export function MetricHero({
  label,
  value,
  delta,
  sparklineData,
  onClick,
  title,
}: MetricHeroProps) {
  const clickable = typeof onClick === "function";
  const className =
    "metric-hero glass-surface glass-surface--card" +
    (clickable ? " metric-hero--clickable" : "");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={className}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={title}
      aria-label={clickable ? `${label}: ${value}` : undefined}
    >
      <div className="metric-hero__label">{label}</div>
      <div className="metric-hero__row">
        <span className="metric-hero__value">{value}</span>
        {delta && (
          <span className={`metric-hero__delta metric-hero__delta--${delta.direction}`}>
            {formatDelta(delta)}
          </span>
        )}
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline data={sparklineData} width={64} height={24} />
        )}
      </div>
    </div>
  );
}
