/*
 * AuditSwimlane (V7) — replaces the flat AuditPanel list in
 * src/pages/AuditPage.tsx with a multi-lane time axis. Each lane is an
 * actor (screening.job, criterion.engine, coordinator, PI...); each event
 * is a marker at (time, lane); arcs link consecutive events so the
 * handoff pattern reads at a glance.
 *
 * The flat AuditPanel text list stays mounted below the swimlane as the
 * keyboard/screen-reader alternative — the plan's section 16.4 calls out
 * that the audit trail must remain keyboard-accessible in text form even
 * when a viz is added. VizFrame also generates an sr-only fallback table.
 *
 * Event → tone mapping:
 * - screening.job_completed → info (blue circle)
 * - criterion.assessed + pass → pass (square)
 * - criterion.assessed + uncertain/contradicts → uncertain (triangle)
 * - criterion.assessed + fail → fail (diamond)
 * - match.finalized → manual (rounded bar — human-touched)
 * - anything else → info
 */

import { useMemo } from "react";
import type { AuditEvent } from "../../../../types";
import { VizFrame } from "../../../../components/viz/VizFrame";
import {
  SwimLane,
  type SwimLaneEvent,
  type SwimLaneTone
} from "../../../../components/viz/primitives/SwimLane";
import type { ArcEdge } from "../../../../components/viz/primitives/ArcDiagram";

interface AuditSwimlaneProps {
  events: readonly AuditEvent[];
  selectedEventId?: string;
  onEventClick?: (eventId: string) => void;
}

interface FallbackRow extends Record<string, unknown> {
  timestamp: string;
  actor: string;
  eventType: string;
  summary: string;
  tone: string;
}

/**
 * Audit fixtures carry display-formatted timestamps like
 * "Apr 6, 2026 | 7:14 AM". `Date.parse` does not understand the `|` separator,
 * so we normalize to "Apr 6, 2026 7:14 AM" before the primitive sees it. The
 * SwimLane primitive's documented contract is "Date.parse compatible", so the
 * normalization belongs here (consumer-side), not in the primitive.
 */
function normalizeAuditTimestamp(raw: string): string {
  return raw.replace(/\s*\|\s*/g, " ").trim();
}

function inferTone(event: AuditEvent): SwimLaneTone {
  const summary = event.summary.toLowerCase();
  const type = event.eventType.toLowerCase();

  if (type.includes("finalized") || type.includes("override")) {
    return "manual";
  }

  if (type.includes("screening") || type.includes("ingested") || type.includes("import")) {
    return "info";
  }

  if (type.includes("assessed") || type.includes("criterion")) {
    if (summary.includes("pass")) return "pass";
    if (summary.includes("fail")) return "fail";
    if (
      summary.includes("uncertain") ||
      summary.includes("conflict") ||
      summary.includes("contradict") ||
      summary.includes("missing") ||
      summary.includes("stale")
    ) {
      return "uncertain";
    }
    return "info";
  }

  return "info";
}

export function AuditSwimlane({
  events,
  selectedEventId,
  onEventClick
}: AuditSwimlaneProps) {
  const swimEvents = useMemo<SwimLaneEvent[]>(
    () =>
      events.map((event) => ({
        id: event.id,
        timestamp: normalizeAuditTimestamp(event.timestamp),
        lane: event.actor,
        eventType: event.eventType,
        summary: event.summary,
        tone: inferTone(event)
      })),
    [events]
  );

  // Chain consecutive events chronologically — the simplest honest story of
  // the handoff pattern. More sophisticated arc derivation (override →
  // finalize) can layer on once audit events include explicit linkage.
  const arcs = useMemo<ArcEdge[]>(() => {
    const sorted = [...swimEvents].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
    );
    const edges: ArcEdge[] = [];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const from = sorted[i];
      const to = sorted[i + 1];
      // Only draw an arc when the handoff crosses lanes — same-lane
      // successor events are already visually adjacent.
      if (from.lane !== to.lane) {
        edges.push({
          fromId: from.id,
          toId: to.id,
          label: `${from.lane} → ${to.lane}`
        });
      }
    }
    return edges;
  }, [swimEvents]);

  const fallbackRows = useMemo<FallbackRow[]>(
    () =>
      events.map((event) => ({
        timestamp: event.timestamp,
        actor: event.actor,
        eventType: event.eventType,
        summary: event.summary,
        tone: inferTone(event)
      })),
    [events]
  );

  // Size so every lane gets a generous row.
  const uniqueLaneCount = useMemo(
    () => new Set(events.map((e) => e.actor)).size,
    [events]
  );
  const minHeight = Math.max(220, 80 + uniqueLaneCount * 48);

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Audit handoff</p>
          <h3>{events.length} events across {uniqueLaneCount} actors</h3>
        </div>
      </div>

      <VizFrame<FallbackRow>
        label="Audit event swimlane"
        description="Each horizontal lane is an actor (automated job, engine, or human). Each marker is an audit event at the time it was recorded. Shape encodes tone (circle = info, square = pass, triangle = uncertain, diamond = fail, rounded bar = human action). Dashed arcs show cross-lane handoffs in chronological order — the story of how the decision moved through the system."
        data={fallbackRows}
        columns={[
          { key: "timestamp", header: "Time" },
          { key: "actor", header: "Actor" },
          { key: "eventType", header: "Event type" },
          { key: "summary", header: "Summary" },
          { key: "tone", header: "Tone" }
        ]}
        minHeight={minHeight}
      >
        {({ width, height }) => (
          <SwimLane
            events={swimEvents}
            arcs={arcs}
            width={width}
            height={height}
            selectedId={selectedEventId}
            onActivate={(event) => onEventClick?.(event.id)}
          />
        )}
      </VizFrame>
    </section>
  );
}
