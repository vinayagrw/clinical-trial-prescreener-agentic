/*
 * CriterionDotMatrix (V3) — replaces the vertical CriterionRow stack that
 * the review workbench currently renders as a long list.
 *
 * A dot matrix maps criteria to (bucket row, column) pairs and encodes:
 *   - status  → fill color + glyph shape (checkmark / X / outline / hyphen)
 *   - freshness → dashed outer ring when stale/missing
 *   - criterion label → tooltip + sr-only announcement
 *
 * This gives the coordinator a single-glance picture of which criterion
 * families are blocking the match, and one-click drill-down to the
 * evidence panel.
 */

import { useMemo } from "react";
import type { CriterionAssessment } from "../../../../types";
import { VizFrame } from "../../../../components/viz/VizFrame";
import {
  DotMatrix,
  type DotMatrixDatum,
  type DotMatrixFreshness,
  type DotMatrixStatus
} from "../../../../components/viz/primitives/DotMatrix";

interface CriterionDotMatrixProps {
  assessments: readonly CriterionAssessment[];
  selectedCriterionId?: string;
  onCriterionClick?: (criterionId: string) => void;
}

interface FallbackRow extends Record<string, unknown> {
  bucket: string;
  label: string;
  status: string;
  freshness: string;
  summary: string;
}

const FRESHNESS_MAP: Record<string, DotMatrixFreshness> = {
  fresh: "fresh",
  aging: "aging",
  stale: "stale",
  missing: "missing"
};

const STATUS_MAP: Record<string, DotMatrixStatus> = {
  pass: "pass",
  fail: "fail",
  uncertain: "uncertain",
  manual_review: "manual_review"
};

export function CriterionDotMatrix({
  assessments,
  selectedCriterionId,
  onCriterionClick
}: CriterionDotMatrixProps) {
  const data = useMemo<DotMatrixDatum[]>(
    () =>
      assessments.map((a) => ({
        id: a.id,
        bucket: a.bucket,
        label: a.label,
        status: STATUS_MAP[a.status] ?? "uncertain",
        freshness: FRESHNESS_MAP[a.freshness] ?? "aging",
        note: a.unresolvedReason ?? a.summary
      })),
    [assessments]
  );

  const fallbackRows = useMemo<FallbackRow[]>(
    () =>
      assessments.map((a) => ({
        bucket: a.bucket,
        label: a.label,
        status: a.status,
        freshness: a.freshness,
        summary: a.unresolvedReason ?? a.summary
      })),
    [assessments]
  );

  const bucketCount = useMemo(() => new Set(assessments.map((a) => a.bucket)).size, [
    assessments
  ]);
  const maxRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assessments) counts.set(a.bucket, (counts.get(a.bucket) ?? 0) + 1);
    return Math.max(...Array.from(counts.values()), 1);
  }, [assessments]);

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Criterion review matrix</p>
          <h3>{assessments.length} criteria across {bucketCount} buckets</h3>
        </div>
        {selectedCriterionId ? (
          <span className="eyebrow-label">
            Selected: {assessments.find((a) => a.id === selectedCriterionId)?.label ?? "—"}
          </span>
        ) : null}
      </div>

      <VizFrame<FallbackRow>
        label="Criterion review dot matrix"
        description="Rows are criterion buckets. Each dot encodes the criterion's status with a shape (checkmark for pass, X for fail, outline for uncertain, hyphen for manual review) and freshness with a dashed outer ring when stale or missing."
        data={fallbackRows}
        columns={[
          { key: "bucket", header: "Bucket" },
          { key: "label", header: "Criterion" },
          { key: "status", header: "Status" },
          { key: "freshness", header: "Freshness" },
          { key: "summary", header: "Summary" }
        ]}
        minHeight={Math.max(180, bucketCount * 56 + maxRows * 20)}
      >
        {({ width, height }) => (
          <DotMatrix
            data={data}
            width={width}
            height={height}
            onActivate={(datum) => onCriterionClick?.(datum.id)}
          />
        )}
      </VizFrame>
    </section>
  );
}
