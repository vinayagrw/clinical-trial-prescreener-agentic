import React from "react";
import { matches, getTrial } from "../../data/index";
import { ProgressRing } from "../shared/ProgressRing";
import { StatusDot } from "../shared/StatusDot";

export interface TrialComparisonStripProps {
  patientId: string;
  currentTrialId: string;
}

export function TrialComparisonStrip({
  patientId,
  currentTrialId,
}: TrialComparisonStripProps) {
  const patientMatches = matches.filter((m) => m.patientId === patientId);

  if (patientMatches.length <= 1) return null;

  return (
    <div className="trial-comparison">
      {patientMatches.map((m) => {
        const trial = getTrial(m.trialId);
        const isActive = m.trialId === currentTrialId;
        const ringColor =
          m.fitScore >= 80 ? "teal" : m.fitScore >= 60 ? "amber" : "brick";

        return (
          <div
            key={m.id}
            className={`trial-comparison__card${
              isActive ? " trial-comparison__card--active" : ""
            }`}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBottom: "var(--space-2)",
              }}
            >
              <ProgressRing value={m.fitScore} size={32} strokeWidth={3} color={ringColor} />
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-micro)",
                    fontWeight: "var(--weight-semibold)" as string,
                    color: isActive ? "var(--teal-600)" : "var(--ink)",
                  }}
                >
                  {trial?.shortCode ?? m.trialId}
                </div>
                <StatusDot
                  status={m.recommendation}
                  size="sm"
                  label={m.recommendation.replace("_", " ")}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
