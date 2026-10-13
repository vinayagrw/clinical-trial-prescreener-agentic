import React from "react";
import { assessments, evidenceSnippets } from "../../data/index";
import type { MatchRecommendation } from "@old/types";

const toneColors: Record<string, string> = {
  supporting: "var(--moss-400)",
  contradicting: "var(--brick-400)",
  context: "var(--slate-300)",
};

interface EvidenceMapProps {
  match: MatchRecommendation;
}

export function EvidenceMap({ match }: EvidenceMapProps) {
  // Scope criteria + evidence to this match so the map doesn't silently render another patient's chain.
  const scopedAssessments = assessments.filter((a) => match.criterionIds.includes(a.id));
  const scopedCriterionIdSet = new Set(scopedAssessments.map((a) => a.id));
  const relevantEvidence = evidenceSnippets.filter(
    (e) =>
      e.patientId === match.patientId &&
      e.criterionIds.some((cId) => scopedCriterionIdSet.has(cId))
  );

  if (scopedAssessments.length === 0 || relevantEvidence.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-6) var(--space-4)",
          textAlign: "center",
          color: "var(--ink-muted)",
          fontSize: "var(--text-small)",
          fontStyle: "italic",
        }}
      >
        No evidence mapped to criteria for this match yet.
      </div>
    );
  }

  const svgWidth = 500;
  const svgHeight = Math.max(relevantEvidence.length, scopedAssessments.length) * 50 + 60;
  const leftX = 20;
  const rightX = svgWidth - 20;
  const leftColWidth = 180;
  const rightColWidth = 180;

  return (
    <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
      {/* Column headers */}
      <text
        x={leftX + leftColWidth / 2}
        y={20}
        textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink-muted)" }}
      >
        Evidence Sources
      </text>
      <text
        x={rightX - rightColWidth / 2}
        y={20}
        textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink-muted)" }}
      >
        Criteria
      </text>

      <line x1={leftX} y1={30} x2={svgWidth - leftX} y2={30} stroke="var(--slate-200)" strokeWidth={1} />

      {/* Evidence nodes (left) */}
      {relevantEvidence.map((evidence, i) => {
        const y = 55 + i * 45;
        return (
          <g key={evidence.id}>
            <rect
              x={leftX}
              y={y - 12}
              width={leftColWidth}
              height={28}
              rx={4}
              fill="var(--bg-secondary)"
              stroke={toneColors[evidence.tone] ?? "var(--slate-200)"}
              strokeWidth={1.5}
            />
            <text
              x={leftX + 8}
              y={y + 4}
              style={{
                fontSize: 9,
                fill: "var(--ink-secondary)",
              }}
            >
              {evidence.type.length > 22
                ? evidence.type.substring(0, 22) + "..."
                : evidence.type}
            </text>
          </g>
        );
      })}

      {/* Criteria nodes (right) */}
      {scopedAssessments.map((criterion, i) => {
        const y = 55 + i * 45;
        return (
          <g key={criterion.id}>
            <rect
              x={rightX - rightColWidth}
              y={y - 12}
              width={rightColWidth}
              height={28}
              rx={4}
              fill="var(--bg-secondary)"
              stroke="var(--teal-300)"
              strokeWidth={1.5}
            />
            <text
              x={rightX - rightColWidth + 8}
              y={y + 4}
              style={{
                fontSize: 9,
                fill: "var(--ink-secondary)",
              }}
            >
              {criterion.label.length > 24
                ? criterion.label.substring(0, 24) + "..."
                : criterion.label}
            </text>
          </g>
        );
      })}

      {/* Connecting lines */}
      {relevantEvidence.map((evidence, eIdx) => {
        const eY = 55 + eIdx * 45;
        return evidence.criterionIds.map((cId) => {
          const cIdx = scopedAssessments.findIndex((a) => a.id === cId);
          if (cIdx === -1) return null;
          const cY = 55 + cIdx * 45;
          return (
            <path
              key={`${evidence.id}-${cId}`}
              d={`M ${leftX + leftColWidth} ${eY} C ${svgWidth / 2} ${eY}, ${svgWidth / 2} ${cY}, ${rightX - rightColWidth} ${cY}`}
              fill="none"
              stroke={toneColors[evidence.tone] ?? "var(--slate-200)"}
              strokeWidth={1.5}
              opacity={0.5}
            />
          );
        });
      })}
    </svg>
  );
}
