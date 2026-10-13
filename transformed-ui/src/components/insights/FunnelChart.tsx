import React, { useEffect, useRef, useState } from "react";
import type { FunnelMetric } from "@old/types";

export interface FunnelChartProps {
  metrics: FunnelMetric[];
  /**
   * Optional comparison series. When provided, bars animate from the
   * previous `metrics` value to the new one and display a delta chip.
   */
  comparisonBaseline?: FunnelMetric[];
  /** Seed for the max-width normalization (defaults to max of current series). */
  maxValueOverride?: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Animate a numeric value between changes using requestAnimationFrame.
 * Used by the count-up labels when the series flips.
 */
function useAnimatedNumber(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (target === display) return;
    fromRef.current = display;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic for snappy-but-smooth settle
      const eased = 1 - Math.pow(1 - t, 3);
      const next = lerp(fromRef.current, target, eased);
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return display;
}

function FunnelStage({
  metric,
  baseline,
  maxValue,
}: {
  metric: FunnelMetric;
  baseline?: FunnelMetric;
  maxValue: number;
}) {
  const animated = useAnimatedNumber(metric.value);
  const widthPct = (animated / maxValue) * 100;
  const delta = baseline ? metric.value - baseline.value : null;

  return (
    <div className="funnel-chart__stage">
      <span className="funnel-chart__label">{metric.label}</span>
      <div className="funnel-chart__bar-track">
        <div
          className="funnel-chart__bar-fill"
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="funnel-chart__value">{Math.round(animated)}</span>
      {delta !== null && delta !== 0 && (
        <span
          className={
            "funnel-chart__delta" +
            (delta > 0
              ? " funnel-chart__delta--up"
              : " funnel-chart__delta--down")
          }
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </div>
  );
}

export function FunnelChart({
  metrics,
  comparisonBaseline,
  maxValueOverride,
}: FunnelChartProps) {
  // Use the larger of (current, baseline) as the normalization so bars
  // don't visually shrink when flipping back to the smaller series.
  const allValues = [
    ...metrics.map((m) => m.value),
    ...(comparisonBaseline?.map((m) => m.value) ?? []),
    1,
  ];
  const maxValue = maxValueOverride ?? Math.max(...allValues);

  return (
    <div className="funnel-chart">
      {metrics.map((metric, i) => (
        <FunnelStage
          key={metric.label}
          metric={metric}
          baseline={comparisonBaseline?.[i]}
          maxValue={maxValue}
        />
      ))}
    </div>
  );
}
