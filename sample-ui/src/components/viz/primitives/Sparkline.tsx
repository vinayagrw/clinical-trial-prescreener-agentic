/*
 * Sparkline — inline time-series primitive for MetricCard and other small slots.
 *
 * Design constraints:
 * - Height is fixed (default 28px) so the viz fits next to numbers without forcing
 *   the surrounding card to grow.
 * - No axes, no grid — the baseline is the only chrome.
 * - Last datum gets a filled dot so the eye lands on "the current value".
 * - Delta arrow (up/down) is encoded as a second channel beyond color, per principle 7.
 * - Hover / focus scrubs the cursor and surfaces a sr-only announcement.
 *
 * Used by:
 * - src/components/MetricCard.tsx (V6 — trend slot on every metric)
 * - features/cockpit sparkline cells in QueueTableV2 (M3)
 */

import { useId, useMemo, useState } from "react";
import { curveMonotoneX } from "@visx/curve";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { extent } from "d3-array";
import { useVizPalette } from "../useVizPalette";

export interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  /** Series color token — defaults to viz-series-1 when omitted. */
  color?: string;
  /** Optional label for aria purposes. */
  label?: string;
  /** Shows the filled area under the line (default true). */
  showArea?: boolean;
  /** Click handler for the whole sparkline. */
  onClick?: () => void;
}

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 28;
const PADDING_Y = 4;

export function Sparkline({
  values,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  color,
  label,
  showArea = true,
  onClick
}: SparklineProps) {
  const palette = useVizPalette();
  const clipId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = values.length > 0 ? values : [0];
  const stroke = color ?? palette.series[0];

  const { xScale, yScale, first, last, delta, direction } = useMemo(() => {
    const [minY = 0, maxY = 1] = extent(series) as [number, number];
    const minBound = minY === maxY ? minY - 1 : minY;
    const maxBound = minY === maxY ? maxY + 1 : maxY;
    const xs = scaleLinear<number>({
      domain: [0, Math.max(series.length - 1, 1)],
      range: [0, width]
    });
    const ys = scaleLinear<number>({
      domain: [minBound, maxBound],
      range: [height - PADDING_Y, PADDING_Y]
    });
    const firstVal = series[0];
    const lastVal = series[series.length - 1];
    const d = lastVal - firstVal;
    const dir = d === 0 ? "flat" : d > 0 ? "up" : "down";
    return {
      xScale: xs,
      yScale: ys,
      first: firstVal,
      last: lastVal,
      delta: d,
      direction: dir as "up" | "down" | "flat"
    };
  }, [series, width, height]);

  const ariaLabel = label
    ? `${label}: trending ${direction}, latest ${last.toFixed(1)}`
    : `Trend ${direction}, latest ${last.toFixed(1)}`;

  const accentColor =
    direction === "down"
      ? palette.status.fail
      : direction === "up"
      ? palette.status.pass
      : palette.status.manual;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      onMouseLeave={() => setHoverIndex(null)}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", overflow: "visible" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <Group clipPath={`url(#${clipId})`}>
        {showArea ? (
          <AreaClosed<number>
            data={series as number[]}
            x={(_d, i) => xScale(i)}
            y={(d) => yScale(d)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={stroke}
            fillOpacity={0.16}
          />
        ) : null}
        <LinePath<number>
          data={series as number[]}
          x={(_d, i) => xScale(i)}
          y={(d) => yScale(d)}
          curve={curveMonotoneX}
          stroke={stroke}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* First and last markers */}
        <circle
          cx={xScale(0)}
          cy={yScale(first)}
          r={2}
          fill={stroke}
          fillOpacity={0.6}
        />
        <circle
          cx={xScale(series.length - 1)}
          cy={yScale(last)}
          r={3}
          fill={accentColor}
          stroke={palette.textStrong}
          strokeWidth={0.6}
        />
        {/* Hover cursor */}
        {hoverIndex !== null && series[hoverIndex] !== undefined ? (
          <line
            x1={xScale(hoverIndex)}
            x2={xScale(hoverIndex)}
            y1={PADDING_Y}
            y2={height - PADDING_Y}
            stroke={palette.axis}
            strokeWidth={0.75}
            strokeDasharray="2 2"
          />
        ) : null}
      </Group>
      {/* Invisible hit targets for hover — one per datum. */}
      <Group>
        {series.map((_, i) => (
          <rect
            key={i}
            x={xScale(i) - width / (series.length * 2)}
            y={0}
            width={width / series.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
      </Group>
      {/* Direction arrow, top-right */}
      <text
        x={width - 2}
        y={10}
        fontSize={10}
        fontFamily="var(--font-sans)"
        fill={accentColor}
        textAnchor="end"
        aria-hidden="true"
      >
        {direction === "up" ? "▲" : direction === "down" ? "▼" : "—"}
        {delta !== 0 ? ` ${delta > 0 ? "+" : ""}${delta.toFixed(0)}` : ""}
      </text>
    </svg>
  );
}
