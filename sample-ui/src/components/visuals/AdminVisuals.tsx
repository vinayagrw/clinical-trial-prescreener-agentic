import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useRef } from "react";
import { matchesHighlightTerms } from "../../lib/visualAdapters";
import type {
  ApiEndpointContract,
  ComputabilityCell,
  EntityContract,
  IntegrationFeed,
  NormalizedCriterion,
  ProtocolTimelineItem
} from "../../types";
import { StatusChip } from "../StatusChip";

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

function toneForComputability(computability: ComputabilityCell["computability"]) {
  switch (computability) {
    case "deterministic":
      return "moss";
    case "hybrid":
      return "amber";
    default:
      return "brick";
  }
}

interface ComputabilityGridProps {
  cells: ComputabilityCell[];
  selectedCellId: string;
  onSelect: (id: string) => void;
}

export function ComputabilityGrid({
  cells,
  selectedCellId,
  onSelect
}: ComputabilityGridProps) {
  return (
    <section className="surface visual-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Dominant view</p>
          <h3>Computability grid</h3>
          <p>Cross type against computability to show where automation is strong and where judgment still sits.</p>
        </div>
      </div>

      <div className="computability-grid">
        {cells.map((cell) => (
          <button
            key={cell.id}
            type="button"
            className={`computability-grid__cell ${
              cell.id === selectedCellId ? "computability-grid__cell--selected" : ""
            }`}
            onClick={() => onSelect(cell.id)}
          >
            <div className="card-row">
              <strong>{humanize(cell.type)}</strong>
              <StatusChip label={humanize(cell.computability)} tone={toneForComputability(cell.computability)} compact />
            </div>
            <span>{cell.count} criteria</span>
          </button>
        ))}
      </div>
    </section>
  );
}

interface CriteriaInspectorProps {
  criteria: NormalizedCriterion[];
}

export function CriteriaInspector({ criteria }: CriteriaInspectorProps) {
  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Filtered inspector</p>
          <h3>Structured eligibility objects</h3>
        </div>
      </div>

      <div className="criteria-inspector">
        {/* Wave B — each criterion is a native <details> so reviewers can
           collapse and expand rows without JS. Open by default so a first-time
           viewer never sees a hidden card, and staggered via --i so long lists
           cascade in instead of popping at once. */}
        {criteria.map((criterion, index) => (
          <details
            key={criterion.id}
            open
            className="criteria-inspector__row"
            style={{ ["--i" as string]: index }}
          >
            <summary className="criteria-inspector__row-head">
              <strong>{criterion.label}</strong>
              <StatusChip label={criterion.type} tone="paper" compact />
              <span className="criteria-inspector__row-caret" aria-hidden="true">
                <svg viewBox="0 0 12 12" width="10" height="10">
                  <path
                    d="M3 5l3 3 3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </summary>
            <div className="criteria-inspector__row-body">
              <p>{criterion.threshold}</p>
              <div className="criteria-inspector__meta">
                <span>{humanize(criterion.computability)}</span>
                {criterion.criterionCategory ? (
                  <span>{humanize(criterion.criterionCategory)}</span>
                ) : null}
                {criterion.countsTowardAutomationReadiness === false ? (
                  <span>onboarding context</span>
                ) : null}
                <span>{criterion.owner}</span>
              </div>
              {criterion.note ? (
                <p style={{ marginTop: "var(--space-2)", opacity: 0.72 }}>
                  {criterion.note}
                </p>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

interface ProtocolTimelineProps {
  items: ProtocolTimelineItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ProtocolTimeline({
  items,
  selectedId,
  onSelect
}: ProtocolTimelineProps) {
  // Wave B — keyboard-nav refs. Each button registers into an index so
  // ArrowUp/Down/Home/End can move focus + selection without leaving the
  // timeline. Native Tab still walks out of the list normally.
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusItem = useCallback(
    (index: number) => {
      if (!items.length) return;
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const target = itemRefs.current[clamped];
      if (target) {
        target.focus();
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
        onSelect(items[clamped].id);
      }
    },
    [items, onSelect]
  );

  const handleKey = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          focusItem(index + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusItem(index - 1);
          break;
        case "Home":
          event.preventDefault();
          focusItem(0);
          break;
        case "End":
          event.preventDefault();
          focusItem(items.length - 1);
          break;
      }
    },
    [focusItem, items.length]
  );

  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Version history</p>
          <h3>Protocol timeline</h3>
        </div>
      </div>

      <div
        className="protocol-timeline"
        role="listbox"
        aria-label="Protocol versions"
        aria-orientation="vertical"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            role="option"
            aria-selected={item.id === selectedId}
            tabIndex={item.id === selectedId || (!selectedId && index === 0) ? 0 : -1}
            className={`protocol-timeline__item ${
              item.id === selectedId ? "protocol-timeline__item--selected" : ""
            }`}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => handleKey(event, index)}
          >
            <div className="protocol-timeline__node" />
            <div className="protocol-timeline__copy">
              <div className="card-row">
                <strong>{item.version}</strong>
                <StatusChip label={item.status} tone="paper" compact />
              </div>
              <span>{item.releasedAt}</span>
              <p>{item.summary}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

interface SourceServiceBlueprintProps {
  feeds: IntegrationFeed[];
  endpoints: ApiEndpointContract[];
  entities: EntityContract[];
  highlightTerms?: string[];
}

export function SourceServiceBlueprint({
  feeds,
  endpoints,
  entities,
  highlightTerms = []
}: SourceServiceBlueprintProps) {
  const entitySlice = entities.slice(0, 4);
  const endpointSlice = endpoints.slice(0, 4);

  return (
    <section className="surface visual-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Platform foundation</p>
          <h3>Source-to-service blueprint</h3>
          <p>Feeds land on the left, services in the middle, and durable interfaces on the right.</p>
        </div>
      </div>

      <div className="blueprint-diagram">
        <div className="blueprint-diagram__column">
          <span className="blueprint-diagram__title">Feeds</span>
          {feeds.map((feed) => (
            <article
              key={feed.name}
              className={`blueprint-diagram__node ${
                matchesHighlightTerms(`${feed.name} ${feed.role}`, highlightTerms)
                  ? "blueprint-diagram__node--highlighted"
                  : ""
              }`}
            >
              <strong>{feed.name}</strong>
              <p>{feed.role}</p>
            </article>
          ))}
        </div>
        <div className="blueprint-diagram__flow" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="blueprint-diagram__column">
          <span className="blueprint-diagram__title">Services</span>
          {endpointSlice.map((endpoint) => (
            <article key={endpoint.path} className="blueprint-diagram__node blueprint-diagram__node--service">
              <strong>{endpoint.owner}</strong>
              <p>{endpoint.method} {endpoint.path}</p>
            </article>
          ))}
        </div>
        <div className="blueprint-diagram__flow" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="blueprint-diagram__column">
          <span className="blueprint-diagram__title">Entities</span>
          {entitySlice.map((entity) => (
            <article key={entity.name} className="blueprint-diagram__node blueprint-diagram__node--entity">
              <strong>{entity.name}</strong>
              <p>{entity.purpose}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

interface ReleaseGateStripProps {
  items: string[];
}

export function ReleaseGateStrip({ items }: ReleaseGateStripProps) {
  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Release controls</p>
          <h3>Release gate strip</h3>
        </div>
      </div>

      <div className="release-gate-strip">
        {items.map((item, index) => (
          <article key={item} className="release-gate-strip__item">
            <span>{index + 1}</span>
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
