import { matchesHighlightTerms } from "../../lib/visualAdapters";
import type {
  CoverageCompositionBarModel,
  ProvenanceGroup,
  TraceNode
} from "../../types";
import { StatusChip } from "../StatusChip";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives";

function toneForStage(stage: TraceNode["stage"]) {
  switch (stage) {
    case "ingest":
      return "teal";
    case "evaluate":
      return "amber";
    case "review":
      return "paper";
    default:
      return "moss";
  }
}

interface DecisionTraceRailProps {
  nodes: TraceNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  highlightTerms?: string[];
}

export function DecisionTraceRail({
  nodes,
  selectedId,
  onSelect,
  highlightTerms = []
}: DecisionTraceRailProps) {
  return (
    <section className="surface visual-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Dominant view</p>
          <h3>Decision trace rail</h3>
          <p>Follow the case from screening job through evaluation to finalized queue state.</p>
        </div>
      </div>

      <div className="decision-trace-rail">
        {nodes.map((node) => {
          const isSelected = node.id === selectedId;
          const isHighlighted = matchesHighlightTerms(
            `${node.summary} ${node.actor} ${node.label}`,
            highlightTerms
          );

          return (
            <button
              key={node.id}
              type="button"
              className={`decision-trace-rail__node ${
                isSelected ? "decision-trace-rail__node--selected" : ""
              } ${isHighlighted ? "decision-trace-rail__node--highlighted" : ""}`}
              onClick={() => onSelect(node.id)}
            >
              <div className="decision-trace-rail__marker">
                <StatusChip label={node.stage} tone={toneForStage(node.stage)} compact />
              </div>
              <div className="decision-trace-rail__copy">
                <div className="card-row">
                  <strong>{node.label}</strong>
                  <span>{node.timestamp}</span>
                </div>
                <p>{node.summary}</p>
                <div className="decision-trace-rail__meta">
                  <span>{node.actor}</span>
                  <span>{node.event.ruleVersion}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface CoverageCompositionBarProps {
  model: CoverageCompositionBarModel;
}

export function CoverageCompositionBar({ model }: CoverageCompositionBarProps) {
  const freshWidth = (model.fresh / model.total) * 100;
  const agingWidth = (model.agingOrMissing / model.total) * 100;
  const contradictionWidth = (model.contradictions / model.total) * 100;

  // Wave B — each bar segment gets a Radix Tooltip with the raw record count
  // + percentage so a reviewer can read the actual coverage math instead of
  // just the visual proportions. Zero-count segments still render to preserve
  // layout math but surface "0 records" in the popover.
  const segments: Array<{
    key: string;
    modifier: "fresh" | "aging" | "contradiction";
    label: string;
    count: number;
    width: number;
  }> = [
    { key: "fresh", modifier: "fresh", label: "Fresh evidence", count: model.fresh, width: freshWidth },
    { key: "aging", modifier: "aging", label: "Aging or missing", count: model.agingOrMissing, width: agingWidth },
    { key: "contradiction", modifier: "contradiction", label: "Contradictions", count: model.contradictions, width: contradictionWidth }
  ];

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Replay coverage</p>
          <h3>Coverage composition</h3>
        </div>
      </div>

      <div className="coverage-composition">
        <div className="coverage-composition__bar" aria-label="Coverage composition">
          {segments.map((segment) => (
            <Tooltip key={segment.key}>
              <TooltipTrigger asChild>
                <span
                  className={`coverage-composition__bar-segment coverage-composition__bar-segment--${segment.modifier}`}
                  style={{ width: `${segment.width}%` }}
                  tabIndex={0}
                  aria-label={`${segment.label}: ${segment.count} records, ${segment.width.toFixed(0)} percent`}
                />
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                <div className="coverage-composition__tooltip">
                  <strong>{segment.label}</strong>
                  <span>
                    {segment.count} records · {segment.width.toFixed(0)}%
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="coverage-composition__legend">
          <span><i className="legend-swatch legend-swatch--moss" /> Fresh evidence</span>
          <span><i className="legend-swatch legend-swatch--amber" /> Aging or missing</span>
          <span><i className="legend-swatch legend-swatch--brick" /> Contradictions</span>
        </div>
      </div>
    </section>
  );
}

interface ProvenanceRiverProps {
  groups: ProvenanceGroup[];
  highlightTerms?: string[];
  embedded?: boolean;
}

export function ProvenanceRiver({
  groups,
  highlightTerms = [],
  embedded = false
}: ProvenanceRiverProps) {
  return (
    <section
      className={`surface visual-panel ${embedded ? "surface--embedded" : ""}`.trim()}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Supporting view</p>
          <h3>Provenance river</h3>
          <p>Grouped by source system so a reviewer can see which evidence channels shaped the result.</p>
        </div>
      </div>

      <div className="provenance-river">
        {groups.map((group) => {
          const isHighlighted = matchesHighlightTerms(
            `${group.label} ${group.items.map((item) => item.sourceDocument).join(" ")}`,
            highlightTerms
          );

          return (
            <article
              key={group.id}
              className={`provenance-river__group ${
                isHighlighted ? "provenance-river__group--highlighted" : ""
              }`}
            >
              <div className="provenance-river__group-head">
                <div>
                  <strong>{group.label}</strong>
                  <p>Freshest: {group.freshestDate}</p>
                </div>
                <div className="stacked-chips">
                  {group.supportingCount ? <StatusChip label={`${group.supportingCount} support`} tone="moss" compact /> : null}
                  {group.contradictingCount ? <StatusChip label={`${group.contradictingCount} conflict`} tone="brick" compact /> : null}
                  {group.contextCount ? <StatusChip label={`${group.contextCount} context`} tone="paper" compact /> : null}
                </div>
              </div>
              <div className="provenance-river__stream">
                {group.items.map((item) => (
                  <div key={item.id} className={`provenance-river__drop provenance-river__drop--${item.tone}`}>
                    <strong>{item.type}</strong>
                    <span>{item.sourceDate}</span>
                    <p>{item.sourceDocument}</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
