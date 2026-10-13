import React from "react";
import { auditEvents } from "../../data/index";
import type { MatchRecommendation } from "@old/types";

interface FlowNode {
  id: string;
  label: string;
  actor: string;
  timestamp: string;
  x: number;
  y: number;
}

interface AuditFlowGraphProps {
  match: MatchRecommendation;
}

export function AuditFlowGraph({ match }: AuditFlowGraphProps) {
  // Scope audit events to this match so we don't silently render another patient's chain.
  const scopedEvents = auditEvents.filter((e) => match.auditIds.includes(e.id));

  if (scopedEvents.length === 0) {
    return (
      <div
        className="audit-flow"
        style={{
          padding: "var(--space-6) var(--space-4)",
          textAlign: "center",
          color: "var(--ink-muted)",
          fontSize: "var(--text-small)",
          fontStyle: "italic",
        }}
      >
        No audit events recorded yet for this match.
      </div>
    );
  }

  const nodes: FlowNode[] = scopedEvents.map((event, index) => ({
    id: event.id,
    label: event.eventType.split(".").pop()?.replace("_", " ") ?? event.eventType,
    actor: event.actor,
    timestamp: event.timestamp.split(" · ")[1] ?? event.timestamp,
    x: 40 + index * 140,
    y: 100 + (index % 2 === 0 ? 0 : 60),
  }));

  const nodeWidth = 120;
  const nodeHeight = 60;

  return (
    <div className="audit-flow">
      <svg width={600} height={300} viewBox="0 0 600 300">
        {/* Connecting lines */}
        {nodes.map((node, i) => {
          if (i === 0) return null;
          const prev = nodes[i - 1];
          return (
            <line
              key={`line-${node.id}`}
              x1={prev.x + nodeWidth / 2}
              y1={prev.y + nodeHeight / 2}
              x2={node.x + nodeWidth / 2}
              y2={node.y + nodeHeight / 2}
              stroke="var(--slate-300)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Arrow markers */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth={8}
            markerHeight={6}
            refX={8}
            refY={3}
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="var(--slate-300)" />
          </marker>
        </defs>

        {nodes.map((node, i) => {
          if (i === 0) return null;
          const prev = nodes[i - 1];
          return (
            <line
              key={`arrow-${node.id}`}
              x1={prev.x + nodeWidth / 2}
              y1={prev.y + nodeHeight / 2}
              x2={node.x + nodeWidth / 2}
              y2={node.y + nodeHeight / 2}
              stroke="var(--teal-300)"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id} className="audit-flow__node">
            <rect
              x={node.x}
              y={node.y}
              width={nodeWidth}
              height={nodeHeight}
              rx={8}
              ry={8}
              fill="var(--bg-secondary)"
              stroke="var(--teal-400)"
              strokeWidth={1.5}
            />
            <text
              x={node.x + nodeWidth / 2}
              y={node.y + 20}
              textAnchor="middle"
              className="audit-flow__label"
              style={{ fontWeight: 600, fontSize: 11 }}
            >
              {node.label}
            </text>
            <text
              x={node.x + nodeWidth / 2}
              y={node.y + 35}
              textAnchor="middle"
              className="audit-flow__label"
              style={{ fontSize: 9 }}
            >
              {node.actor}
            </text>
            <text
              x={node.x + nodeWidth / 2}
              y={node.y + 50}
              textAnchor="middle"
              className="audit-flow__label"
              style={{ fontSize: 9, opacity: 0.7 }}
            >
              {node.timestamp}
            </text>
          </g>
        ))}

        {/* Title labels along the top */}
        <text x={20} y={30} style={{ fontSize: 11, fill: "var(--ink-muted)", fontWeight: 600 }}>
          Decision Flow
        </text>
        <line x1={20} y1={40} x2={580} y2={40} stroke="var(--slate-200)" strokeWidth={1} />
      </svg>
    </div>
  );
}
