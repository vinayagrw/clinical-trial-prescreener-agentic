/*
 * ArcDiagram — draws gentle quadratic curves between anchor points on the
 * same SVG canvas. Used by SwimLane.tsx to overlay "this event → that event"
 * handoff arcs on the audit timeline, and by any other viz that needs to
 * express a 1D linkage without a full force-directed graph.
 *
 * Why a separate primitive: section 16 rejected force-directed graphs for
 * n < 50 networks because they devolve into spaghetti. Arc diagrams put all
 * nodes on a 1D line and use arcs to express links — the eye scans the arcs
 * like a staff of handoffs.
 *
 * Contract:
 * - Anchors are an id → {x,y} map computed by the parent (e.g. SwimLane
 *   already has a time scale and a lane scale). ArcDiagram does not compute
 *   its own scale; it trusts the parent's geometry.
 * - Edges are {fromId, toId, tone?} tuples. Missing anchors silently drop.
 * - The arc is a shallow quadratic curve — control point is midway between
 *   the two anchors, offset vertically by min(30, |dx|/4) so close pairs
 *   get tight arcs and far pairs get generous ones.
 */

import type { ReactElement } from "react";

export interface ArcAnchor {
  x: number;
  y: number;
}

export type ArcAnchorMap = Record<string, ArcAnchor>;

export interface ArcEdge {
  fromId: string;
  toId: string;
  /** Optional semantic label shown on hover (not required). */
  label?: string;
  /** Optional per-edge tone override; falls back to ArcDiagram's stroke prop. */
  tone?: string;
}

export interface ArcDiagramProps {
  anchors: ArcAnchorMap;
  edges: readonly ArcEdge[];
  /** Stroke color for arcs when no per-edge tone is provided. */
  stroke: string;
  /** Stroke width for arcs. Defaults to 1.25. */
  strokeWidth?: number;
  /** Opacity for arcs. Defaults to 0.55 — arcs are a background signal, not a primary channel. */
  opacity?: number;
  /**
   * Direction of the control-point offset. "up" curves arcs above the anchor
   * line (good when markers live at the bottom of a lane), "down" curves
   * below. Defaults to "up".
   */
  bend?: "up" | "down";
}

export function ArcDiagram({
  anchors,
  edges,
  stroke,
  strokeWidth = 1.25,
  opacity = 0.55,
  bend = "up"
}: ArcDiagramProps): ReactElement {
  return (
    <g className="viz-arc-diagram" pointerEvents="none">
      {edges.map((edge) => {
        const a = anchors[edge.fromId];
        const b = anchors[edge.toId];
        if (!a || !b) return null;

        const dx = b.x - a.x;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        // Shallow curve — tighter for close pairs.
        const rise = Math.min(30, Math.max(10, Math.abs(dx) / 4));
        const controlY = bend === "up" ? midY - rise : midY + rise;
        const path = `M ${a.x} ${a.y} Q ${midX} ${controlY} ${b.x} ${b.y}`;

        return (
          <path
            key={`${edge.fromId}->${edge.toId}`}
            d={path}
            fill="none"
            stroke={edge.tone ?? stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
            strokeLinecap="round"
            strokeDasharray="3 3"
          >
            {edge.label ? <title>{edge.label}</title> : null}
          </path>
        );
      })}
    </g>
  );
}
