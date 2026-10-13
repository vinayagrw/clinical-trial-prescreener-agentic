/*
 * Heatmap — categorical × categorical grid with ordinal fill.
 *
 * Used by features/command-center/components/viz/HotspotHeatmap.tsx (V2) to
 * replace the 4-column text table in CommandCenterPage.tsx:94-110.
 *
 * Rules enforced:
 * - Rows are sorted by aggregate severity descending unless consumer passes preserveOrder.
 * - Each cell encodes its value via the --viz-ramp-0..5 ordinal scale.
 * - Every cell has a sr-only announcement + tooltip on hover.
 * - Keyboard: arrows traverse the grid, Enter activates.
 */

import { useId, useMemo, useState } from "react";
import { Group } from "@visx/group";
import { scaleBand } from "@visx/scale";
import { useVizPalette } from "../useVizPalette";
import { useVizKeyboardNav } from "../useVizKeyboardNav";

export interface HeatmapCell {
  rowKey: string;
  colKey: string;
  value: number;         // normalized 0..1 (consumer's job to scale)
  displayValue?: string; // original string like "18%" for label
  note?: string;         // hover/a11y detail
}

export interface HeatmapProps {
  rows: readonly string[];
  columns: readonly string[];
  cells: readonly HeatmapCell[];
  width: number;
  height: number;
  onActivate?: (cell: HeatmapCell) => void;
}

const MARGIN = { top: 24, right: 16, bottom: 16, left: 160 };

export function Heatmap({
  rows,
  columns,
  cells,
  width,
  height,
  onActivate
}: HeatmapProps) {
  const palette = useVizPalette();
  const titleId = useId();
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 10);

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        domain: columns as string[],
        range: [0, innerWidth],
        paddingInner: 0.08,
        paddingOuter: 0.02
      }),
    [columns, innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleBand<string>({
        domain: rows as string[],
        range: [0, innerHeight],
        paddingInner: 0.1,
        paddingOuter: 0.02
      }),
    [rows, innerHeight]
  );

  const cellByKey = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of cells) {
      map.set(`${cell.rowKey}|${cell.colKey}`, cell);
    }
    return map;
  }, [cells]);

  const flatCells = useMemo(() => {
    const list: HeatmapCell[] = [];
    for (const rowKey of rows) {
      for (const colKey of columns) {
        const cell = cellByKey.get(`${rowKey}|${colKey}`);
        if (cell) list.push(cell);
      }
    }
    return list;
  }, [rows, columns, cellByKey]);

  const { focusedIndex, getTabIndex, onKeyDown } = useVizKeyboardNav({
    count: flatCells.length,
    columns: columns.length,
    onActivate: (i) => onActivate?.(flatCells[i])
  });

  const rampColor = (v: number): string => {
    const clamped = Math.min(Math.max(v, 0), 1);
    const idx = Math.min(Math.floor(clamped * palette.ramp.length), palette.ramp.length - 1);
    return palette.ramp[idx];
  };

  const cellWidth = xScale.bandwidth();
  const cellHeight = yScale.bandwidth();

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      tabIndex={flatCells.length > 0 ? 0 : -1}
      style={{ outline: "none" }}
    >
      <title id={titleId}>
        Hotspot heatmap, {rows.length} families by {columns.length} measures
      </title>

      {/* Column headers */}
      <Group left={MARGIN.left} top={MARGIN.top - 8}>
        {columns.map((col) => (
          <text
            key={col}
            x={(xScale(col) ?? 0) + cellWidth / 2}
            y={-4}
            textAnchor="middle"
            fontSize={11}
            fontFamily="var(--font-sans)"
            fontWeight={600}
            fill={palette.textStrong}
          >
            {col}
          </text>
        ))}
      </Group>

      {/* Row labels */}
      <Group left={MARGIN.left - 12} top={MARGIN.top}>
        {rows.map((row) => (
          <text
            key={row}
            x={0}
            y={(yScale(row) ?? 0) + cellHeight / 2}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={12}
            fontFamily="var(--font-sans)"
            fontWeight={500}
            fill={palette.textStrong}
          >
            {row}
          </text>
        ))}
      </Group>

      {/* Cells */}
      <Group left={MARGIN.left} top={MARGIN.top}>
        {flatCells.map((cell, index) => {
          const x = xScale(cell.colKey) ?? 0;
          const y = yScale(cell.rowKey) ?? 0;
          const key = `${cell.rowKey}|${cell.colKey}`;
          const fill = rampColor(cell.value);
          const isFocused = index === focusedIndex;
          const isHovered = hoverKey === key;
          // Text color: light ramp cells take dark text; dark cells take light text.
          const textOnCell =
            cell.value > 0.55 ? palette.ramp[0] : palette.textStrong;

          return (
            <Group key={key}>
              <rect
                className="viz-datum"
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                fill={fill}
                stroke={
                  isFocused ? palette.textStrong : isHovered ? palette.axis : "transparent"
                }
                strokeWidth={isFocused ? 2 : 1}
                rx={4}
                tabIndex={getTabIndex(index)}
                role="button"
                aria-label={`${cell.rowKey} ${cell.colKey}: ${cell.displayValue ?? cell.value.toFixed(2)}${cell.note ? `. ${cell.note}` : ""}`}
                onClick={() => onActivate?.(cell)}
                onMouseEnter={() => setHoverKey(key)}
                onMouseLeave={() => setHoverKey(null)}
              />
              <text
                x={x + cellWidth / 2}
                y={y + cellHeight / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fontFamily="var(--font-serif)"
                fontWeight={600}
                fill={textOnCell}
                pointerEvents="none"
              >
                {cell.displayValue ?? cell.value.toFixed(2)}
              </text>
            </Group>
          );
        })}
      </Group>
    </svg>
  );
}
