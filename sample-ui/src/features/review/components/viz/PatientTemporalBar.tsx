/*
 * PatientTemporalBar (V4) — replaces the CSS-positioned WashoutTimeline in
 * src/pages/ReviewWorkbenchPage.tsx. The prior visual rendered events and
 * exclusion windows as absolutely-positioned HTML blocks — readable, but
 * with no true date scale, no keyboard traversal of events, and overlapping
 * labels when events clustered around the screening anchor.
 *
 * V4 renders through the shared TemporalStrip primitive so:
 *   - Events sit on a real time scale (scaleTime) with up to 5 tick labels.
 *   - Tone drives color AND glyph shape (critical = diamond, warning =
 *     triangle, positive = circle, neutral = square) — no color-only encoding.
 *   - Lookback / exclusion windows render beneath as bracketed bands on the
 *     same scale, so "event is inside a window" reads spatially.
 *   - The screening anchor is a dashed vertical rule labelled at the top.
 *   - Arrow keys traverse events; Enter fires the parent's onEventClick.
 */

import { useMemo } from "react";
import type { TimelineEvent } from "../../../../types";
import type { TimelineWindowModel } from "../../../../types/visual";
import { VizFrame } from "../../../../components/viz/VizFrame";
import {
  TemporalStrip,
  type TemporalEvent,
  type TemporalWindow
} from "../../../../components/viz/primitives/TemporalStrip";

interface PatientTemporalBarProps {
  events: readonly TimelineEvent[];
  windows: readonly TimelineWindowModel[];
  /** Anchor label ("lastEvaluatedAt" for the selected criterion, or a human string). */
  anchorLabel: string;
  /** Parseable anchor date; if absent, falls back to "now". */
  anchorDate?: string;
  selectedEventId?: string;
  onEventClick?: (eventId: string) => void;
  highlightTerms?: readonly string[];
}

interface FallbackRow extends Record<string, unknown> {
  date: string;
  title: string;
  detail: string;
  tone: string;
  windowLabel: string;
}

function parseAnchor(anchorDate?: string): number | undefined {
  if (!anchorDate) return Date.now();
  const ts = Date.parse(anchorDate);
  return Number.isFinite(ts) ? ts : Date.now();
}

export function PatientTemporalBar({
  events,
  windows,
  anchorLabel,
  anchorDate,
  selectedEventId,
  onEventClick,
  highlightTerms = []
}: PatientTemporalBarProps) {
  const anchorTs = useMemo(() => parseAnchor(anchorDate), [anchorDate]);

  const temporalEvents = useMemo<TemporalEvent[]>(
    () =>
      events.map((e) => ({
        id: e.id,
        date: e.date,
        title: e.title,
        detail: e.detail,
        tone: e.tone
      })),
    [events]
  );

  const temporalWindows = useMemo<TemporalWindow[]>(
    () =>
      windows.map((w) => ({
        id: w.id,
        label: w.label,
        startTs: w.startTs,
        endTs: w.endTs,
        tone: w.tone,
        detail: w.detail
      })),
    [windows]
  );

  // Highlight-term selection drives emphasis when the visual focus store
  // has pinned a term from the Ask Agent flow. Otherwise the parent-controlled
  // selectedEventId wins.
  const highlightedFromTerms = useMemo(() => {
    if (!highlightTerms || highlightTerms.length === 0) return undefined;
    const lc = highlightTerms.map((t) => t.toLowerCase());
    return events.find((e) =>
      lc.some((term) =>
        `${e.title} ${e.detail}`.toLowerCase().includes(term)
      )
    )?.id;
  }, [events, highlightTerms]);

  const activeId = selectedEventId ?? highlightedFromTerms;

  const fallbackRows = useMemo<FallbackRow[]>(
    () =>
      events.map((event) => {
        const ts = Date.parse(event.date);
        const containing = Number.isFinite(ts)
          ? windows.find((w) => ts >= w.startTs && ts <= w.endTs)
          : undefined;
        return {
          date: event.date,
          title: event.title,
          detail: event.detail,
          tone: event.tone,
          windowLabel: containing?.label ?? "—"
        };
      }),
    [events, windows]
  );

  const minHeight = Math.max(220, 160 + windows.length * 28);

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Temporal reasoning</p>
          <h3>Patient event timeline</h3>
          <p className="panel-copy">Screening anchor: {anchorLabel}</p>
        </div>
      </div>

      <VizFrame<FallbackRow>
        label="Patient temporal bar with exclusion windows"
        description="Each marker is a patient event plotted on a true date scale. Shape encodes tone (diamond = critical, triangle = warning, circle = positive, square = neutral). Translucent bracketed bands beneath the lane are lookback or exclusion windows for the selected criterion. The dashed vertical rule marks the screening anchor."
        data={fallbackRows}
        columns={[
          { key: "date", header: "Date" },
          { key: "title", header: "Event" },
          { key: "detail", header: "Detail" },
          { key: "tone", header: "Tone" },
          { key: "windowLabel", header: "Within window" }
        ]}
        minHeight={minHeight}
      >
        {({ width, height }) => (
          <TemporalStrip
            events={temporalEvents}
            windows={temporalWindows}
            anchorTs={anchorTs}
            anchorLabel={anchorLabel}
            width={width}
            height={height}
            selectedId={activeId}
            onActivate={(event) => onEventClick?.(event.id)}
          />
        )}
      </VizFrame>
    </section>
  );
}
