/*
 * SwimLane — multi-lane time axis. Each lane is a categorical row (actor,
 * system, role), each event is a marker at (time, lane) with optional arcs
 * connecting linked events.
 *
 * Used by features/audit/components/viz/AuditSwimlane.tsx (V7) to replace
 * the flat AuditPanel list in src/pages/AuditPage.tsx. The previous panel
 * rendered the decision trail as a vertical text stack — readable, but it
 * hid the *handoff* pattern (screening.job → criterion.engine → coordinator),
 * which is the auditor's actual question when replaying a case.
 *
 * Rules:
 * - Lanes are sorted by first-event time (earliest actor at top).
 * - Events encode tone via BOTH color AND shape (circle/triangle/diamond/
 *   square) so color is never the sole channel (principle 7).
 * - Arcs render below the lane rule, as shallow quadratic curves, so linked
 *   events read as a chain without clobbering the markers themselves.
 * - Keyboard nav: events are in tab order sorted chronologically. Arrow
 *   keys move through the time sequence regardless of lane.
 * - Every marker's aria-label fully describes the event (time, actor, type,
 *   summary, tone). Screen-reader users hear the handoff story directly.
 */

import { useId, useMemo, useState } from "react";
import { Group } from "@visx/group";
import { scalePoint, scaleTime } from "@visx/scale";
import { useVizPalette } from "../useVizPalette";
import { useVizKeyboardNav } from "../useVizKeyboardNav";
import { ArcDiagram, type ArcAnchorMap, type ArcEdge } from "./ArcDiagram";

export type SwimLaneTone = "info" | "pass" | "uncertain" | "fail" | "manual";

export interface SwimLaneEvent {
  id: string;
  /** Parseable timestamp string (Date.parse compatible). */
  timestamp: string;
  lane: string;
  eventType: string;
  summary: string;
  tone: SwimLaneTone;
}

export interface SwimLaneProps {
  events: readonly SwimLaneEvent[];
  /** Optional explicit lane ordering. If omitted, lanes are ordered by earliest event. */
  lanes?: readonly string[];
  /** Optional arcs connecting events by id. Drawn as shallow curves above lanes. */
  arcs?: readonly ArcEdge[];
  width: number;
  height: number;
  selectedId?: string;
  onActivate?: (event: SwimLaneEvent, index: number) => void;
  onHover?: (event: SwimLaneEvent | null) => void;
}

const MARGIN = { top: 36, right: 24, bottom: 32, left: 148 };

const TICK_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit"
});

function toneColor(
  tone: SwimLaneTone,
  palette: ReturnType<typeof useVizPalette>
): string {
  switch (tone) {
    case "pass":
      return palette.status.pass;
    case "fail":
      return palette.status.fail;
    case "uncertain":
      return palette.status.uncertain;
    case "manual":
      return palette.status.manual;
    case "info":
    default:
      return palette.series[4] ?? palette.text;
  }
}

/**
 * Shape-coded glyph. info = circle, pass = square-ish (check), uncertain =
 * triangle, fail = diamond, manual = stadium bar. Renders as an SVG path
 * centered at (0,0) so the caller can place it via a translate().
 */
function markerPath(tone: SwimLaneTone, radius: number): string {
  switch (tone) {
    case "fail": {
      // Diamond
      const r = radius;
      return `M0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`;
    }
    case "uncertain": {
      // Up triangle
      const r = radius;
      const h = r * 1.2;
      return `M0 ${-h} L ${r} ${r * 0.7} L ${-r} ${r * 0.7} Z`;
    }
    case "pass": {
      // Square — reads as a "completed step" checkbox
      const r = radius;
      return `M ${-r} ${-r} L ${r} ${-r} L ${r} ${r} L ${-r} ${r} Z`;
    }
    case "manual": {
      // Rounded bar (stadium) — reads as "human-touched"
      const r = radius;
      const w = r * 1.6;
      return `M ${-w} ${-r} L ${w} ${-r} A ${r} ${r} 0 0 1 ${w} ${r} L ${-w} ${r} A ${r} ${r} 0 0 1 ${-w} ${-r} Z`;
    }
    case "info":
    default: {
      // Circle
      const r = radius;
      return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;
    }
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

export function SwimLane({
  events,
  lanes: lanesProp,
  arcs = [],
  width,
  height,
  selectedId,
  onActivate,
  onHover
}: SwimLaneProps) {
  const palette = useVizPalette();
  const titleId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 10);

  // Sort events chronologically so keyboard nav walks the time axis.
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
      ),
    [events]
  );

  // Derive lane order: explicit prop wins, otherwise sort by earliest event.
  const lanes = useMemo<string[]>(() => {
    if (lanesProp && lanesProp.length > 0) return [...lanesProp];
    const firstSeen = new Map<string, number>();
    for (const event of sortedEvents) {
      if (!firstSeen.has(event.lane)) {
        firstSeen.set(event.lane, Date.parse(event.timestamp));
      }
    }
    return Array.from(firstSeen.keys()).sort(
      (a, b) => (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0)
    );
  }, [lanesProp, sortedEvents]);

  const domain = useMemo((): [number, number] => {
    const ts = sortedEvents
      .map((e) => Date.parse(e.timestamp))
      .filter((v) => Number.isFinite(v));
    if (ts.length === 0) {
      const now = Date.now();
      return [now - 60 * 1000, now];
    }
    let min = Math.min(...ts);
    let max = Math.max(...ts);
    if (min === max) {
      min = min - 30 * 1000;
      max = max + 30 * 1000;
    }
    const pad = (max - min) * 0.08;
    return [min - pad, max + pad];
  }, [sortedEvents]);

  const xScale = useMemo(
    () =>
      scaleTime<number>({
        domain: domain.map((d) => new Date(d)) as [Date, Date],
        range: [0, innerWidth]
      }),
    [domain, innerWidth]
  );

  const yScale = useMemo(
    () =>
      scalePoint<string>({
        domain: lanes,
        range: [16, Math.max(innerHeight - 8, 20)],
        padding: 0.4
      }),
    [lanes, innerHeight]
  );

  const { focusedIndex, getTabIndex, onKeyDown } = useVizKeyboardNav({
    count: sortedEvents.length,
    onActivate: (i) => onActivate?.(sortedEvents[i], i)
  });

  const ticks = useMemo(() => chooseTicks(domain, 5), [domain]);

  // Build a map of event id → (x,y) so ArcDiagram can draw arcs between them.
  const anchorMap = useMemo<ArcAnchorMap>(() => {
    const map: ArcAnchorMap = {};
    for (const event of sortedEvents) {
      const ts = Date.parse(event.timestamp);
      if (!Number.isFinite(ts)) continue;
      const x = xScale(new Date(ts));
      const y = yScale(event.lane);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      map[event.id] = { x: x as number, y: y as number };
    }
    return map;
  }, [sortedEvents, xScale, yScale]);

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
        Audit swimlane, {sortedEvents.length} events across {lanes.length} lanes
      </title>

      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Lane rules + labels */}
        {lanes.map((lane) => {
          const ly = yScale(lane);
          if (ly === undefined) return null;
          return (
            <Group key={lane}>
              <line
                x1={0}
                x2={innerWidth}
                y1={ly}
                y2={ly}
                stroke={palette.grid}
                strokeWidth={1}
              />
              <text
                x={-12}
                y={ly}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="var(--font-sans)"
                fontWeight={600}
                fill={palette.textStrong}
              >
                {lane}
              </text>
            </Group>
          );
        })}

        {/* Bottom axis */}
        <line
          x1={0}
          x2={innerWidth}
          y1={innerHeight}
          y2={innerHeight}
          stroke={palette.axis}
          strokeWidth={1}
        />
        {ticks.map((t, ti) => {
          const tx = xScale(new Date(t));
          if (tx === undefined) return null;
          return (
            <Group key={`tick-${ti}`}>
              <line
                x1={tx}
                x2={tx}
                y1={innerHeight}
                y2={innerHeight + 4}
                stroke={palette.axis}
                strokeWidth={1}
              />
              <text
                x={tx}
                y={innerHeight + 16}
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

        {/* Arcs underlay — drawn before markers so dots sit on top */}
        {arcs.length > 0 ? (
          <ArcDiagram anchors={anchorMap} edges={arcs} stroke={palette.axis} />
        ) : null}

        {/* Event markers */}
        {sortedEvents.map((event, i) => {
          const ts = Date.parse(event.timestamp);
          if (!Number.isFinite(ts)) return null;
          const ex = xScale(new Date(ts));
          const ey = yScale(event.lane);
          if (!Number.isFinite(ex) || !Number.isFinite(ey)) return null;

          const isSelected = event.id === selectedId;
          const isHovered = event.id === hoverId;
          const isFocused = i === focusedIndex;
          const emphasized =
            isSelected || isHovered || (!selectedId && isFocused);

          const radius = emphasized ? 8 : 6;
          const color = toneColor(event.tone, palette);
          const path = markerPath(event.tone, radius);

          const prettyTime = (() => {
            const ts = Date.parse(event.timestamp);
            return Number.isFinite(ts)
              ? TICK_FORMATTER.format(new Date(ts))
              : event.timestamp;
          })();

          return (
            <Group key={event.id} left={ex} top={ey}>
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
              <path
                className="viz-datum"
                d={path}
                fill={color}
                stroke={palette.textStrong}
                strokeWidth={emphasized ? 1.25 : 0.75}
                tabIndex={getTabIndex(i)}
                role="button"
                aria-label={`${prettyTime}, ${event.lane}, ${event.eventType}: ${event.summary} (${event.tone})`}
                data-event-id={event.id}
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
              {emphasized ? (
                <g pointerEvents="none">
                  <text
                    x={0}
                    y={-radius - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="var(--font-sans)"
                    fontWeight={700}
                    fill={palette.textStrong}
                  >
                    {prettyTime}
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
