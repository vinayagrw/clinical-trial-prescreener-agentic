import { startTransition, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import {
  FixFirstRanking,
  HotspotQuadrant,
  LoadRibbon,
  ReadinessLadder,
  TrialPortfolioStrip
} from "../components/visuals/CommandVisuals";
import { MetricCard } from "../components/MetricCard";
import { StatusChip } from "../components/StatusChip";
import { FunnelPerformance } from "../features/command-center/components/viz/FunnelPerformance";
import { HotspotHeatmap } from "../features/command-center/components/viz/HotspotHeatmap";
import { TrialPortfolioParallel } from "../features/command-center/components/viz/TrialPortfolioParallel";
import {
  buildHotspotPoints,
  buildHotspotRankedItems,
  buildLoadRibbon,
  buildPortfolioStageMetrics,
  buildReadinessSteps
} from "../lib/visualAdapters";
import {
  getEnrollmentFunnel,
  getOpsInsights,
  getScreeningMetrics,
  rolloutGuardrails
} from "../data/mockApi";
import { taskModeCards, trialMetricCards } from "../data/platformData";
import { getVisibleQueueItems, metricTrends, trials } from "../data/mockData";
import { useVisualFocusStore } from "../stores/visualFocus";

// Stable reference to avoid useSyncExternalStore infinite-loop detection
// when the selector's fallback branch fires.
// Never mutated - reference-stable shared fallback used when the visual
// focus store points at a different route.
const EMPTY_TERMS: string[] = [];

export function CommandCenterPage() {
  const [selectedTrialId, setSelectedTrialId] = useState("trial-001");
  const screeningMetrics = getScreeningMetrics();
  const enrollmentFunnel = getEnrollmentFunnel();
  const opsInsights = getOpsInsights();
  const visibleQueueItems = getVisibleQueueItems();
  const hotspotPoints = useMemo(
    () => buildHotspotPoints(opsInsights.hotspots),
    [opsInsights.hotspots]
  );
  const hotspotRankedItems = useMemo(
    () => buildHotspotRankedItems(opsInsights.hotspots),
    [opsInsights.hotspots]
  );
  const [selectedHotspotId, setSelectedHotspotId] = useState(
    hotspotPoints[0]?.id ?? ""
  );
  const portfolioMetrics = useMemo(
    () => buildPortfolioStageMetrics(trials, trialMetricCards),
    []
  );
  const selectedTrialMetric =
    portfolioMetrics.find((metric) => metric.trialId === selectedTrialId) ??
    portfolioMetrics[0];
  const selectedHotspot =
    hotspotPoints.find((point) => point.id === selectedHotspotId) ??
    hotspotPoints[0];
  const selectedHotspotRanking =
    hotspotRankedItems.find((item) => item.id === selectedHotspotId) ??
    hotspotRankedItems[0];
  const readinessSteps = buildReadinessSteps(rolloutGuardrails);
  const loadRibbonItems = buildLoadRibbon(taskModeCards, visibleQueueItems);
  const routeKind = useVisualFocusStore((state) => state.routeKind);
  const storeTerms = useVisualFocusStore((state) => state.terms);
  const highlightTerms = routeKind === "command_center" ? storeTerms : EMPTY_TERMS;

    return (
      <AppShell
        title="Trial Command Center"
        subtitle="Portfolio analytics now read as one denser operations workspace: funnel pressure, operational friction, portfolio performance, and pilot guardrails in a single command surface."
      >
      {/* Wave D.2 — Command Center density pass. The old .command-dashboard
         2-col grid left 1983px of blank vertical space in the overview
         column next to the much-taller friction column. .command-board
         flows overview / friction / portfolio top-to-bottom in the main
         left column and parks the rollout-guardrail/queue-load strip as a
         sticky right sidebar visible across every row. */}
      <div className="command-board">
        <div className="command-board__overview">
          <section className="surface command-metric-strip">
            <div className="panel-heading">
              <div>
                <p className="eyebrow-label">Pilot pulse</p>
                <h3>Live queue pressure sits beside the funnel</h3>
              </div>
            </div>

            <div className="metric-grid metric-grid--four">
              <MetricCard
                label="Median review time"
                value={screeningMetrics.medianReviewTime}
                detail="31 percent faster than baseline"
                trend={metricTrends["median-review-time-min"]}
                trendLabel="Median review time, 14-day trend"
              />
              <MetricCard
                label="Reviewed today"
                value={`${screeningMetrics.reviewedToday}`}
                detail="Live queue throughput across the pilot"
                trend={metricTrends["reviewed-today"]}
                trendLabel="Reviewed today, 14-day trend"
              />
              <MetricCard
                label="Need PI review"
                value={`${screeningMetrics.needsPiReview}`}
                detail="Current escalation load"
                trend={metricTrends["needs-pi-review"]}
                trendLabel="Need PI review, 14-day trend"
              />
              <MetricCard
                label="False exclusion review"
                value={screeningMetrics.falseExclusionRate}
                detail={enrollmentFunnel.recoveredCapacity}
                trend={metricTrends["false-exclusion-rate"]}
                trendLabel="False exclusion rate, 14-day trend"
              />
            </div>
          </section>

          <FunnelPerformance
            funnel={enrollmentFunnel.funnel}
            recoveredCapacity={enrollmentFunnel.recoveredCapacity}
          />

          {/* Relocated from the friction section — the HotspotQuadrant now
             sits directly below the enrollment funnel as a full-width
             surface (non-embedded so it matches FunnelPerformance's layout).
             Same component, same props, same interactions: clicking a dot
             still updates selectedHotspotId which drives the focus card in
             the sticky support sidebar on the right. */}
          <HotspotQuadrant
            points={hotspotPoints}
            selectedId={selectedHotspot?.id ?? ""}
            onSelect={setSelectedHotspotId}
            highlightTerms={highlightTerms}
          />
        </div>

        <section className="surface command-board__friction command-workspace command-workspace--friction">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Operational friction workspace</p>
              <h3>Hotspots, reviewer churn, and fix-first action stay in one view</h3>
              <p className="panel-copy">
                Heatmap, friction map, ranked families, and reviewer friction now
                stay in one dense workspace so teams can move from diagnosis to
                action without scanning down a long blank column.
              </p>
            </div>
            <StatusChip
              label={`${hotspotRankedItems.filter((item) => !item.isManualBoundary).length} ranked families`}
              tone="paper"
              compact
            />
          </div>

          <div className="command-workspace__heatmap">
            <HotspotHeatmap rows={opsInsights.hotspots} embedded />
          </div>

          {/* The operational friction map (HotspotQuadrant) was relocated
             to the overview section, directly below the enrollment funnel.
             The friction section now only holds the heatmap + ranking, so
             its grid simplifies to 2 content rows. Focus card + override
             clustering remain in the sticky support sidebar on the right. */}
          <div className="command-workspace__rail">
            <FixFirstRanking
              items={hotspotRankedItems}
              selectedId={selectedHotspot?.id ?? ""}
              onSelect={setSelectedHotspotId}
              embedded
            />
          </div>
        </section>

        <section className="surface command-board__portfolio command-workspace command-workspace--portfolio">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Portfolio performance</p>
              <h3>Compare all trials, then drop straight into the focused blocker</h3>
              <p className="panel-copy">
                The parallel view shows the whole portfolio; the strip and focused
                detail turn the same data into next-trial action without burning a
                second column.
              </p>
            </div>
            <StatusChip
              label={`${portfolioMetrics.length} tracked trials`}
              tone="paper"
              compact
            />
          </div>

          <div className="command-workspace__parallel">
            <TrialPortfolioParallel
              metrics={portfolioMetrics}
              selectedTrialId={selectedTrialMetric?.trialId ?? ""}
              onTrialClick={(trialId) =>
                startTransition(() => {
                  setSelectedTrialId(trialId);
                })
              }
              embedded
            />
          </div>

          <div className="command-workspace__portfolio-strip">
            <TrialPortfolioStrip
              metrics={portfolioMetrics}
              selectedTrialId={selectedTrialMetric?.trialId ?? ""}
              onSelect={(trialId) =>
                startTransition(() => {
                  setSelectedTrialId(trialId);
                })
              }
              embedded
            />
          </div>

          {selectedTrialMetric ? (
            <section className="surface surface--embedded command-focus-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow-label">Focused detail</p>
                  <h3>{selectedTrialMetric.shortCode}</h3>
                </div>
                <StatusChip
                  label={selectedTrialMetric.trial.releaseState}
                  tone="paper"
                  compact
                />
              </div>
              <p className="panel-copy">
                Phase {selectedTrialMetric.trial.phase} - Primary blocker:{" "}
                {selectedTrialMetric.blocker}
              </p>
              <div className="summary-list summary-list--compact">
                <div>
                  <span>Screened</span>
                  <strong>{selectedTrialMetric.screened}</strong>
                </div>
                <div>
                  <span>PI escalations</span>
                  <strong>{selectedTrialMetric.piEscalations}</strong>
                </div>
                <div>
                  <span>Outreach ready</span>
                  <strong>{selectedTrialMetric.outreachReady}</strong>
                </div>
                <div>
                  <span>Enrolled</span>
                  <strong>{selectedTrialMetric.enrolled}</strong>
                </div>
              </div>
            </section>
          ) : null}
        </section>

        {/* Wave D.2 creative pass — the support sidebar now carries 4 stacked
           widgets: ReadinessLadder + LoadRibbon (rollout guardrails), the
           selected-hotspot focus card (moved from inside friction), and the
           override clustering panel (also moved). This rebalances the
           Command Center grid so the sticky sidebar has ~1800px of content
           instead of ~870px, filling what used to be a blank right column
           while the user scrolls through friction + portfolio. */}
        <section className="surface command-board__support command-support-strip">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Pilot support strip</p>
              <h3>Rollout guardrails + selected hotspot context</h3>
            </div>
            <StatusChip label="Pilot readout" tone="moss" compact />
          </div>

          <div className="command-support-strip__grid">
            <ReadinessLadder steps={readinessSteps} embedded />
            <LoadRibbon items={loadRibbonItems} embedded />
          </div>

          {selectedHotspot && selectedHotspotRanking ? (
            <section className="surface surface--embedded command-focus-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow-label">Selected hotspot</p>
                  <h3>{selectedHotspot.family}</h3>
                </div>
                <StatusChip
                  label={selectedHotspotRanking.interpretationLabel}
                  tone={selectedHotspotRanking.tone}
                  compact
                />
              </div>
              <p>{selectedHotspot.hotspot}</p>
              <div className="summary-list summary-list--compact">
                <div>
                  <span>Uncertainty rate</span>
                  <strong>{selectedHotspotRanking.uncertaintyRate}%</strong>
                </div>
                <div>
                  <span>Override rate</span>
                  <strong>{selectedHotspotRanking.overrideRate}%</strong>
                </div>
                <div>
                  <span>Why it matters</span>
                  <strong>{selectedHotspotRanking.whyItMatters}</strong>
                </div>
                <div>
                  <span>Best next move</span>
                  <strong>{selectedHotspotRanking.actionLabel}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface surface--embedded">
            <div className="panel-heading">
              <div>
                <p className="eyebrow-label">Override clustering</p>
                <h3>Repeated reviewer friction</h3>
              </div>
            </div>

            <div className="signal-stack">
              {opsInsights.overrideClusters.map((cluster) => (
                <article key={cluster.family} className="signal-card">
                  <div className="signal-card__top">
                    <strong>{cluster.family}</strong>
                    <StatusChip
                      label={`${cluster.count} repeats`}
                      tone="amber"
                      compact
                    />
                  </div>
                  <p>{cluster.reason}</p>
                  <div className="signal-card__footer">
                    <span>{cluster.action}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  );
}
