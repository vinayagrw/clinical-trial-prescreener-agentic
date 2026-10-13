import React from "react";
import type { CriterionAssessment, EvidenceSnippet } from "../../types/index";
import { StatusDot } from "../shared/StatusDot";
import { TrustRibbon } from "../shared/TrustRibbon";
import { InlineOverride } from "./InlineOverride";

export interface CriterionAccordionProps {
  criterion: CriterionAssessment;
  evidence: EvidenceSnippet[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function CriterionAccordion({
  criterion,
  evidence,
  isExpanded,
  onToggle,
}: CriterionAccordionProps) {
  const relevantEvidence = evidence.filter((e) =>
    e.criterionIds.includes(criterion.id)
  );
  const previewEvidence = relevantEvidence.slice(0, 2);

  return (
    <div className="criterion-accordion">
      <button
        type="button"
        className="criterion-accordion__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <StatusDot status={criterion.status} size="md" />

        <span className="criterion-accordion__label">{criterion.label}</span>

        <TrustRibbon
          freshness={criterion.freshness}
          evidenceCount={relevantEvidence.length}
          confidence={criterion.confidenceLabel}
        />

        <span
          className={`criterion-accordion__chevron${
            isExpanded ? " criterion-accordion__chevron--open" : ""
          }`}
        >
          &#9662;
        </span>
      </button>

      {isExpanded && (
        <div className="criterion-accordion__body">
          <div className="criterion-accordion__summary">
            {criterion.summary}
          </div>

          {previewEvidence.length > 0 && (
            <div className="criterion-accordion__evidence-preview">
              {previewEvidence.map((ev) => (
                <div
                  key={ev.id}
                  className={`criterion-accordion__evidence-item criterion-accordion__evidence-item--${ev.tone}`}
                >
                  <strong>{ev.sourceDocument}</strong> ({ev.sourceDate})
                  <br />
                  {ev.excerpt}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: "var(--text-small)",
              color: "var(--ink-secondary)",
              lineHeight: "var(--leading-relaxed)",
              marginBottom: "var(--space-3)",
            }}
          >
            {criterion.reasoning}
          </div>

          {criterion.unresolvedReason && (
            <div
              style={{
                fontSize: "var(--text-small)",
                color: "var(--amber-500)",
                fontWeight: "var(--weight-medium)" as string,
                padding: "var(--space-2) var(--space-3)",
                background: "var(--amber-50)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "var(--space-3)",
              }}
            >
              Unresolved: {criterion.unresolvedReason}
            </div>
          )}

          <InlineOverride criterionId={criterion.id} />
        </div>
      )}
    </div>
  );
}
