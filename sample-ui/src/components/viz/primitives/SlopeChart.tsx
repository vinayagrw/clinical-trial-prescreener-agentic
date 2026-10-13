/*
 * SlopeChart — one line per entity from "before" to "after".
 *
 * Used by features/cockpit/components/viz/OvernightDeltaSlope.tsx (V5) to
 * show what changed overnight in the queue. Each line is a case; the slope
 * direction is the coordinator's actual question: "is this getting worse
 * or better since I last looked?"
 *
 * Design notes:
 * - Y axis is the score or rank (higher = more urgent / better fit).
 * - Entities with meaningful direction get emphasized stroke; flat stays muted.
 * - Hover/focus a line to highlight + surface the label.
 * - No full axis drawn — just a "Before" / "After" header pair.
 */

import { useId, useMemo, useState } from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useVizPalette } from "../useVizPalette";

export interface SlopeDatum {
  id: string;
  label: string;
  before: number;
  after: number;
  reason?: string;
}

export interface SlopeChartProps {
  data: readonly SlopeDatum[];
  width: number;
  height: number;
  /** Optional domain override; otherwise computed from data. */
  domain?: [number, number];
  onActivate?: (datum: SlopeDatum, index: number) => void;
}

const MARGIN = { top: 32, right: 120, bottom: 24, left: 120 };

export function SlopeChart({
  data,
  width,
  height,
  domain,
  onActivate
}: SlopeChartProps) {
  const palette = useVizPalette();
  const titleId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 10);

  const yDomain = useMemo((): [number, number] => {
    if (domain) return domain;
    const values = data.flatMap((d) => [d.before, d.after]);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [data, domain]);

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: yDomain,
        range: [innerHeight, 0]
      }),
    [yDomain, innerHeight]
  );

  const leftX = 0;
  const rightX = innerWidth;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>Delta slope chart, {data.length} cases</title>

      {/* Column headers */}
      <Group left={MARGIN.left} top={16}>
        <text
          x={leftX}
          y={0}
          fontSize={11}
          fontFamily="var(--font-sans)"
          fontWeight={600}
          fill={palette.text}
        >
          Yesterday
        </text>
        <text
          x={rightX}
          y={0}
          fontSize={11}
          fontFamily="var(--font-sans)"
          fontWeight={600}
          fill={palette.text}
          textAnchor="end"
        >
          Today
        </text>
      </Group>

      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Dashed rails so the eye has a frame */}
        <line
          x1={leftX}
          y1={0}
          x2={leftX}
          y2={innerHeight}
          stroke={palette.axis}
          strokeWidth={0.75}
          strokeDasharray="2 3"
        />
        <line
          x1={rightX}
          y1={0}
          x2={rightX}
          y2={innerHeight}
          stroke={palette.axis}
          strokeWidth={0.75}
          strokeDasharray="2 3"
        />

        {data.map((datum, index) => {
          const y1 = yScale(datum.before);
          const y2 = yScale(datum.after);
          const delta = datum.after - datum.before;
          const direction =
            Math.abs(delta) < 0.5 ? "flat" : delta > 0 ? "up" : "down";
          const stroke =
            direction === "up"
              ? palette.status.pass
              : direction === "down"
              ? palette.status.fail
              : palette.status.manual;
          const opacity = hoverId === null || hoverId === datum.id ? 1 : 0.25;
          const strokeWidth = hoverId === datum.id ? 2.75 : 1.6;

          return (
            <Group key={datum.id}>
              <line
                x1={leftX}
                y1={y1}
                x2={rightX}
                y2={y2}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
                className="viz-datum"
                tabIndex={0}
                role="button"
                aria-label={`${datum.label}: ${datum.before} → ${datum.after}, trending ${direction}${datum.reason ? `. ${datum.reason}` : ""}`}
                onMouseEnter={() => setHoverId(datum.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(datum.id)}
                onBlur={() => setHoverId(null)}
                onClick={() => onActivate?.(datum, index)}
              />
              <circle
                cx={leftX}
                cy={y1}
                r={3}
                fill={stroke}
                opacity={opacity}
                pointerEvents="none"
              />
              <circle
                cx={rightX}
                cy={y2}
                r={3}
                fill={stroke}
                opacity={opacity}
                pointerEvents="none"
              />

              {/* Labels — left side for "before", right side for "after".
                  Only render labels when the line is focused or hover is empty,
                  so dense charts stay readable. */}
              {hoverId === null || hoverId === datum.id ? (
                <>
                  <text
                    x={leftX - 6}
                    y={y1}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={10}
                    fontFamily="var(--font-sans)"
                    fill={palette.text}
                    opacity={opacity}
                    pointerEvents="none"
                  >
                    {datum.before}
                  </text>
                  <text
                    x={rightX + 6}
                    y={y2}
                    dominantBaseline="middle"
                    fontSize={10}
                    fontFamily="var(--font-sans)"
                    fontWeight={hoverId === datum.id ? 600 : 400}
                    fill={hoverId === datum.id ? palette.textStrong : palette.text}
                    opacity={opacity}
                    pointerEvents="none"
                  >
                    {datum.after} · {datum.label}
                  </text>
                </>
              ) : null}
            </Group>
          );
        })}
      </Group>
    </svg>
  );
}
