import React, { useMemo } from "react";
import { trials, assessments, matches } from "../../data/index";
import type { MatchStatus } from "@old/types";

const statusColors: Record<MatchStatus, string> = {
  pass: "var(--moss-500)",
  fail: "var(--brick-500)",
  uncertain: "var(--amber-500)",
  manual_review: "var(--slate-400)",
};

interface TrialHealthBarProps {
  /** If set, only the matching trial is rendered. Otherwise all trials. */
  trialId?: string;
}

export function TrialHealthBar({ trialId }: TrialHealthBarProps = {}) {
  // Resolve criterionIds-per-trial from matches so every trial has a real
  // assessment footprint, not just trial-001. Each match knows its trial and
  // its criterionIds — union those by trial, then look up assessments.
  const criterionIdsByTrial = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const m of matches) {
      if (!map[m.trialId]) map[m.trialId] = new Set();
      for (const cid of m.criterionIds) {
        map[m.trialId].add(cid);
      }
    }
    return map;
  }, []);

  const visibleTrials = trialId
    ? trials.filter((t) => t.id === trialId)
    : trials;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4)" }}>
      {visibleTrials.map((trial) => {
        const criterionIds = criterionIdsByTrial[trial.id] ?? new Set<string>();
        const trialAssessments = assessments.filter((a) => criterionIds.has(a.id));

        const counts: Record<MatchStatus, number> = {
          pass: 0,
          fail: 0,
          uncertain: 0,
          manual_review: 0,
        };

        trialAssessments.forEach((a) => {
          counts[a.status] = (counts[a.status] || 0) + 1;
        });

        const total = trialAssessments.length || 1;

        return (
          <div key={trial.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-small)",
                fontWeight: "var(--weight-semibold)",
                color: "var(--teal-500)",
                minWidth: 60,
              }}
            >
              {trial.shortCode}
            </span>
            <div
              style={{
                flex: 1,
                display: "flex",
                height: 20,
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                background: "var(--slate-100)",
              }}
            >
              {(Object.keys(counts) as MatchStatus[]).map((status) =>
                counts[status] > 0 ? (
                  <div
                    key={status}
                    style={{
                      width: `${(counts[status] / total) * 100}%`,
                      background: statusColors[status],
                      transition: "width var(--duration-slow) var(--ease-out)",
                    }}
                    title={`${status}: ${counts[status]}`}
                  />
                ) : null,
              )}
            </div>
            <span
              style={{
                fontSize: "var(--text-micro)",
                color: "var(--ink-muted)",
                minWidth: 80,
                textAlign: "right",
              }}
            >
              {trialAssessments.length} criteria
            </span>
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display: "flex", gap: "var(--space-4)", paddingTop: "var(--space-2)" }}>
        {(["pass", "fail", "uncertain", "manual_review"] as MatchStatus[]).map((s) => (
          <span
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
              fontSize: "var(--text-micro)",
              color: "var(--ink-muted)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusColors[s],
                display: "inline-block",
              }}
            />
            {s === "manual_review" ? "Manual Review" : s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}
