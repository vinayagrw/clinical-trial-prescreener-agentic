import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionRibbon } from "../components/ActionRibbon";
import { AppShell } from "../components/AppShell";
import {
  CaseLens,
  PriorityMatrix,
  QueueCompactList,
  StoryRail
} from "../components/visuals/CockpitVisuals";
import { MetricCard } from "../components/MetricCard";
import { QueueTable } from "../components/QueueTable";
import { TaskModeStrip } from "../components/TaskModeStrip";
import { OvernightDeltaSlope } from "../features/cockpit/components/viz/OvernightDeltaSlope";
import {
  buildQueuePriorityPoints,
  buildStoryRailItems
} from "../lib/visualAdapters";
import {
  getMatch,
  getPatient,
  getTrial,
  getVisibleMatches,
  getVisiblePatients,
  getVisibleQueueItems,
  matches,
  metricTrends,
  overnightChanges,
  trials
} from "../data/mockData";
import { demoStories, taskModeCards } from "../data/platformData";
import { useVisualFocusStore } from "../stores/visualFocus";
import type { TaskMode } from "../types";

function taskModeLabel(mode: TaskMode | "all") {
  if (mode === "all") {
    return "All active work";
  }

  return taskModeCards.find((item) => item.id === mode)?.label ?? "Task mode";
}

// Stable reference — returning a fresh [] from a zustand selector trips
// React's useSyncExternalStore infinite-loop detection.
// Never mutated — reference-stable shared fallback used when the visual
// focus store points at a different route.
const EMPTY_TERMS: string[] = [];

export function CockpitPage() {
  const visibleQueueItems = getVisibleQueueItems();
  const visibleMatches = getVisibleMatches();
  const visiblePatients = getVisiblePatients();
  const navigate = useNavigate();
  const [activeTaskMode, setActiveTaskMode] = useState<TaskMode | "all">("today");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [selectedMatchId, setSelectedMatchId] = useState(visibleQueueItems[0]?.matchId ?? "");
  // Split the selector into two primitive/stable-reference reads so each
  // selector returns a stable value between renders. A single conditional
  // selector was tripping React's useSyncExternalStore loop detector in
  // zustand v5 under strict mode double-invoke.
  const routeKind = useVisualFocusStore((state) => state.routeKind);
  const storeTerms = useVisualFocusStore((state) => state.terms);
  const highlightTerms = routeKind === "cockpit" ? storeTerms : EMPTY_TERMS;

  const filteredItems = visibleQueueItems.filter((item) => {
    const patient = getPatient(item.patientId);
    const trial = getTrial(item.trialId);
    if (!patient || !trial) {
      return false;
    }
    const inTaskMode =
      activeTaskMode === "all" || item.taskModes?.includes(activeTaskMode);
    const haystack = [
      patient?.name,
      patient?.diagnosis,
      patient?.biomarkers.join(" "),
      trial?.shortCode,
      trial?.title,
      item.whyNow,
      item.recommendedAction
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      deferredSearchQuery.length === 0 || haystack.includes(deferredSearchQuery);

    return inTaskMode && matchesSearch;
  });

  useEffect(() => {
    if (!filteredItems.length) {
      return;
    }

    const stillVisible = filteredItems.some((item) => item.matchId === selectedMatchId);
    if (!stillVisible) {
      setSelectedMatchId(filteredItems[0].matchId);
    }
  }, [filteredItems, selectedMatchId]);

  const points = buildQueuePriorityPoints(
    filteredItems,
    visibleMatches,
    visiblePatients,
    trials,
  );
  const storyRailItems = buildStoryRailItems(filteredItems, demoStories);
  const selectedQueueItem =
    filteredItems.find((item) => item.matchId === selectedMatchId) ??
    filteredItems[0] ??
    visibleQueueItems[0];
  const selectedPatient = selectedQueueItem
    ? getPatient(selectedQueueItem.patientId)
    : undefined;
  const selectedTrial = selectedQueueItem
    ? getTrial(selectedQueueItem.trialId)
    : undefined;
  const selectedMatch = selectedQueueItem
    ? getMatch(selectedQueueItem.matchId)
    : undefined;
  const selectedStory = storyRailItems.find(
    (item) => item.matchId === selectedQueueItem?.matchId
  );

  const visibleCount = filteredItems.length;
  const piReviewCount = filteredItems.filter(
    (item) => item.nextStep === "needs_pi_review"
  ).length;
  const overnightCount = filteredItems.filter((item) => item.changedOvernight).length;
  const outreachCount = filteredItems.filter((item) =>
    item.taskModes?.includes("ready_for_outreach")
  ).length;

  return (
    <AppShell
      title="Coordinator Operations Cockpit"
      subtitle="Queue-first orchestration with a live priority matrix, synced story rail, and a case lens that turns ranking into action."
    >
      <ActionRibbon
        eyebrow="Today"
        title="Why this queue matters right now"
        items={[
          {
            label: "Active task mode",
            value: taskModeLabel(activeTaskMode)
          },
          {
            label: "What changed overnight",
            value: `${overnightCount} visible cases moved after new evidence landed`
          },
          {
            label: "Best same-day action",
            value:
              selectedQueueItem?.recommendedAction ??
              "Pick a case to see the next action."
          },
          {
            label: "Product promise in view",
            value:
              taskModeCards.find((mode) => mode.id === activeTaskMode)?.promise ??
              "The next best case is always easy to find."
          }
        ]}
      />

      <TaskModeStrip
        modes={taskModeCards}
        activeMode={activeTaskMode}
        onSelect={(mode) =>
          startTransition(() => {
            setActiveTaskMode(mode);
          })
        }
      />

      <div className="cockpit-board">
        <section className="surface cockpit-board__header">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Saved view</p>
              <h3>Thoracic oncology pilot workspace</h3>
              <p className="panel-copy">
                Keep search, queue pressure, and the active task promise in one
                dense band so the matrix becomes the first real thing a
                coordinator sees.
              </p>
            </div>
            <div className="topbar-actions">
              <input
                className="input cockpit-search"
                placeholder="Filter by patient, diagnosis, biomarker, or trial"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Filter cockpit queue"
              />
            </div>
          </div>

          <div className="metric-grid metric-grid--four">
            <MetricCard
              label="Visible queue"
              value={`${visibleCount} cases`}
              detail={`Current filter: ${taskModeLabel(activeTaskMode)}`}
              trend={metricTrends["visible-queue"]}
              trendLabel="Visible queue, 14-day trend"
              delay={0}
            />
            <MetricCard
              label="Need PI review"
              value={`${piReviewCount} cases`}
              detail="Escalation load inside the visible task set"
              trend={metricTrends["need-pi-review-cockpit"]}
              trendLabel="Need PI review, 14-day trend"
              delay={60}
            />
            <MetricCard
              label="Changed overnight"
              value={`${overnightCount} cases`}
              detail="New chart evidence or release-state change"
              trend={metricTrends["changed-overnight"]}
              trendLabel="Changed overnight, 14-day trend"
              delay={120}
            />
            <MetricCard
              label="Ready for outreach"
              value={`${outreachCount} cases`}
              detail="Best same-day conversion opportunities"
              trend={metricTrends["ready-for-outreach"]}
              trendLabel="Ready for outreach, 14-day trend"
              delay={180}
            />
          </div>
        </section>

        <div className="cockpit-board__slope">
          <OvernightDeltaSlope
            changes={overnightChanges}
            onCaseClick={(matchId) => navigate(`/review/${matchId}`)}
          />
        </div>

        <div className="cockpit-board__matrix">
          <PriorityMatrix
            points={points}
            selectedMatchId={selectedQueueItem?.matchId ?? ""}
            onSelect={(matchId) =>
              startTransition(() => {
                setSelectedMatchId(matchId);
              })
            }
            highlightTerms={highlightTerms}
          />
        </div>

        <div className="cockpit-board__list">
          <QueueCompactList
            points={points}
            selectedMatchId={selectedQueueItem?.matchId ?? ""}
            onSelect={(matchId) =>
              startTransition(() => {
                setSelectedMatchId(matchId);
              })
            }
            highlightTerms={highlightTerms}
          />
        </div>

        <div className="cockpit-board__lens">
          <CaseLens
            patient={selectedPatient}
            trial={selectedTrial}
            item={selectedQueueItem}
            match={selectedMatch}
            story={selectedStory}
            highlightTerms={highlightTerms}
          />
          <StoryRail
            items={storyRailItems}
            selectedMatchId={selectedQueueItem?.matchId ?? ""}
            onSelect={(matchId) =>
              startTransition(() => {
                setSelectedMatchId(matchId);
              })
            }
          />
        </div>

        <section className="surface cockpit-board__detail" aria-labelledby="cockpit-detail-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Exact queue detail</p>
              <h3 id="cockpit-detail-title">Queue table stays visible under the live story context</h3>
              <p className="panel-copy">
                Demo proof now stays beside the active case by default. This
                table remains as the secondary exact-detail surface for sorting,
                ownership checks, and fast route jumps.
              </p>
            </div>
          </div>
          <QueueTable
            items={filteredItems}
            selectedMatchId={selectedQueueItem?.matchId ?? ""}
            onSelect={(matchId) =>
              startTransition(() => {
                setSelectedMatchId(matchId);
              })
            }
          />
        </section>
      </div>
    </AppShell>
  );
}
