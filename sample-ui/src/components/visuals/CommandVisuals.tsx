import { Group } from "@visx/group";
import { scaleLinear, scalePoint } from "@visx/scale";
import { matchesHighlightTerms } from "../../lib/visualAdapters";
import type {
  HotspotPoint,
  HotspotRankedItem,
  PortfolioStageMetric,
  ReadinessStep,
  TaskModeCard
} from "../../types";
import { StatusChip } from "../StatusChip";

function guardrailTone(status: ReadinessStep["status"]) {
  switch (status) {
    case "on_track":
      return "moss";
    case "watch":
      return "amber";
    default:
      return "brick";
  }
}

interface ConversionFunnelFlowProps {
  funnel: Array<{ label: string; value: number }>;
}

export function ConversionFunnelFlow({ funnel }: ConversionFunnelFlowProps) {
  const width = 820;
  const height = 250;
  const padding = 56;
  const maxValue = Math.max(...funnel.map((item) => item.value));
  const xScale = scalePoint<string>({
    domain: funnel.map((item) => item.label),
    range: [padding, width - padding]
  });
  const sizeScale = scaleLinear<number>({
    domain: [0, maxValue],
    range: [54, 18]
  });

  return (
    <section className="surface visual-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Dominant view</p>
          <h3>Conversion funnel flow</h3>
          <p>Connected stage widths show where coordinator effort compresses into enrollment.</p>
        </div>
        <StatusChip label="visx flow" tone="paper" compact />
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="flow-chart" role="img" aria-label="Screening to enrolled conversion funnel">
        <defs>
          <linearGradient id="funnelGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#0f5c62" />
            <stop offset="100%" stopColor="#8bb6aa" />
          </linearGradient>
        </defs>

        <Group top={24}>
          {funnel.map((metric, index) => {
            const centerX = xScale(metric.label) ?? padding;
            const halfHeight = sizeScale(metric.value);
            const previous = funnel[index - 1];
            const next = funnel[index + 1];
            const previousHeight = previous ? sizeScale(previous.value) : halfHeight;
            const nextHeight = next ? sizeScale(next.value) : halfHeight;

            const leftX = index === 0 ? centerX - 48 : (centerX + (xScale(previous.label) ?? centerX)) / 2;
            const rightX =
              index === funnel.length - 1
                ? centerX + 48
                : (centerX + (xScale(next.label) ?? centerX)) / 2;

            const path = [
              `M ${leftX} ${110 - previousHeight}`,
              `L ${centerX} ${110 - halfHeight}`,
              `L ${rightX} ${110 - nextHeight}`,
              `L ${rightX} ${110 + nextHeight}`,
              `L ${centerX} ${110 + halfHeight}`,
              `L ${leftX} ${110 + previousHeight}`,
              "Z"
            ].join(" ");

            return (
              <g key={metric.label}>
                <path d={path} fill="url(#funnelGradient)" opacity={0.16 + index * 0.09} />
                <circle cx={centerX} cy={110} r={halfHeight + 6} fill="rgba(15, 92, 98, 0.08)" />
                <circle cx={centerX} cy={110} r={halfHeight - 2} fill="rgba(255, 250, 243, 0.95)" stroke="rgba(15, 92, 98, 0.24)" />
                <text x={centerX} y={106} textAnchor="middle" className="flow-chart__value">
                  {metric.value}
                </text>
                <text x={centerX} y={126} textAnchor="middle" className="flow-chart__label">
                  {metric.label}
                </text>
              </g>
            );
          })}
        </Group>
      </svg>
    </section>
  );
}

interface HotspotQuadrantProps {
  points: HotspotPoint[];
  selectedId: string;
  onSelect: (id: string) => void;
  highlightTerms?: string[];
  embedded?: boolean;
}

export function HotspotQuadrant({
  points,
  selectedId,
  onSelect,
  highlightTerms = [],
  embedded = false
}: HotspotQuadrantProps) {
  return (
    <section className={`surface visual-panel ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Supporting view</p>
          <h3>Operational friction map</h3>
          <p>Each dot is a criterion family. Higher means more unresolved uncertainty. Farther right means reviewers override the system more often. Use the ranked list to see what to fix first.</p>
        </div>
      </div>

      <div className="hotspot-quadrant">
        <div className="hotspot-quadrant__grid" aria-hidden="true" />
        <div className="hotspot-quadrant__zone hotspot-quadrant__zone--upper-left">Data gap</div>
        <div className="hotspot-quadrant__zone hotspot-quadrant__zone--upper-right">Fix first</div>
        <div className="hotspot-quadrant__zone hotspot-quadrant__zone--lower-left">Stable</div>
        <div className="hotspot-quadrant__zone hotspot-quadrant__zone--lower-right">Policy mismatch</div>
        <div className="hotspot-quadrant__axis hotspot-quadrant__axis--x">
          <span>Lower override</span>
          <span>Higher override</span>
        </div>
        <div className="hotspot-quadrant__axis hotspot-quadrant__axis--y">
          <span>Higher uncertainty</span>
          <span>Lower uncertainty</span>
        </div>

        {points.map((point) => {
          const isSelected = point.id === selectedId;
          const isHighlighted = matchesHighlightTerms(
            `${point.family} ${point.hotspot}`,
            highlightTerms
          );

          return (
            <button
              key={point.id}
              type="button"
              className={`hotspot-quadrant__point hotspot-quadrant__point--${point.tone} ${
                isSelected ? "hotspot-quadrant__point--selected" : ""
              } ${isHighlighted ? "hotspot-quadrant__point--highlighted" : ""}`}
              style={{
                left: `${Math.max(10, point.overrideRate)}%`,
                top: `${100 - Math.max(10, point.uncertainRate)}%`
              }}
              onClick={() => onSelect(point.id)}
            >
              <span>{point.family}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface FixFirstRankingProps {
  items: HotspotRankedItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  embedded?: boolean;
}

export function FixFirstRanking({
  items,
  selectedId,
  onSelect,
  embedded = false
}: FixFirstRankingProps) {
  const rankedItems = items.filter((item) => !item.isManualBoundary);
  const boundaryItems = items.filter((item) => item.isManualBoundary);

  return (
    <section className={`surface visual-panel ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Companion view</p>
          <h3>Fix-first ranking</h3>
          <p>Same signal as the map, sorted by operational drag so first-time viewers can see what to tackle first.</p>
        </div>
      </div>

      <div className="hotspot-ranking">
        {rankedItems.map((item, index) => {
          const isSelected = item.id === selectedId;

          return (
            <button
              key={item.id}
              type="button"
              className={`hotspot-ranking__item ${
                isSelected ? "hotspot-ranking__item--selected" : ""
              }`}
              onClick={() => onSelect(item.id)}
            >
              <div className="hotspot-ranking__top">
                <div className="hotspot-ranking__title-row">
                  <span className="hotspot-ranking__order">{index + 1}</span>
                  <strong>{item.family}</strong>
                </div>
                <StatusChip label={item.interpretationLabel} tone={item.tone} compact />
              </div>
              <div className="hotspot-ranking__metrics">
                <span>Uncertainty {item.uncertaintyRate}%</span>
                <span>Override {item.overrideRate}%</span>
                <span>Drag score {item.operationalDragScore}</span>
              </div>
              <p className="hotspot-ranking__why">{item.whyItMatters}</p>
              <p className="hotspot-ranking__action">{item.actionLabel}</p>
            </button>
          );
        })}
      </div>

      {boundaryItems.length ? (
        <div className="hotspot-boundary-group">
          <div className="panel-heading panel-heading--tight">
            <div>
              <p className="eyebrow-label">Separate from ranking</p>
              <h3>Human-review boundaries</h3>
            </div>
          </div>

          <div className="hotspot-ranking">
            {boundaryItems.map((item) => {
              const isSelected = item.id === selectedId;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`hotspot-ranking__item hotspot-ranking__item--boundary ${
                    isSelected ? "hotspot-ranking__item--selected" : ""
                  }`}
                  onClick={() => onSelect(item.id)}
                >
                  <div className="hotspot-ranking__top">
                    <div className="hotspot-ranking__title-row">
                      <span className="hotspot-ranking__order hotspot-ranking__order--boundary">B</span>
                      <strong>{item.family}</strong>
                    </div>
                    <StatusChip label={item.interpretationLabel} tone="paper" compact />
                  </div>
                  <div className="hotspot-ranking__metrics">
                    <span>Uncertainty {item.uncertaintyRate}%</span>
                    <span>Override {item.overrideRate}%</span>
                    <span>Governed boundary</span>
                  </div>
                  <p className="hotspot-ranking__why">{item.whyItMatters}</p>
                  <p className="hotspot-ranking__action">{item.actionLabel}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface TrialPortfolioStripProps {
  metrics: PortfolioStageMetric[];
  selectedTrialId: string;
  onSelect: (trialId: string) => void;
  embedded?: boolean;
}

export function TrialPortfolioStrip({
  metrics,
  selectedTrialId,
  onSelect,
  embedded = false
}: TrialPortfolioStripProps) {
  return (
    <section className={`surface ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Trial portfolio</p>
          <h3>Portfolio strip</h3>
        </div>
      </div>

      <div className="portfolio-strip">
        {metrics.map((metric) => {
          const isSelected = metric.trialId === selectedTrialId;
          const max = Math.max(metric.screened, 1);

          return (
            <button
              key={metric.trialId}
              type="button"
              className={`portfolio-strip__card ${
                isSelected ? "portfolio-strip__card--selected" : ""
              }`}
              onClick={() => onSelect(metric.trialId)}
            >
              <div className="portfolio-strip__top">
                <strong>{metric.shortCode}</strong>
                <span>{metric.trial.phase}</span>
              </div>
              <div className="portfolio-strip__bars">
                <div style={{ width: "100%" }} />
                <div style={{ width: `${(metric.piEscalations / max) * 100}%` }} />
                <div style={{ width: `${(metric.outreachReady / max) * 100}%` }} />
                <div style={{ width: `${(metric.enrolled / max) * 100}%` }} />
              </div>
              <div className="portfolio-strip__meta">
                <span>{metric.screened} screened</span>
                <span>{metric.enrolled} enrolled</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface ReadinessLadderProps {
  steps: ReadinessStep[];
  embedded?: boolean;
}

export function ReadinessLadder({
  steps,
  embedded = false
}: ReadinessLadderProps) {
  return (
    <section className={`surface ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Pilot guardrails</p>
          <h3>Readiness ladder</h3>
        </div>
      </div>

      <div className="readiness-ladder">
        {steps.map((step, index) => (
          <article key={step.id} className="readiness-ladder__step">
            <div className="readiness-ladder__node">
              <span>{index + 1}</span>
            </div>
            <div className="readiness-ladder__copy">
              <div className="card-row">
                <strong>{step.label}</strong>
                <StatusChip label={step.status.replace(/_/g, " ")} tone={guardrailTone(step.status)} compact />
              </div>
              <p>{step.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface LoadRibbonProps {
  items: Array<TaskModeCard & { liveCases: number }>;
  embedded?: boolean;
}

export function LoadRibbon({
  items,
  embedded = false
}: LoadRibbonProps) {
  const maxCases = Math.max(...items.map((item) => item.liveCases), 1);

  return (
    <section className={`surface ${embedded ? "surface--embedded" : ""}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Operator feel</p>
          <h3>Load ribbon</h3>
        </div>
      </div>

      <div className="load-ribbon">
        {items.map((item) => (
          <article key={item.id} className="load-ribbon__item">
            <div className="load-ribbon__top">
              <strong>{item.label}</strong>
              <span>{item.liveCases} live</span>
            </div>
            <div className="load-ribbon__bar">
              <span style={{ width: `${(item.liveCases / maxCases) * 100}%` }} />
            </div>
            <p>{item.promise}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
