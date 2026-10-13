/*
 * DotMatrix — categorical grid of status dots.
 *
 * Used by features/review/components/viz/CriterionDotMatrix.tsx (V3) to
 * replace the vertical CriterionRow stack in ReviewWorkbenchPage.
 *
 * Design:
 * - Rows = semantic buckets (Genomic / Cardiac / Hepatic ...), wrapped.
 * - Each dot encodes status via fill color AND shape redundancy (a thin ring
 *   when freshness is stale/missing; a cross-hatch for manual_review; outline
 *   for uncertain).
 * - Short code + full label appears on hover / keyboard focus.
 * - Enter activates the drill-down callback.
 */

import { useId, useMemo } from "react";
import { Group } from "@visx/group";
import { useVizPalette } from "../useVizPalette";
import { useVizKeyboardNav } from "../useVizKeyboardNav";

export type DotMatrixStatus = "pass" | "fail" | "uncertain" | "manual_review";
export type DotMatrixFreshness = "fresh" | "aging" | "stale" | "missing";

export interface DotMatrixDatum {
  id: string;
  bucket: string;
  label: string;
  shortCode?: string;
  status: DotMatrixStatus;
  freshness: DotMatrixFreshness;
  note?: string;
}

export interface DotMatrixProps {
  data: readonly DotMatrixDatum[];
  width: number;
  height: number;
  onActivate?: (datum: DotMatrixDatum, index: number) => void;
}

const MARGIN = { top: 20, right: 12, bottom: 12, left: 140 };
const DOT_SIZE = 24;
const DOT_GAP = 8;
const ROW_GAP = 12;

export function DotMatrix({
  data,
  width,
  height,
  onActivate
}: DotMatrixProps) {
  const palette = useVizPalette();
  const titleId = useId();

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const dotsPerRow = Math.max(Math.floor((innerWidth + DOT_GAP) / (DOT_SIZE + DOT_GAP)), 1);

  const { buckets, orderedData, heightNeeded } = useMemo(() => {
    const byBucket = new Map<string, DotMatrixDatum[]>();
    for (const d of data) {
      const list = byBucket.get(d.bucket) ?? [];
      list.push(d);
      byBucket.set(d.bucket, list);
    }
    const bucketList = Array.from(byBucket.entries());
    const flat: DotMatrixDatum[] = [];
    let totalRows = 0;
    for (const [, items] of bucketList) {
      flat.push(...items);
      totalRows += Math.ceil(items.length / dotsPerRow);
    }
    const heightCalc =
      MARGIN.top +
      MARGIN.bottom +
      bucketList.length * ROW_GAP +
      totalRows * (DOT_SIZE + DOT_GAP);
    return { buckets: bucketList, orderedData: flat, heightNeeded: heightCalc };
  }, [data, dotsPerRow]);

  const { focusedIndex, getTabIndex, onKeyDown } = useVizKeyboardNav({
    count: orderedData.length,
    columns: dotsPerRow,
    onActivate: (i) => onActivate?.(orderedData[i], i)
  });

  // Build per-item positioning.
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    let yCursor = 0;
    for (const [, items] of buckets) {
      for (let i = 0; i < items.length; i += 1) {
        const row = Math.floor(i / dotsPerRow);
        const col = i % dotsPerRow;
        map.set(items[i].id, {
          x: col * (DOT_SIZE + DOT_GAP),
          y: yCursor + row * (DOT_SIZE + DOT_GAP)
        });
      }
      const rowsInBucket = Math.ceil(items.length / dotsPerRow);
      yCursor += rowsInBucket * (DOT_SIZE + DOT_GAP) + ROW_GAP;
    }
    return map;
  }, [buckets, dotsPerRow]);

  const statusColor = (s: DotMatrixStatus): string => {
    switch (s) {
      case "pass":
        return palette.status.pass;
      case "fail":
        return palette.status.fail;
      case "uncertain":
        return palette.status.uncertain;
      case "manual_review":
        return palette.status.manual;
    }
  };

  const svgHeight = Math.max(height, heightNeeded);

  // Build bucket label Y coordinates for rendering after positions are known.
  const bucketLabels: Array<{ bucket: string; y: number }> = [];
  let yCursor = 0;
  for (const [bucket, items] of buckets) {
    bucketLabels.push({ bucket, y: yCursor });
    const rowsInBucket = Math.ceil(items.length / dotsPerRow);
    yCursor += rowsInBucket * (DOT_SIZE + DOT_GAP) + ROW_GAP;
  }

  return (
    <svg
      width={width}
      height={svgHeight}
      role="img"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      tabIndex={orderedData.length > 0 ? 0 : -1}
      style={{ outline: "none" }}
    >
      <title id={titleId}>
        Criterion review matrix, {orderedData.length} criteria across {buckets.length} buckets
      </title>

      {/* Bucket labels */}
      <Group left={MARGIN.left - 12} top={MARGIN.top}>
        {bucketLabels.map(({ bucket, y }) => (
          <text
            key={bucket}
            x={0}
            y={y + DOT_SIZE / 2}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={12}
            fontFamily="var(--font-sans)"
            fontWeight={600}
            fill={palette.textStrong}
          >
            {bucket}
          </text>
        ))}
      </Group>

      {/* Dots */}
      <Group left={MARGIN.left} top={MARGIN.top}>
        {orderedData.map((datum, index) => {
          const pos = positions.get(datum.id);
          if (!pos) return null;
          const color = statusColor(datum.status);
          const isFocused = index === focusedIndex;
          const isStale = datum.freshness === "stale" || datum.freshness === "missing";
          const isUncertain = datum.status === "uncertain";

          return (
            <Group key={datum.id} left={pos.x} top={pos.y}>
              {/* Stale freshness = dashed outer ring */}
              {isStale ? (
                <rect
                  x={-2}
                  y={-2}
                  width={DOT_SIZE + 4}
                  height={DOT_SIZE + 4}
                  rx={DOT_SIZE / 2 + 2}
                  fill="none"
                  stroke={palette.status.fail}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  pointerEvents="none"
                />
              ) : null}
              <rect
                className="viz-datum"
                x={0}
                y={0}
                width={DOT_SIZE}
                height={DOT_SIZE}
                rx={DOT_SIZE / 2}
                fill={isUncertain ? "transparent" : color}
                stroke={color}
                strokeWidth={isUncertain ? 2.5 : isFocused ? 2 : 1}
                tabIndex={getTabIndex(index)}
                role="button"
                aria-label={`${datum.bucket} — ${datum.label}, status ${datum.status}, freshness ${datum.freshness}${datum.note ? `. ${datum.note}` : ""}`}
                onClick={() => onActivate?.(datum, index)}
              />
              {/* Manual review = hatched center dot; pass = solid; fail = X */}
              {datum.status === "manual_review" ? (
                <g pointerEvents="none">
                  <line
                    x1={6}
                    y1={DOT_SIZE / 2}
                    x2={DOT_SIZE - 6}
                    y2={DOT_SIZE / 2}
                    stroke={palette.ramp[0]}
                    strokeWidth={2}
                  />
                </g>
              ) : datum.status === "fail" ? (
                <g pointerEvents="none">
                  <line
                    x1={7}
                    y1={7}
                    x2={DOT_SIZE - 7}
                    y2={DOT_SIZE - 7}
                    stroke={palette.ramp[0]}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <line
                    x1={DOT_SIZE - 7}
                    y1={7}
                    x2={7}
                    y2={DOT_SIZE - 7}
                    stroke={palette.ramp[0]}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </g>
              ) : datum.status === "pass" ? (
                <g pointerEvents="none">
                  <path
                    d={`M 6 ${DOT_SIZE / 2} L ${DOT_SIZE / 2 - 1} ${DOT_SIZE - 7} L ${DOT_SIZE - 6} 7`}
                    fill="none"
                    stroke={palette.ramp[0]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ) : null}
            </Group>
          );
        })}
      </Group>
    </svg>
  );
}
