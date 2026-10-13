/*
 * ParallelCoordinates — N-dimensional comparison via one polyline per entity.
 *
 * Used by features/command-center/components/viz/TrialPortfolioParallel.tsx (V8)
 * to replace the 4-MetricCard quartet in src/pages/CommandCenterPage.tsx that
 * forced the ops lead to chip-toggle through trials one at a time. With parallel
 * coordinates, every trial's screened / escalations / outreach / enrolled
 * appear simultaneously and the eye sees which trial is an outlier on which axis.
 *
 * Rules (from section 16.2 "challenge the defaults"):
 * - Radar charts were rejected because overlapping polygons are unreadable.
 *   Parallel coordinates render as non-overlapping polylines on vertical axes,
 *   which the eye scans axis-by-axis.
 * - Each axis is normalized per-dimension so small and large metrics coexist.
 *   The underlying raw value is still announced in the aria-label.
 * - Colors come from palette.series[0..6]. We never rely on color alone; the
 *   hovered/focused/selected line gets bumped stroke-width + brought to front
 *   + labeled with its shortCode so shape redundancy is preserved.
 * - Axis ticks: three per axis (min, mid, max) — enough to orient, not so many
 *   the chart becomes a grid.
 */

import { useId, useMemo, useState } from "react";
import { Group } from "@visx/group";
import { scaleLinear, scalePoint } from "@visx/scale";
import { useVizPalette } from "../useVizPalette";
import { useVizKeyboardNav } from "../useVizKeyboardNav";

export interface ParallelDimension {
  key: string;
  label: string;
  /** Optional domain override [min, max]. When omitted, computed from data. */
  domain?: [number, number];
  /** Optional value formatter for tick labels + aria-label. */
  format?: (value: number) => string;
}

export interface ParallelRecord {
  id: string;
  label: string;
  values: Record<string, number>;
  /** Optional secondary line used for axis labels (e.g. "• LU-021"). */
  sublabel?: string;
}

export interface ParallelCoordinatesProps {
  dimensions: readonly ParallelDimension[];
  records: readonly ParallelRecord[];
  width: number;
  height: number;
  /** Controlled selected record id; drives highlight. */
  selectedId?: string;
  onActivate?: (record: ParallelRecord, index: number) => void;
  onHover?: (record: ParallelRecord | null) => void;
}

const MARGIN = { top: 30, right: 40, bottom: 36, left: 40 };
const DEFAULT_FORMAT = (v: number) => String(Math.round(v));

export function ParallelCoordinates({
  dimensions,
  records,
  width,
  height,
  selectedId,
  onActivate,
  onHover
}: ParallelCoordinatesProps) {
  const palette = useVizPalette();
  const titleId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 10);

  // Horizontal placement of each dimension's axis.
  const xScale = useMemo(
    () =>
      scalePoint<string>({
        domain: dimensions.map((d) => d.key),
        range: [0, innerWidth],
        padding: 0.2
      }),
    [dimensions, innerWidth]
  );

  // Per-dimension vertical scale normalized to that dimension's domain.
  const yScales = useMemo(() => {
    const map = new Map<string, ReturnType<typeof scaleLinear<number>>>();
    for (const dim of dimensions) {
      let domain: [number, number];
      if (dim.domain) {
        domain = dim.domain;
      } else {
        let min = Infinity;
        let max = -Infinity;
        for (const record of records) {
          const value = record.values[dim.key];
          if (typeof value === "number" && Number.isFinite(value)) {
            if (value < min) min = value;
            if (value > max) max = value;
          }
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
          min = 0;
          max = 1;
        }
        if (min === max) {
          // Flat series — give it headroom so the line sits mid-axis instead of
          // collapsing against a boundary.
          const pad = Math.max(Math.abs(max), 1);
          min = min - pad;
          max = max + pad;
        }
        domain = [min, max];
      }
      map.set(
        dim.key,
        scaleLinear<number>({
          // Higher values render toward the top.
          domain,
          range: [innerHeight, 0],
          nice: true
        })
      );
    }
    return map;
  }, [dimensions, records, innerHeight]);

  const { focusedIndex, getTabIndex, onKeyDown } = useVizKeyboardNav({
    count: records.length,
    onActivate: (i) => onActivate?.(records[i], i)
  });

  // Build polyline path strings per record.
  const recordPaths = useMemo(() => {
    return records.map((record) => {
      const points = dimensions
        .map((dim) => {
          const x = xScale(dim.key);
          const raw = record.values[dim.key];
          const y = yScales.get(dim.key)?.(raw ?? 0);
          if (x === undefined || y === undefined) return null;
          return [x, y] as [number, number];
        })
        .filter((pt): pt is [number, number] => pt !== null);
      if (points.length === 0) return "";
      return points
        .map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
    });
  }, [records, dimensions, xScale, yScales]);

  // Sort indices so the selected / hovered / focused line draws on top.
  const drawOrder = useMemo(() => {
    const idx = records.map((_, i) => i);
    return idx.sort((a, b) => {
      const prio = (i: number) => {
        const r = records[i];
        if (r.id === selectedId) return 3;
        if (r.id === hoverId) return 2;
        if (i === focusedIndex) return 1;
        return 0;
      };
      return prio(a) - prio(b);
    });
  }, [records, selectedId, hoverId, focusedIndex]);

  const seriesColor = (index: number): string =>
    palette.series[index % palette.series.length];

  const formatForDim = (dim: ParallelDimension) => dim.format ?? DEFAULT_FORMAT;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      tabIndex={records.length > 0 ? 0 : -1}
      style={{ outline: "none" }}
    >
      <title id={titleId}>
        Trial portfolio parallel coordinates, {records.length} trials across {dimensions.length} metrics
      </title>

      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Axes — one vertical line per dimension, with 3 tick labels */}
        {dimensions.map((dim) => {
          const x = xScale(dim.key) ?? 0;
          const scale = yScales.get(dim.key);
          if (!scale) return null;
          const [domainMin, domainMax] = scale.domain() as [number, number];
          const mid = (domainMin + domainMax) / 2;
          const ticks = [domainMax, mid, domainMin];
          const fmt = formatForDim(dim);

          return (
            <Group key={dim.key}>
              {/* Axis line */}
              <line
                x1={x}
                x2={x}
                y1={0}
                y2={innerHeight}
                stroke={palette.axis}
                strokeWidth={1}
              />

              {/* Axis label */}
              <text
                x={x}
                y={-14}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-sans)"
                fontWeight={600}
                fill={palette.textStrong}
              >
                {dim.label}
              </text>

              {/* Tick marks + labels */}
              {ticks.map((tickValue, ti) => {
                const ty = scale(tickValue);
                if (ty === undefined) return null;
                return (
                  <Group key={`${dim.key}-tick-${ti}`}>
                    <line
                      x1={x - 4}
                      x2={x + 4}
                      y1={ty}
                      y2={ty}
                      stroke={palette.axis}
                      strokeWidth={1}
                    />
                    <text
                      x={x + 8}
                      y={ty}
                      dominantBaseline="middle"
                      fontSize={10}
                      fontFamily="var(--font-sans)"
                      fill={palette.text}
                    >
                      {fmt(tickValue)}
                    </text>
                  </Group>
                );
              })}
            </Group>
          );
        })}

        {/* Polylines in sorted draw order */}
        {drawOrder.map((i) => {
          const record = records[i];
          const d = recordPaths[i];
          if (!d) return null;

          const isSelected = record.id === selectedId;
          const isHovered = record.id === hoverId;
          const isFocused = i === focusedIndex;
          // Keyboard-focus emphasis only applies when there's no explicit
          // selection. Otherwise the selected record carries the emphasis
          // alone, preventing two lines from looking "thick" at the same time.
          const emphasized =
            isSelected || isHovered || (!selectedId && isFocused);

          const strokeWidth = emphasized ? 3 : 1.6;
          const strokeOpacity = emphasized
            ? 1
            : hoverId || selectedId
              ? 0.25
              : 0.75;
          const color = seriesColor(i);

          return (
            <Group key={record.id}>
              <path
                className="viz-datum"
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                tabIndex={getTabIndex(i)}
                role="button"
                aria-label={`${record.label}: ${dimensions
                  .map((dim) => `${dim.label} ${formatForDim(dim)(record.values[dim.key] ?? 0)}`)
                  .join(", ")}${record.sublabel ? `. ${record.sublabel}` : ""}`}
                onClick={() => onActivate?.(record, i)}
                onMouseEnter={() => {
                  setHoverId(record.id);
                  onHover?.(record);
                }}
                onMouseLeave={() => {
                  setHoverId(null);
                  onHover?.(null);
                }}
                style={{ cursor: "pointer" }}
              />

              {/* Endpoint dots for emphasized lines, so the eye picks them out */}
              {emphasized
                ? dimensions.map((dim) => {
                    const cx = xScale(dim.key);
                    const cy = yScales.get(dim.key)?.(record.values[dim.key] ?? 0);
                    if (cx === undefined || cy === undefined) return null;
                    return (
                      <circle
                        key={`${record.id}-${dim.key}-dot`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={color}
                        stroke={palette.textStrong}
                        strokeWidth={0.75}
                        pointerEvents="none"
                      />
                    );
                  })
                : null}
            </Group>
          );
        })}

        {/* Label for the emphasized record — anchored to the first dimension */}
        {(() => {
          const activeId = selectedId ?? hoverId ?? records[focusedIndex]?.id;
          if (!activeId) return null;
          const index = records.findIndex((r) => r.id === activeId);
          if (index === -1) return null;
          const firstDim = dimensions[0];
          const x = xScale(firstDim.key) ?? 0;
          const y = yScales.get(firstDim.key)?.(records[index].values[firstDim.key] ?? 0);
          if (y === undefined) return null;
          const record = records[index];
          return (
            <g pointerEvents="none">
              <text
                x={x - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="var(--font-sans)"
                fontWeight={700}
                fill={palette.textStrong}
              >
                {record.label}
              </text>
            </g>
          );
        })()}
      </Group>
    </svg>
  );
}
