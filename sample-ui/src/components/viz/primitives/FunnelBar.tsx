/*
 * FunnelBar — honest sequential funnel.
 *
 * Rejects the trapezoid/geometric funnel that distorts ratios. Instead:
 * - Each stage is a horizontal bar, all aligned to the same baseline.
 * - Bar length encodes the raw value as a percentage of stage 1.
 * - A drop-off annotation between stages shows "% lost" explicitly.
 * - The active stage label lives inside the bar when there's room, otherwise to the right.
 *
 * Used by features/command-center/components/viz/FunnelPerformance.tsx (V1).
 */

import { useId, useMemo } from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useVizPalette } from "../useVizPalette";
import { useVizKeyboardNav } from "../useVizKeyboardNav";

export interface FunnelBarDatum {
  id: string;
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "warning";
}

export interface FunnelBarProps {
  data: readonly FunnelBarDatum[];
  width: number;
  height: number;
  onActivate?: (datum: FunnelBarDatum, index: number) => void;
}

const MARGIN = { top: 16, right: 80, bottom: 20, left: 140 };
const BAR_GAP = 10;

export function FunnelBar({ data, width, height, onActivate }: FunnelBarProps) {
  const palette = useVizPalette();
  const titleId = useId();

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 10);
  const barHeight = Math.max(
    (innerHeight - BAR_GAP * (data.length - 1)) / Math.max(data.length, 1),
    12
  );

  const first = data[0]?.value ?? 1;
  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, Math.max(first, 1)],
        range: [0, innerWidth]
      }),
    [first, innerWidth]
  );

  const toneToColor = (tone: FunnelBarDatum["tone"] | undefined): string => {
    switch (tone) {
      case "positive":
        return palette.status.pass;
      case "warning":
        return palette.status.uncertain;
      default:
        return palette.series[0];
    }
  };

  const { focusedIndex, getTabIndex, onKeyDown } = useVizKeyboardNav({
    count: data.length,
    onActivate: (i) => onActivate?.(data[i], i)
  });

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      tabIndex={data.length > 0 ? 0 : -1}
      style={{ outline: "none" }}
    >
      <title id={titleId}>Enrollment funnel, {data.length} stages</title>
      <Group left={MARGIN.left} top={MARGIN.top}>
        {data.map((datum, index) => {
          const barWidth = xScale(datum.value);
          const y = index * (barHeight + BAR_GAP);
          const color = toneToColor(datum.tone);
          const isFocused = index === focusedIndex;
          const prevValue = index > 0 ? data[index - 1].value : null;
          const dropoff =
            prevValue !== null && prevValue > 0
              ? ((prevValue - datum.value) / prevValue) * 100
              : null;

          return (
            <Group key={datum.id}>
              {/* Stage label (left gutter) */}
              <text
                x={-12}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={12}
                fontFamily="var(--font-sans)"
                fontWeight={600}
                fill={palette.textStrong}
              >
                {index + 1}. {datum.label}
              </text>

              {/* Rail (faint background showing total span) */}
              <rect
                x={0}
                y={y}
                width={innerWidth}
                height={barHeight}
                fill={palette.grid}
                rx={4}
              />

              {/* Actual bar */}
              <rect
                className="viz-datum"
                x={0}
                y={y}
                width={Math.max(barWidth, 2)}
                height={barHeight}
                fill={color}
                fillOpacity={isFocused ? 1 : 0.82}
                rx={4}
                tabIndex={getTabIndex(index)}
                role="button"
                aria-label={`${datum.label}: ${datum.value}${
                  dropoff !== null ? `, dropped ${dropoff.toFixed(0)}% from previous stage` : ""
                }`}
                onClick={() => onActivate?.(datum, index)}
              />

              {/* Value label (right of bar) */}
              <text
                x={Math.max(barWidth + 8, 8)}
                y={y + barHeight / 2}
                dominantBaseline="middle"
                fontSize={12}
                fontFamily="var(--font-serif)"
                fontWeight={600}
                fill={palette.textStrong}
              >
                {datum.value}
              </text>

              {/* Drop-off annotation — sits in the gap above the bar */}
              {dropoff !== null && dropoff > 0 ? (
                <g>
                  <text
                    x={innerWidth - 4}
                    y={y - 4}
                    fontSize={10}
                    fontFamily="var(--font-sans)"
                    fill={palette.status.fail}
                    textAnchor="end"
                    aria-hidden="true"
                  >
                    ▼ {dropoff.toFixed(0)}%
                  </text>
                </g>
              ) : null}
            </Group>
          );
        })}
      </Group>
    </svg>
  );
}
