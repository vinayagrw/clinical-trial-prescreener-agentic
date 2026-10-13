import React from "react";
import type { QueueItemEnriched } from "../../types/extended";
import { getPatient, getTrial, getMatch } from "../../data/index";
import { ProgressRing } from "../shared/ProgressRing";
import { StatusDot } from "../shared/StatusDot";

interface PatientCardProps {
  item: QueueItemEnriched;
  selected?: boolean;
  onClick: () => void;
  animationDelay?: number;
  /** Lane id for keyboard-nav scope (see TaskBoard arrow-key handler). */
  laneId?: string;
  /** Zero-based index within the lane, used by keyboard nav to compute targets. */
  cardIndex?: number;
}

function priorityToStatus(priority: string): string {
  switch (priority) {
    case "critical":
      return "fail";
    case "high":
      return "uncertain";
    case "moderate":
      return "info";
    default:
      return "manual_review";
  }
}

function freshnessToStatus(freshness: string): string {
  switch (freshness) {
    case "fresh":
      return "pass";
    case "aging":
      return "uncertain";
    case "stale":
      return "stale";
    default:
      return "fail";
  }
}

export function PatientCard({
  item,
  selected,
  onClick,
  animationDelay = 0,
  laneId,
  cardIndex,
}: PatientCardProps) {
  const patient = getPatient(item.patientId);
  const trial = getTrial(item.trialId);
  const match = getMatch(item.matchId);

  const cardClasses = [
    "patient-card",
    "glass-surface",
    "glass-surface--card",
    item.priority === "critical" ? "patient-card--critical" : "",
    item.priority === "high" ? "patient-card--high" : "",
    selected ? "patient-card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fitScore = match?.fitScore ?? item.score;

  // Determine ring color from score
  const ringColor: "moss" | "teal" | "amber" | "brick" =
    fitScore >= 85 ? "moss" : fitScore >= 70 ? "teal" : fitScore >= 50 ? "amber" : "brick";

  // Determine evidence freshness from match data
  const freshness = match?.evidenceFreshnessSummary ?? "fresh";
  const freshnessLabel =
    freshness.toLowerCase().includes("stale")
      ? "stale"
      : freshness.toLowerCase().includes("aging")
        ? "aging"
        : "fresh";

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      role="button"
      tabIndex={0}
      data-lane={laneId}
      data-card-index={cardIndex}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Row 1: Ring + Name + Priority dot */}
      <div className="patient-card__row">
        <ProgressRing value={fitScore} size={36} strokeWidth={3} color={ringColor} />
        <span className="patient-card__name">{patient?.name ?? "Unknown Patient"}</span>
        <StatusDot status={priorityToStatus(item.priority)} size="sm" />
      </div>

      {/* Row 2: Trial code + Score */}
      <div className="patient-card__row">
        <span className="patient-card__trial-code">
          {trial?.shortCode ?? "---"}
        </span>
        <span className="patient-card__score">{fitScore}% fit</span>
      </div>

      {/* Row 3: Primary blocker */}
      <div className="patient-card__row">
        <span className="patient-card__blocker">
          {item.whyNow.primaryBlocker}
        </span>
      </div>

      {/* Row 4: Due by + Freshness */}
      <div className="patient-card__row">
        <span className="patient-card__time">{item.whyNow.dueBy}</span>
        <StatusDot status={freshnessToStatus(freshnessLabel)} size="sm" />
      </div>
    </div>
  );
}
