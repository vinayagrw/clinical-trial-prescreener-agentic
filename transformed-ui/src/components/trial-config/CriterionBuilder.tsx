import React from "react";
import { normalizedCriteria } from "../../data/index";
import type { NormalizedCriterion } from "@old/types";

const computabilityColors: Record<string, string> = {
  deterministic: "var(--teal-500)",
  hybrid: "var(--amber-500)",
  manual_only: "var(--slate-400)",
};

const computabilityBg: Record<string, string> = {
  deterministic: "var(--teal-50)",
  hybrid: "var(--amber-50)",
  manual_only: "var(--slate-100)",
};

interface CriterionBuilderProps {
  /** Optional trial-specific criteria. Falls back to the global normalized set when omitted. */
  criteria?: NormalizedCriterion[];
}

export function CriterionBuilder({ criteria }: CriterionBuilderProps = {}) {
  const list = criteria ?? normalizedCriteria;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {list.map((criterion, index) => (
        <div
          key={criterion.id}
          className="glass-surface--card"
          style={{
            padding: "var(--space-3) var(--space-4)",
            display: "grid",
            gridTemplateColumns: "80px 1fr auto auto auto",
            alignItems: "center",
            gap: "var(--space-3)",
            cursor: "grab",
            animationDelay: `${index * 50}ms`,
          }}
        >
          {/* Type badge */}
          <span
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: "var(--weight-bold)",
              textTransform: "uppercase" as const,
              letterSpacing: "var(--tracking-wide)",
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
              textAlign: "center",
              background:
                criterion.type === "inclusion"
                  ? "var(--teal-50)"
                  : "var(--brick-50)",
              color:
                criterion.type === "inclusion"
                  ? "var(--teal-500)"
                  : "var(--brick-500)",
            }}
          >
            {criterion.type}
          </span>

          {/* Label */}
          <span
            style={{
              fontSize: "var(--text-small)",
              fontWeight: "var(--weight-medium)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {criterion.label}
          </span>

          {/* Computability chip */}
          <span
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: "var(--weight-medium)",
              padding: "2px 8px",
              borderRadius: "var(--radius-pill)",
              background: computabilityBg[criterion.computability],
              color: computabilityColors[criterion.computability],
            }}
          >
            {criterion.computability.replace("_", " ")}
          </span>

          {/* Threshold */}
          <span
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--ink-muted)",
              maxWidth: 180,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={criterion.threshold}
          >
            {criterion.threshold}
          </span>

          {/* Owner */}
          <span
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--ink-secondary)",
              fontWeight: "var(--weight-medium)",
            }}
          >
            {criterion.owner}
          </span>
        </div>
      ))}
    </div>
  );
}
