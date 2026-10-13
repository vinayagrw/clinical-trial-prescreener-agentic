import { matchesHighlightTerms } from "../../lib/visualAdapters";
import type {
  CriterionAssessment,
  EligibilityAtlasGroup,
  EvidenceSnippet,
  ResolutionBoardItem,
  TimelineEvent,
  TimelineWindowModel
} from "../../types";
import { StatusChip } from "../StatusChip";

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

function toneForStatus(status: CriterionAssessment["status"]) {
  switch (status) {
    case "pass":
      return "moss";
    case "fail":
      return "brick";
    case "manual_review":
      return "amber";
    default:
      return "paper";
  }
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

function toneForTimeline(tone: TimelineEvent["tone"]) {
  switch (tone) {
    case "critical":
      return "brick";
    case "warning":
      return "amber";
    case "positive":
      return "moss";
    default:
      return "paper";
  }
}

interface EligibilityAtlasProps {
  groups: EligibilityAtlasGroup[];
  selectedCriterionId: string;
  onSelect: (criterionId: string) => void;
  highlightTerms?: string[];
}

export function EligibilityAtlas({
  groups,
  selectedCriterionId,
  onSelect,
  highlightTerms = []
}: EligibilityAtlasProps) {
  return (
    <section className="surface visual-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Dominant view</p>
          <h3>Eligibility atlas</h3>
          <p>Grouped tiles make inclusion fit, exclusion pressure, and manual boundaries readable at a glance.</p>
        </div>
      </div>

      <div className="eligibility-atlas">
        {groups.map((group, index) => (
          /* Wave B — each atlas group is a native <details> so reviewers
             can collapse groups without JS and the browser's built-in
             focus + Enter/Space handling. Open by default on mount so
             nothing is hidden from a first-time viewer. */
          <details
            key={group.id}
            open
            className={`eligibility-atlas__group eligibility-atlas__group--${group.tone}`}
            style={{ ["--i" as string]: index }}
          >
            <summary className="eligibility-atlas__group-head">
              <strong>{group.label}</strong>
              <span>{group.criteria.length} criteria</span>
              <span className="eligibility-atlas__group-caret" aria-hidden="true">
                <svg viewBox="0 0 12 12" width="10" height="10">
                  <path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </summary>
            <div className="eligibility-atlas__tiles">
              {group.criteria.map((assessment, tileIndex) => {
                const isSelected = assessment.id === selectedCriterionId;
                const isHighlighted = matchesHighlightTerms(
                  `${assessment.label} ${assessment.summary} ${assessment.reasoning}`,
                  highlightTerms
                );

                return (
                  <button
                    key={assessment.id}
                    type="button"
                    className={`eligibility-atlas__tile ${
                      isSelected ? "eligibility-atlas__tile--selected" : ""
                    } ${isHighlighted ? "eligibility-atlas__tile--highlighted" : ""}`}
                    style={{ ["--i" as string]: tileIndex }}
                    onClick={() => onSelect(assessment.id)}
                  >
                    <div className="eligibility-atlas__tile-top">
                      <StatusChip label={assessment.status} tone={toneForStatus(assessment.status)} compact />
                      <span>{assessment.confidenceLabel}</span>
                    </div>
                    <strong>{assessment.label}</strong>
                    <p>{assessment.summary}</p>
                    <div className="eligibility-atlas__tile-foot">
                      <span>{humanize(assessment.computability)}</span>
                      <span>{assessment.freshness}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

interface EvidenceWeaveProps {
  assessment: CriterionAssessment;
  evidence: EvidenceSnippet[];
  highlightTerms?: string[];
  embedded?: boolean;
}

export function EvidenceWeave({
  assessment,
  evidence,
  highlightTerms = [],
  embedded = false
}: EvidenceWeaveProps) {
  const columns: Array<{
    id: EvidenceSnippet["tone"];
    label: string;
    items: EvidenceSnippet[];
  }> = [
    { id: "supporting", label: "Supports", items: evidence.filter((item) => item.tone === "supporting") },
    { id: "contradicting", label: "Conflicts", items: evidence.filter((item) => item.tone === "contradicting") },
    { id: "context", label: "Context", items: evidence.filter((item) => item.tone === "context") }
  ];

  return (
    <section
      className={`surface visual-panel ${embedded ? "surface--embedded" : ""}`.trim()}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Supporting view</p>
          <h3>Evidence weave</h3>
          <p>{assessment.thresholdLabel ?? assessment.reasoning}</p>
        </div>
        <StatusChip label={`${evidence.length} sources`} tone="teal" compact />
      </div>

      <div className="evidence-weave">
        {columns.map((column) => (
          <article key={column.id} className="evidence-weave__column">
            <div className="evidence-weave__column-head">
              <strong>{column.label}</strong>
              <span>{column.items.length}</span>
            </div>
            <div className="evidence-weave__stack">
              {column.items.length ? (
                column.items.map((item, cardIndex) => {
                  const isHighlighted = matchesHighlightTerms(
                    `${item.sourceDocument} ${item.excerpt} ${item.author}`,
                    highlightTerms
                  );

                  return (
                    <article
                      key={item.id}
                      className={`evidence-weave__card ${
                        isHighlighted ? "evidence-weave__card--highlighted" : ""
                      }`}
                      style={{ ["--i" as string]: cardIndex }}
                    >
                      <div className="evidence-weave__card-top">
                        <StatusChip label={item.type} tone={toneForEvidence(item.tone)} compact />
                        <span>{item.sourceDate}</span>
                      </div>
                      <strong>{item.sourceDocument}</strong>
                      <p>{item.excerpt}</p>
                      <div className="evidence-weave__meta">
                        <span>{item.sourceSystem}</span>
                        <span>{item.author}</span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  <strong>No {column.label.toLowerCase()} sources</strong>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface ResolutionBoardProps {
  items: ResolutionBoardItem[];
  highlightTerms?: string[];
  embedded?: boolean;
}

export function ResolutionBoard({
  items,
  highlightTerms = [],
  embedded = false
}: ResolutionBoardProps) {
  const contradictions = items.filter((item) => item.lane === "contradictions");
  const missingData = items.filter((item) => item.lane === "missing_data");
  const lanes = [
    { id: "contradictions", label: "Contradictions", items: contradictions },
    { id: "missing_data", label: "Missing domains", items: missingData }
  ] as const;

  return (
    <section className={`surface ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Trust and governance</p>
          <h3>Resolution board</h3>
        </div>
      </div>

      <div className="resolution-board">
        {lanes.map((lane) => (
          <article key={lane.id} className="resolution-board__lane">
            <div className="resolution-board__lane-head">
              <strong>{lane.label}</strong>
              <span>{lane.items.length}</span>
            </div>
            <div className="resolution-board__lane-stack">
              {lane.items.map((item) => {
                const isHighlighted = matchesHighlightTerms(
                  `${item.title} ${item.summary} ${item.detail}`,
                  highlightTerms
                );

                return (
                  <article
                    key={item.id}
                    className={`resolution-board__card resolution-board__card--${item.tone} ${
                      isHighlighted ? "resolution-board__card--highlighted" : ""
                    }`}
                  >
                    <div className="card-row">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <p>{item.summary}</p>
                    <div className="resolution-board__meta">
                      <span>{item.owner}</span>
                      <span>{item.dueLabel}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface WashoutTimelineProps {
  events: TimelineEvent[];
  windows: TimelineWindowModel[];
  anchorLabel: string;
  highlightTerms?: string[];
}

export function WashoutTimeline({
  events,
  windows,
  anchorLabel,
  highlightTerms = []
}: WashoutTimelineProps) {
  const eventDates = events.map((event) => Date.parse(event.date));
  const windowDates = windows.flatMap((window) => [window.startTs, window.endTs]);
  const minTs = Math.min(...eventDates, ...windowDates, Date.now());
  const maxTs = Math.max(...eventDates, ...windowDates, Date.now());
  const span = Math.max(1, maxTs - minTs);

  return (
    <section className="surface visual-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Temporal reasoning</p>
          <h3>Washout timeline</h3>
          <p>Screening anchor: {anchorLabel}</p>
        </div>
      </div>

      <div className="washout-timeline">
        <div className="washout-timeline__rail">
          {windows.map((window) => (
            <div
              key={window.id}
              className={`washout-timeline__window washout-timeline__window--${window.tone}`}
              style={{
                left: `${((window.startTs - minTs) / span) * 100}%`,
                width: `${((window.endTs - window.startTs) / span) * 100}%`
              }}
            >
              <strong>{window.label}</strong>
              <span>{window.startLabel} to {window.endLabel}</span>
            </div>
          ))}

          {events.map((event) => {
            const isHighlighted = matchesHighlightTerms(
              `${event.title} ${event.detail}`,
              highlightTerms
            );

            return (
              <article
                key={event.id}
                className={`washout-timeline__event ${
                  isHighlighted ? "washout-timeline__event--highlighted" : ""
                }`}
                style={{ left: `${((Date.parse(event.date) - minTs) / span) * 100}%` }}
              >
                <StatusChip label={event.date} tone={toneForTimeline(event.tone)} compact />
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
