import type { CriterionAssessment, EvidenceSnippet } from "../types";
import { StatusChip } from "./StatusChip";

interface EvidenceDrawerProps {
  assessment: CriterionAssessment;
  evidence: EvidenceSnippet[];
}

function toneForEvidence(tone: EvidenceSnippet["tone"]) {
  switch (tone) {
    case "supporting":
      return "moss";
    case "contradicting":
      return "brick";
    default:
      return "paper";
  }
}

export function EvidenceDrawer({
  assessment,
  evidence
}: EvidenceDrawerProps) {
  return (
    <section className="evidence-drawer">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Evidence drawer</p>
          <h4>{assessment.label}</h4>
        </div>
        <StatusChip label={`${evidence.length} sources`} tone="teal" />
      </div>

      <p className="panel-copy">{assessment.reasoning}</p>

      <div className="detail-list detail-list--tight">
        <div className="detail-list__row">
          <strong>Threshold trace</strong>
          <span>{assessment.thresholdLabel ?? "Protocol-derived threshold"}</span>
        </div>
        <div className="detail-list__row">
          <strong>Last evaluated</strong>
          <span>{assessment.lastEvaluatedAt ?? "Current screening run"}</span>
        </div>
      </div>

      {assessment.unresolvedReason ? (
        <div className="callout callout--warning">
          <strong>Why this remains unresolved</strong>
          <p>{assessment.unresolvedReason}</p>
        </div>
      ) : null}

      <div className="evidence-stack">
        {evidence.map((item) => (
          <article key={item.id} className="evidence-card">
            <div className="evidence-card__top">
              <StatusChip label={item.tone} tone={toneForEvidence(item.tone)} compact />
              <span>
                {item.type} | {item.sourceDate}
              </span>
            </div>
            <strong>{item.sourceDocument}</strong>
            <p>{item.excerpt}</p>
            <div className="evidence-card__meta">
              <span>{item.sourceSystem}</span>
              <span>{item.author}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
