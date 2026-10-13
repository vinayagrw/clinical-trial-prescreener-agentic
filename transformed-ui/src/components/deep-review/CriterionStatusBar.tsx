import React from "react";
import type { CriterionAssessment } from "../../types/index";
import { getCriterionDistribution } from "../../data/helpers";

export interface CriterionStatusBarProps {
  criteria: CriterionAssessment[];
}

const statusLabels: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  uncertain: "Uncertain",
  manual_review: "Manual",
};

export function CriterionStatusBar({ criteria }: CriterionStatusBarProps) {
  const distribution = getCriterionDistribution(criteria);

  if (distribution.length === 0) return null;

  const summaryParts = distribution.map(
    (d) => `${d.count} ${statusLabels[d.status] ?? d.status}`
  );

  return (
    <div>
      <div className="criterion-status-bar">
        {distribution.map((d) => (
          <div
            key={d.status}
            className={`criterion-status-bar__segment criterion-status-bar__segment--${d.status}`}
            style={{ width: `${d.percentage}%` }}
            title={`${statusLabels[d.status]}: ${d.count} (${d.percentage}%)`}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: "var(--text-micro)",
          color: "var(--ink-muted)",
          marginBottom: "var(--space-4)",
        }}
      >
        {summaryParts.join(" \u00B7 ")}
      </div>
    </div>
  );
}
