import type { CriterionAssessment } from "../types";
import { StatusChip } from "./StatusChip";

interface CriterionRowProps {
  assessment: CriterionAssessment;
  selected: boolean;
  onSelect: (criterionId: string) => void;
}

function toneForStatus(status: CriterionAssessment["status"]) {
  switch (status) {
    case "pass":
      return "moss";
    case "fail":
      return "brick";
    case "uncertain":
      return "amber";
    default:
      return "slate";
  }
}

function toneForFreshness(freshness: CriterionAssessment["freshness"]) {
  switch (freshness) {
    case "fresh":
      return "moss";
    case "aging":
      return "amber";
    case "stale":
    case "missing":
      return "brick";
    default:
      return "paper";
  }
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

export function CriterionRow({
  assessment,
  selected,
  onSelect
}: CriterionRowProps) {
  return (
    <button
      type="button"
      className={`criterion-row ${selected ? "criterion-row--selected" : ""}`}
      onClick={() => onSelect(assessment.id)}
    >
      <div className="criterion-row__top">
        <div>
          <p className="eyebrow-label">{assessment.bucket}</p>
          <strong>{assessment.label}</strong>
        </div>
        <div className="criterion-row__chips">
          <StatusChip label={humanize(assessment.status)} tone={toneForStatus(assessment.status)} />
          <StatusChip label={humanize(assessment.computability)} tone="paper" />
          <StatusChip label={assessment.freshness} tone={toneForFreshness(assessment.freshness)} />
        </div>
      </div>
      <p>{assessment.summary}</p>
      <div className="criterion-row__foot">
        <span>{assessment.confidenceLabel}</span>
        <span>{assessment.reviewRequired ? "Reviewer action required" : "Auto-supported"}</span>
      </div>
    </button>
  );
}
