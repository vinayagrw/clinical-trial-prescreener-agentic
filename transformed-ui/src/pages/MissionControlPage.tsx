import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MetricHero } from "../components/mission-control/MetricHero";
import { DigestPanel } from "../components/mission-control/DigestPanel";
import { TaskBoard } from "../components/mission-control/TaskBoard";
import { TimeMachineControl } from "../components/mission-control/TimeMachineControl";
import { ActionRibbon } from "../components/mission-control/ActionRibbon";
import { TaskModeStrip } from "../components/mission-control/TaskModeStrip";
import { DemoStoryBoard } from "../components/mission-control/DemoStoryBoard";
import { patients, trials, queueItems } from "../data/index";
import { changeDigest, taskModes, demoStories } from "../data/extendedMockData";
import type { TaskMode } from "../types/extended";

export default function MissionControlPage() {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<TaskMode | "all">("all");

  // Derive metric hero values from data rather than hardcoding.
  // Sparklines stay as demo literals — they represent a 7-day history we don't simulate.
  const activePatients = patients.length;
  const trialsScreening = trials.filter((t) => t.localStatus === "active").length;
  const readyForOutreach = queueItems.filter(
    (q) => q.nextStep === "candidate_for_outreach"
  ).length;
  const pendingPiReview = queueItems.filter(
    (q) => q.nextStep === "needs_pi_review" || q.nextStep === "protocol_question"
  ).length;

  // ActionRibbon items — all derived from the same queue/digest state used by
  // MetricHero so counts cannot drift.
  const watchlistCount = queueItems.filter(
    (q) => q.nextStep === "reviewed_not_actionable" || q.nextStep === "closed_not_eligible"
  ).length;
  const overnightChanges = changeDigest.length;

  const ribbonItems = [
    {
      label: "Flagged overnight",
      value: `${overnightChanges}`,
      hint: "New evidence, score shifts, and rescreen signals",
    },
    {
      label: "Ready for outreach",
      value: `${readyForOutreach}`,
      hint: "Cleared by rules and PI — coordinator just needs to reach out",
    },
    {
      label: "Needs PI review",
      value: `${pendingPiReview}`,
      hint: "Waiting on clinical judgment or protocol interpretation",
    },
    {
      label: "Watchlist / rescreen",
      value: `${watchlistCount}`,
      hint: "Not ready now — monitoring for changes",
    },
  ];

  // "Ops" mode is a portfolio view handled by /insights, not the task board.
  // Route instead of filtering so the user lands where the data actually lives.
  function handleSelectMode(mode: TaskMode | "all") {
    if (mode === "ops") {
      navigate("/insights");
      return;
    }
    setActiveMode(mode);
  }

  // Hero click drill-downs: each hero scrolls to the relevant task-lane or jumps
  // to an adjacent page. "Trials Screening" is the one exception — it doesn't
  // map to a lane, so we route to Trial Config for the first active trial.
  function scrollToLane(laneId: string) {
    const el = document.getElementById(`lane-${laneId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const handleActivePatientsClick = () => scrollToLane("action_now");
  const handleReadyOutreachClick = () => scrollToLane("ready_outreach");
  const handlePendingPiClick = () => scrollToLane("needs_pi");
  const handleTrialsScreeningClick = () => {
    const firstActive = trials.find((t) => t.localStatus === "active");
    navigate(`/trials/${firstActive?.id ?? "trial-001"}`);
  };

  return (
    <div className="mission-control-page">
      {/* Action Ribbon — framing strip above the heroes */}
      <ActionRibbon
        eyebrow="Mission control"
        title="What's in play right now"
        items={ribbonItems}
      />

      {/* Metric Heroes Row */}
      <div className="metric-heroes">
        <MetricHero
          label="Active Patients"
          value={activePatients}
          delta={{ value: 2, direction: "up" }}
          sparklineData={[1, 2, 2, 3, 4, 5, activePatients]}
          onClick={handleActivePatientsClick}
          title="Jump to Action Now lane"
        />
        <MetricHero
          label="Trials Screening"
          value={trialsScreening}
          delta={{ value: 1, direction: "up" }}
          sparklineData={[3, 3, 3, 3, 4, 4, trialsScreening]}
          onClick={handleTrialsScreeningClick}
          title="Open Trial Config"
        />
        <MetricHero
          label="Ready for Outreach"
          value={readyForOutreach}
          delta={{ value: readyForOutreach > 1 ? readyForOutreach - 1 : 0, direction: readyForOutreach > 1 ? "up" : "neutral" }}
          sparklineData={[0, 0, 0, 1, 1, 2, readyForOutreach]}
          onClick={handleReadyOutreachClick}
          title="Jump to Ready for Outreach lane"
        />
        <MetricHero
          label="Pending PI Review"
          value={pendingPiReview}
          delta={{ value: 0, direction: "neutral" }}
          sparklineData={[1, 2, 2, 2, 2, 3, pendingPiReview]}
          onClick={handlePendingPiClick}
          title="Jump to Needs PI Input lane"
        />
      </div>

      {/* Overnight Changes Digest */}
      <DigestPanel />

      {/* Missed patient time machine (Wow #2) */}
      <TimeMachineControl />

      {/* Task-mode pivots — selecting a mode filters the TaskBoard */}
      <TaskModeStrip
        modes={taskModes}
        activeMode={activeMode}
        onSelect={handleSelectMode}
      />

      {/* Swim-Lane Task Board */}
      <TaskBoard activeMode={activeMode} />

      {/* Curated demo stories — clickable proof-points */}
      <DemoStoryBoard stories={demoStories} />
    </div>
  );
}
