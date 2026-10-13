import { Link, useNavigate } from "react-router-dom";
import { matchesHighlightTerms } from "../../lib/visualAdapters";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives";
import type {
  MatchRecommendation,
  Patient,
  QueueItem,
  QueuePriorityPoint,
  StoryRailItem,
  Trial
} from "../../types";
import { StatusChip } from "../StatusChip";

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

function toneForDisposition(disposition: QueueItem["nextStep"]) {
  switch (disposition) {
    case "candidate_for_outreach":
      return "moss";
    case "needs_pi_review":
      return "amber";
    case "protocol_question":
    case "closed_not_eligible":
      return "brick";
    default:
      return "paper";
  }
}

function toneForPriority(priority: QueueItem["priority"]) {
  switch (priority) {
    case "critical":
      return "brick";
    case "high":
      return "amber";
    case "moderate":
      return "teal";
    default:
      return "paper";
  }
}

interface PriorityMatrixProps {
  points: QueuePriorityPoint[];
  selectedMatchId: string;
  onSelect: (matchId: string) => void;
  highlightTerms?: string[];
}

export function PriorityMatrix({
  points,
  selectedMatchId,
  onSelect,
  highlightTerms = []
}: PriorityMatrixProps) {
  // Wave B: matrix cells are glance-and-drill. Single click previews the
  // case in the case lens; double click (or Ctrl/Cmd+Enter when focused)
  // opens the review workbench. The tooltip shows patient / trial / score /
  // why-now so hoverers never have to guess which bubble is which.
  const navigate = useNavigate();

  return (
    <section className="surface visual-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Dominant view</p>
          <h3>Priority matrix</h3>
          <p>Urgency climbs upward. Actionability moves right. Haloed cases changed overnight. Double-click to open the review workbench.</p>
        </div>
        <div className="visual-legend">
          <span><i className="legend-swatch legend-swatch--moss" /> Outreach-ready</span>
          <span><i className="legend-swatch legend-swatch--amber" /> Needs PI review</span>
          <span><i className="legend-swatch legend-swatch--brick" /> Blocked</span>
        </div>
      </div>

      <div className="priority-matrix">
        <div className="priority-matrix__labels priority-matrix__labels--x">
          <span>Blocked</span>
          <span>Actionable now</span>
        </div>
        <div className="priority-matrix__labels priority-matrix__labels--y">
          <span>Higher urgency</span>
          <span>Lower urgency</span>
        </div>

        <div className="priority-matrix__plot" role="list" aria-label="Queue priority matrix">
          <div className="priority-matrix__grid" aria-hidden="true" />
          {points.map((point) => {
            const isSelected = point.matchId === selectedMatchId;
            const isHighlighted = matchesHighlightTerms(
              `${point.label} ${point.detail} ${point.item.whyNow ?? ""} ${point.item.flags.join(" ")}`,
              highlightTerms
            );

            return (
              <Tooltip key={point.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`priority-matrix__point priority-matrix__point--${point.disposition} ${
                      isSelected ? "priority-matrix__point--selected" : ""
                    } ${isHighlighted ? "priority-matrix__point--highlighted" : ""}`}
                    style={{
                      left: `${point.x}%`,
                      top: `${100 - point.y}%`,
                      width: `${point.radius * 2}px`,
                      height: `${point.radius * 2}px`
                    }}
                    onClick={() => onSelect(point.matchId)}
                    onDoubleClick={() => navigate(`/review/${point.matchId}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        navigate(`/review/${point.matchId}`);
                      }
                    }}
                    aria-label={`${point.patientName}, ${point.trialLabel}, ${humanize(point.disposition)}. Click to preview, double-click to open review.`}
                  >
                    {point.changedOvernight ? (
                      <span className="priority-matrix__halo" aria-hidden="true" />
                    ) : null}
                    <span className="priority-matrix__label">
                      {point.trialLabel}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="priority-matrix__tooltip">
                    <strong>{point.patientName}</strong>
                    <span>{point.trialLabel} &middot; score {point.item.score}</span>
                    <span>{humanize(point.disposition)}</span>
                    {point.item.whyNow ? <em>{point.item.whyNow}</em> : null}
                    <span className="priority-matrix__tooltip-hint">Double-click to open review</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface QueueCompactListProps {
  points: QueuePriorityPoint[];
  selectedMatchId: string;
  onSelect: (matchId: string) => void;
  highlightTerms?: string[];
}

export function QueueCompactList({
  points,
  selectedMatchId,
  onSelect,
  highlightTerms = []
}: QueueCompactListProps) {
  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Exact detail</p>
          <h3>Queue companion list</h3>
        </div>
      </div>

      <div className="queue-compact-list">
        {points.map((point) => {
          const item = point.item;
          const isSelected = item.matchId === selectedMatchId;
          const isHighlighted = matchesHighlightTerms(
            `${point.patientName} ${item.whyNow ?? ""} ${item.recommendedAction ?? ""}`,
            highlightTerms
          );

          return (
            <button
              key={item.matchId}
              type="button"
              className={`queue-compact-card ${isSelected ? "queue-compact-card--selected" : ""} ${
                isHighlighted ? "queue-compact-card--highlighted" : ""
              }`}
              onClick={() => onSelect(item.matchId)}
            >
              <div className="queue-compact-card__top">
                <div>
                  <strong>{point.patientName}</strong>
                  <p>{point.trialLabel} | score {item.score}</p>
                </div>
                <StatusChip label={humanize(item.nextStep)} tone={toneForDisposition(item.nextStep)} compact />
              </div>
              <p>{item.whyNow}</p>
              <div className="queue-compact-card__meta">
                <span>{item.owner}</span>
                <span>{item.timeInQueue ?? item.lastUpdated}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface StoryRailProps {
  items: StoryRailItem[];
  selectedMatchId: string;
  onSelect: (matchId: string) => void;
}

export function StoryRail({ items, selectedMatchId, onSelect }: StoryRailProps) {
  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Narrative proof</p>
          <h3>Story rail</h3>
        </div>
      </div>

      <div className="story-rail">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`story-rail__card ${
              item.matchId === selectedMatchId ? "story-rail__card--active" : ""
            }`}
            onClick={() => onSelect(item.matchId)}
          >
            <span>{item.category}</span>
            <strong>{item.title}</strong>
            <p>{item.wowFactor}</p>
            <div className="story-rail__meta">
              <span>{item.promise}</span>
              <span>{item.managerMetric}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

interface CaseLensProps {
  patient?: Patient;
  trial?: Trial;
  item?: QueueItem;
  match?: MatchRecommendation;
  story?: StoryRailItem;
  highlightTerms?: string[];
}

export function CaseLens({
  patient,
  trial,
  item,
  match,
  story,
  highlightTerms = []
}: CaseLensProps) {
  if (!patient || !trial || !item || !match) {
    return (
      <section className="surface">
        <p>Select a case from the matrix or story rail.</p>
      </section>
    );
  }

  const isHighlighted = matchesHighlightTerms(
    `${patient.name} ${item.whyNow ?? ""} ${item.recommendedAction ?? ""} ${match.blockers.join(" ")}`,
    highlightTerms
  );

  return (
    <section className={`surface case-lens ${isHighlighted ? "case-lens--highlighted" : ""}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Selected case</p>
          <h3>{patient.name}</h3>
          <p>{patient.diagnosis}</p>
        </div>
        <StatusChip label={item.priority} tone={toneForPriority(item.priority)} />
      </div>

      <div className="case-lens__score">
        <div
          className="case-lens__score-ring"
          style={{ ["--fit" as string]: match.fitScore }}
        >
          <strong>{match.fitScore}</strong>
          <span>fit</span>
        </div>
        <div className="case-lens__score-copy">
          <strong>{trial.shortCode} | {trial.phase}</strong>
          <p>{item.whyNow}</p>
        </div>
      </div>

      <div className="case-lens__strip">
        <div>
          <span>Next action</span>
          <strong>{item.recommendedAction}</strong>
        </div>
        <div>
          <span>Manager metric</span>
          <strong>{story?.managerMetric ?? match.managerMetric ?? "Queue throughput"}</strong>
        </div>
        <div>
          <span>Time in queue</span>
          <strong>{item.timeInQueue ?? item.lastUpdated}</strong>
        </div>
      </div>

      <div className="case-lens__blockers">
        {(match.blockers.length ? match.blockers : ["No active blockers"]).map((blocker) => (
          <div key={blocker} className="case-lens__blocker">
            <span />
            <p>{blocker}</p>
          </div>
        ))}
      </div>

      <div className="case-lens__footer">
        <div className="stacked-chips">
          {patient.summaryFlags.map((flag) => (
            <StatusChip key={flag} label={flag} tone="paper" compact />
          ))}
        </div>
        <Link className="primary-button primary-button--inline" to={`/review/${item.matchId}`}>
          Open review workbench
        </Link>
      </div>
    </section>
  );
}
