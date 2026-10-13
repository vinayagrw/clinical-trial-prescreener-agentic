import React, { useMemo } from "react";
import type { NormalizedCriterion } from "@old/types";

type CriterionType = NormalizedCriterion["type"];
type CriterionComputability = NormalizedCriterion["computability"];

const COMPUTABILITY_ORDER: CriterionComputability[] = [
  "deterministic",
  "hybrid",
  "manual_only",
];

const TYPE_ORDER: CriterionType[] = ["inclusion", "exclusion"];

const computabilityLabel: Record<CriterionComputability, string> = {
  deterministic: "Deterministic",
  hybrid: "Hybrid",
  manual_only: "Manual only",
};

const computabilityDescription: Record<CriterionComputability, string> = {
  deterministic: "Fully automated from structured data",
  hybrid: "Automated draft with human review",
  manual_only: "Requires coordinator judgment",
};

const computabilityColors: Record<CriterionComputability, { bg: string; fg: string; border: string }> = {
  deterministic: { bg: "var(--moss-50)", fg: "var(--moss-500)", border: "var(--moss-200, var(--moss-50))" },
  hybrid: { bg: "var(--amber-50)", fg: "var(--amber-500)", border: "var(--amber-200, var(--amber-50))" },
  manual_only: { bg: "var(--slate-100)", fg: "var(--ink-secondary)", border: "var(--slate-200)" },
};

const typeLabel: Record<CriterionType, string> = {
  inclusion: "Inclusion",
  exclusion: "Exclusion",
};

interface ComputabilityGridProps {
  criteria: NormalizedCriterion[];
}

/**
 * Dense summary grid that crosses criterion type (inclusion/exclusion) against
 * computability (deterministic/hybrid/manual_only) and shows how many criteria
 * fall in each cell. Gives the Trial Config page a high-signal snapshot of
 * "where automation is strong and where judgment still sits" (ported from
 * sample-ui's AdminVisuals.ComputabilityGrid with the grid semantics
 * simplified to 15's NormalizedCriterion shape).
 */
export function ComputabilityGrid({ criteria }: ComputabilityGridProps) {
  const { cells, totalsByComputability, totalsByType, total } = useMemo(() => {
    const cells: Record<string, NormalizedCriterion[]> = {};
    const totalsByComputability: Record<CriterionComputability, number> = {
      deterministic: 0,
      hybrid: 0,
      manual_only: 0,
    };
    const totalsByType: Record<CriterionType, number> = {
      inclusion: 0,
      exclusion: 0,
    };

    for (const c of criteria) {
      const key = `${c.type}__${c.computability}`;
      if (!cells[key]) cells[key] = [];
      cells[key].push(c);
      totalsByComputability[c.computability] = (totalsByComputability[c.computability] || 0) + 1;
      totalsByType[c.type] = (totalsByType[c.type] || 0) + 1;
    }

    return { cells, totalsByComputability, totalsByType, total: criteria.length };
  }, [criteria]);

  if (criteria.length === 0) {
    return (
      <div className="glass-surface--card" style={{ padding: "var(--space-5)" }}>
        <h3 className="computability-grid__title">Computability Grid</h3>
        <p className="computability-grid__empty">No criteria defined for this trial yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-surface--card computability-grid" style={{ padding: "var(--space-5)" }}>
      <div className="computability-grid__header">
        <div>
          <div className="computability-grid__eyebrow">Dominant view</div>
          <h3 className="computability-grid__title">Computability Grid</h3>
          <p className="computability-grid__subtitle">
            Crosses type against computability to show where automation is strong and where
            judgment still sits. {total} criteria total.
          </p>
        </div>
      </div>

      <div className="computability-grid__table">
        {/* Column headers */}
        <div className="computability-grid__corner" />
        {COMPUTABILITY_ORDER.map((comp) => (
          <div key={`col-${comp}`} className="computability-grid__col-header">
            <span className="computability-grid__col-label">{computabilityLabel[comp]}</span>
            <span className="computability-grid__col-total">{totalsByComputability[comp]}</span>
          </div>
        ))}

        {/* Rows */}
        {TYPE_ORDER.map((type) => (
          <React.Fragment key={`row-${type}`}>
            <div className="computability-grid__row-header">
              <span className="computability-grid__row-label">{typeLabel[type]}</span>
              <span className="computability-grid__row-total">{totalsByType[type]}</span>
            </div>
            {COMPUTABILITY_ORDER.map((comp) => {
              const key = `${type}__${comp}`;
              const bucket = cells[key] ?? [];
              const colors = computabilityColors[comp];
              return (
                <div
                  key={key}
                  className="computability-grid__cell"
                  style={{
                    background: bucket.length > 0 ? colors.bg : "transparent",
                    borderColor: bucket.length > 0 ? colors.border : "var(--slate-100)",
                    color: bucket.length > 0 ? colors.fg : "var(--ink-muted)",
                  }}
                  title={
                    bucket.length > 0
                      ? bucket.map((c) => c.label).join("\n")
                      : `No ${type} criteria in this bucket`
                  }
                >
                  <span className="computability-grid__cell-count">{bucket.length}</span>
                  <span className="computability-grid__cell-label">{computabilityDescription[comp]}</span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
