/*
 * TemporalStrip — horizontal date-axis density strip with event markers.
 *
 * Used by features/review/components/viz/PatientTemporalBar.tsx (V4) to
 * replace the CSS-positioned WashoutTimeline in ReviewWorkbenchPage. The
 * previous visual rendered events and exclusion windows as absolutely-
 * positioned HTML blocks — readable, but with no scale grid, no keyboard
 * traversal, and overlapping labels when events clustered.
 *
 * Rules (from section 16.2 "challenge the defaults"):
 * - Events render as shape-coded markers on a true time scale (d3-scale-time
 *   via visx). Tone drives color AND glyph shape so color is never the sole
 *   channel (WCAG 1.4.1 — principle 7).
 * - Exclusion / lookback windows render as translucent bracket bands beneath
 *   the event lane. Bands use the same time scale, so a window and an event
 *   are always spatially consistent.
 * - The anchor ("screening run" = now or lastEvaluatedAt) renders as a
 *   dashed vertical rule across the full strip, labelled at the top edge.
 * - Axis shows at most 5 tick labels — enough to orient, not so many the
 *   strip becomes a ruler (principle 1: rank via position, not density).
 * - Keyboard nav: events are in the tab sequence via useVizKeyboardNav;
 *   arrow keys move focus, Enter activates.
 * - The aria-label of each marker reads the full event (date, title, detail,
 *   tone) — screen-reader users hear the same story as sighted users.
 */

import { useId, useMemo, useState } from "react";
import { Group } from "@visx/group";
import { scaleTime } from "@visx/scale";
import { useVizPalette } from "../useVizPalette";
import { useVizKeyboardNav } from "../useVizKeyboardNav";

export type TemporalTone = "neutral" | "positive" | "warning" | "critical";
export type TemporalWindowTone = "teal" | "amber" | "brick";

export interface TemporalEvent {
  id: string;
  /** Parseable date string (any format accepted by Date.parse). */
  date: string;
  title: string;
  detail: string;
  tone: TemporalTone;
}

export interface TemporalWindow {
  id: string;
  label: string;
  startTs: number;
  endTs: number;
  tone: TemporalWindowTone;
  detail?: string;
}

export interface TemporalStripProps {
  events: readonly TemporalEvent[];
  windows?: readonly TemporalWindow[];
  /** Anchor timestamp (ms) — e.g. lastEvaluatedAt or Date.now() for "screening run". */
  anchorTs?: number;
  anchorLabel?: string;
  width: number;
  height: number;
  /** Emphasized event id (from parent selection). */
  selectedId?: string;
  onActivate?: (event: TemporalEvent, index: number) => void;
  onHover?: (event: TemporalEvent | null) => void;
}

const MARGIN = { top: 36, right: 24, bottom: 36, left: 24 };
const WINDOW_BAND_HEIGHT = 22;
const EVENT_LANE_PADDING = 28;

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

const TICK_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});

function toneColor(
  tone: TemporalTone,
  palette: ReturnType<typeof useVizPalette>
): string {
  switch (tone) {
    case "positive":
      return palette.status.pass;
    case "warning":
      return palette.status.uncertain;
    case "critical":
      return palette.status.fail;
    case "neutral":
    default:
      return palette.status.manual;
  }
}

function windowColor(
  tone: TemporalWindowTone,
  palette: ReturnType<typeof useVizPalette>
): string {
  switch (tone) {
    case "teal":
      return palette.status.pass;
    case "amber":
      return palette.status.uncertain;
    case "brick":
    default:
      return palette.status.fail;
  }
}

function chooseTicks(domain: [number, number], count: number): number[] {
  if (count <= 1) return [domain[0], domain[1]];
  const [min, max] = domain;
  const step = (max - min) / (count - 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    ticks.push(min + step * i);
  }
  return ticks;
}

/**
 * Renders a marker glyph whose *shape* encodes tone as a second channel.
 * critical → diamond, warning → triangle, positive → circle, neutral → square.
 */
function markerPath(tone: TemporalTone, radius: number): string {
  switch (tone) {
    case "critical": {
      // Diamond
      return `M0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`;
    }
    case "warning": {
      // Up triangle
      const h = radius * 1.2;
      return `M0 ${-h} L ${radius} ${radius * 0.7} L ${-radius} ${radius * 0.7} Z`;
    }
    case "positive": {
      // Circle — expressed as a path so we can swap via <path d=...>
      const r = radius;
      return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;
    }
    case "neutral":
    default: {
      // Square
      return `M ${-radius} ${-radius} L ${radius} ${-radius} L ${radius} ${radius} L ${-radius} ${radius} Z`;
    }
  }
}

export function TemporalStrip({
  events,
  windows = [],
  anchorTs,
  anchorLabel,
  width,
  height,
  selectedId,
  onActivate,
  onHover
}: TemporalStripProps) {
  const palette = useVizPalette();
  const titleId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 10);

  // Sort events chronologically so keyboard nav is time-ordered.
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => Date.parse(a.date) - Date.parse(b.date)
      ),
    [events]
  );

  const domain = useMemo((): [number, number] => {
    const eventTs = sortedEvents
      .map((e) => Date.parse(e.date))
      .filter((v) => Number.isFinite(v));
    const windowTs = windows.flatMap((w) => [w.startTs, w.endTs]);
    const anchor = typeof anchorTs === "number" && Number.isFinite(anchorTs)
      ? [anchorTs]
      : [];
    const all = [...eventTs, ...windowTs, ...anchor];
    if (all.length === 0) {
      const now = Date.now();
      return [now - 30 * 24 * 60 * 60 * 1000, now];
    }
    let min = Math.min(...all);
    let max = Math.max(...all);
    if (min === max) {
      min = min - 7 * 24 * 60 * 60 * 1000;
      max = max + 7 * 24 * 60 * 60 * 1000;
    }
    // 4% padding on each side so endpoints aren't flush with the axis line.
    const pad = (max - min) * 0.04;
    return [min - pad, max + pad];
  }, [sortedEvents, windows, anchorTs]);

  const xScale = useMemo(
    () =>
      scaleTime<number>({
        domain: domain.map((d) => new Date(d)) as [Date, Date],
        range: [0, innerWidth]
      }),
    [domain, innerWidth]
  );

  const { focusedIndex, getTabIndex, onKeyDown } = useVizKeyboardNav({
    count: sortedEvents.length,
    onActivate: (i) => onActivate?.(sortedEvents[i], i)
  });

  const ticks = useMemo(() => chooseTicks(domain, 5), [domain]);

  // Vertical layout:
  //   axisY = innerHeight (bottom line)
  //   eventLaneY = innerHeight - EVENT_LANE_PADDING
  //   windowBandY = eventLaneY - (WINDOW_BAND_HEIGHT + 12)
  const axisY = innerHeight;
  const eventLaneY = Math.max(innerHeight - EVENT_LANE_PADDING, 12);
  const windowBandY = Math.max(eventLaneY - (WINDOW_BAND_HEIGHT + 14), 4);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      tabIndex={sortedEvents.length > 0 ? 0 : -1}
      style={{ outline: "none" }}
    >
      <title id={titleId}>
        Patient temporal bar, {sortedEvents.length} events
        {windows.length > 0 ? ` with ${windows.length} exclusion window${windows.length === 1 ? "" : "s"}` : ""}
      </title>

      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Exclusion / lookback window bands — drawn first so events float on top */}
        {windows.map((w, wi) => {
          const x1 = xScale(new Date(w.startTs));
          const x2 = xScale(new Date(w.endTs));
          if (x1 === undefined || x2 === undefined) return null;
          const left = Math.min(x1, x2);
          const width = Math.max(Math.abs(x2 - x1), 2);
          const color = windowColor(w.tone, palette);

          return (
            <Group key={w.id} top={windowBandY + wi * (WINDOW_BAND_HEIGHT + 6)}>
              {/* Band body */}
              <rect
                x={left}
                y={0}
                width={width}
                height={WINDOW_BAND_HEIGHT}
                fill={color}
                fillOpacity={0.16}
                stroke={color}
                strokeOpacity={0.55}
                strokeWidth={1}
                rx={3}
                ry={3}
              />
              {/* Left + right brackets so the window reads as "range", not as "fill" */}
              <line
                x1={left}
                x2={left}
                y1={-3}
                y2={WINDOW_BAND_HEIGHT + 3}
                stroke={color}
                strokeWidth={1.5}
              />
              <line
                x1={left + width}
                x2={left + width}
                y1={-3}
                y2={WINDOW_BAND_HEIGHT + 3}
                stroke={color}
                strokeWidth={1.5}
              />
              {/* Label inside the band if there's room, else above */}
              {width > 80 ? (
                <text
                  x={left + 6}
                  y={WINDOW_BAND_HEIGHT / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-sans)"
                  fontWeight={600}
                  fill={palette.textStrong}
                >
                  {w.label}
                </text>
              ) : (
                <text
                  x={left + width / 2}
                  y={-4}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="var(--font-sans)"
                  fontWeight={600}
                  fill={palette.textStrong}
                >
                  {w.label}
                </text>
              )}
            </Group>
          );
        })}

        {/* Horizontal event lane rule */}
        <line
          x1={0}
          x2={innerWidth}
          y1={eventLaneY}
          y2={eventLaneY}
          stroke={palette.grid}
          strokeWidth={1}
        />

        {/* Axis line at the bottom */}
        <line
          x1={0}
          x2={innerWidth}
          y1={axisY}
          y2={axisY}
          stroke={palette.axis}
          strokeWidth={1}
        />

        {/* Axis ticks */}
        {ticks.map((t, ti) => {
          const tx = xScale(new Date(t));
          if (tx === undefined) return null;
          return (
            <Group key={`tick-${ti}`}>
              <line
                x1={tx}
                x2={tx}
                y1={axisY}
                y2={axisY + 4}
                stroke={palette.axis}
                strokeWidth={1}
              />
              <text
                x={tx}
                y={axisY + 16}
                textAnchor="middle"
                fontSize={10}
                fontFamily="var(--font-sans)"
                fill={palette.text}
              >
                {TICK_FORMATTER.format(new Date(t))}
              </text>
            </Group>
          );
        })}

        {/* Anchor rule */}
        {typeof anchorTs === "number" && Number.isFinite(anchorTs) ? (
          (() => {
            const ax = xScale(new Date(anchorTs));
            if (ax === undefined) return null;
            return (
              <Group>
                <line
                  x1={ax}
                  x2={ax}
                  y1={-10}
                  y2={axisY}
                  stroke={palette.textStrong}
                  strokeWidth={1.25}
                  strokeDasharray="4 3"
                  opacity={0.75}
                />
                <text
                  x={ax}
                  y={-16}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="var(--font-sans)"
                  fontWeight={700}
                  fill={palette.textStrong}
                >
                  {anchorLabel ?? "Screening anchor"}
                </text>
              </Group>
            );
          })()
        ) : null}

        {/* Event markers — shape + color encode tone */}
        {sortedEvents.map((event, i) => {
          const ex = xScale(new Date(Date.parse(event.date)));
          if (ex === undefined) return null;

          const isSelected = event.id === selectedId;
          const isHovered = event.id === hoverId;
          const isFocused = i === focusedIndex;
          const emphasized =
            isSelected || isHovered || (!selectedId && isFocused);
          const radius = emphasized ? 8 : 6;
          const color = toneColor(event.tone, palette);
          const path = markerPath(event.tone, radius);

          const isoDate = (() => {
            const ts = Date.parse(event.date);
            return Number.isFinite(ts) ? new Date(ts).toISOString() : event.date;
          })();
          const prettyDate = (() => {
            const ts = Date.parse(event.date);
            return Number.isFinite(ts)
              ? MONTH_FORMATTER.format(new Date(ts))
              : event.date;
          })();

          return (
            <Group key={event.id} left={ex} top={eventLaneY}>
              {/* Stem from axis up to marker */}
              <line
                x1={0}
                x2={0}
                y1={0}
                y2={axisY - eventLaneY}
                stroke={palette.grid}
                strokeWidth={1}
                pointerEvents="none"
              />
              {/* Highlight ring for emphasized marker */}
              {emphasized ? (
                <circle
                  cx={0}
                  cy={0}
                  r={radius + 4}
                  fill="none"
                  stroke={palette.textStrong}
                  strokeWidth={1.25}
                  opacity={0.55}
                />
              ) : null}
              {/* Interactive marker */}
              <path
                className="viz-datum"
                d={path}
                fill={color}
                stroke={palette.textStrong}
                strokeWidth={emphasized ? 1.25 : 0.75}
                tabIndex={getTabIndex(i)}
                role="button"
                aria-label={`${prettyDate}: ${event.title}. ${event.detail} (${event.tone})`}
                data-event-id={event.id}
                data-iso-date={isoDate}
                onClick={() => onActivate?.(event, i)}
                onMouseEnter={() => {
                  setHoverId(event.id);
                  onHover?.(event);
                }}
                onMouseLeave={() => {
                  setHoverId(null);
                  onHover?.(null);
                }}
                style={{ cursor: "pointer" }}
              />
              {/* Label above emphasized markers only — dense lanes stay readable */}
              {emphasized ? (
                <g pointerEvents="none">
                  <text
                    x={0}
                    y={-radius - 10}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily="var(--font-sans)"
                    fontWeight={700}
                    fill={palette.textStrong}
                  >
                    {event.title}
                  </text>
                  <text
                    x={0}
                    y={-radius - 22}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="var(--font-sans)"
                    fill={palette.text}
                  >
                    {prettyDate}
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
