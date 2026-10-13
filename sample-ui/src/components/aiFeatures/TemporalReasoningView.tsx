/*
 * F4 — Temporal Reasoning & Washout Calculator (P2 live version).
 *
 * Drives off `useAiTemporalStore`. The decision block, protocol windows,
 * and lab freshness rows are all recomputed on every change to
 * `todayIso` — so the pitch team can drag the "today" date forward and
 * watch the EGFR-TKI washout clear, the creatinine go from stale to
 * blocking, and the `earliestEnrollmentDate` update in real time.
 *
 * The underlying math is deterministic and lives in
 * `lib/temporal/{washoutCalculator, labFreshness, decisionAssembler}.ts`.
 */

import type {
  TemporalLabFreshness,
  TemporalTone,
  TemporalWindow,
} from "../../types/aiFeatures";
import { HumanReviewPanel } from "../HumanReviewPanel";
import { getEffectiveReviewOutput, useAiReviewRunSync } from "../../lib/reviews";
import {
  DEFAULT_TODAY_ISO,
  useAiTemporalStore,
} from "../../stores/aiTemporal";

function toneBarClass(tone: TemporalTone): string {
  return `aif-temporal-bar-fill aif-temporal-bar-${tone}`;
}

function toneChipClass(tone: TemporalTone): string {
  return `aif-temporal-tone-chip aif-temporal-tone-chip-${tone}`;
}

function toneLabel(tone: TemporalTone): string {
  switch (tone) {
    case "ok":
      return "OK";
    case "waiting":
      return "Waiting";
    case "warning":
      return "Warning";
    case "blocked":
      return "Blocked";
  }
}

function daysFromTodayText(days: number): string {
  if (days === 0) {
    return "today";
  }
  if (days > 0) {
    return `in ${days} day${days === 1 ? "" : "s"}`;
  }
  return `${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
}

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

function todayPositionPct(window: TemporalWindow, todayIso: string): number {
  const start = parseIsoDate(window.startDate);
  const end = parseIsoDate(window.endDate);
  const today = parseIsoDate(todayIso);
  const total = daysBetween(end, start);
  if (total <= 0) {
    return 100;
  }
  const elapsed = daysBetween(today, start);
  const pct = (elapsed / total) * 100;
  return Math.max(0, Math.min(100, pct));
}

function WindowCard({
  window,
  todayIso,
}: {
  window: TemporalWindow;
  todayIso: string;
}) {
  const position = todayPositionPct(window, todayIso);
  const todayInside =
    parseIsoDate(todayIso) >= parseIsoDate(window.startDate) &&
    parseIsoDate(todayIso) <= parseIsoDate(window.endDate);

  return (
    <article className="aif-temporal-card">
      <header className="aif-temporal-card-head">
        <span className="aif-temporal-card-label">{window.label}</span>
        <span className={toneChipClass(window.tone)}>{toneLabel(window.tone)}</span>
      </header>
      <div className="aif-temporal-dates">
        <span>{window.startDate}</span>
        <span>→</span>
        <span>{window.endDate}</span>
        <span>({daysFromTodayText(window.daysFromToday)})</span>
      </div>
      <div className="aif-temporal-bar">
        <span className={toneBarClass(window.tone)} style={{ left: 0, width: "100%" }} />
        {todayInside && (
          <span className="aif-temporal-bar-today" style={{ left: `${position}%` }} />
        )}
      </div>
      <p className="aif-temporal-detail">{window.detail}</p>
    </article>
  );
}

function LabCard({ lab }: { lab: TemporalLabFreshness }) {
  const className =
    lab.tone === "blocked" ? "aif-temporal-lab aif-temporal-lab-blocked" : "aif-temporal-lab";
  return (
    <article className={className}>
      <header className="aif-temporal-card-head">
        <span className="aif-temporal-lab-name">{lab.labName}</span>
        <span className={toneChipClass(lab.tone)}>{toneLabel(lab.tone)}</span>
      </header>
      <span className="aif-temporal-lab-value">{lab.lastValue}</span>
      <span className="aif-temporal-lab-fresh">
        Drawn {lab.lastDrawn} · window {lab.windowDays}d · fresh through {lab.freshThrough}
      </span>
      <span className="aif-temporal-lab-fresh">
        {lab.daysUntilStale >= 0
          ? `${lab.daysUntilStale} day${lab.daysUntilStale === 1 ? "" : "s"} until stale`
          : `Stale for ${Math.abs(lab.daysUntilStale)} day${
              Math.abs(lab.daysUntilStale) === 1 ? "" : "s"
            }`}
      </span>
    </article>
  );
}

export function TemporalReasoningView() {
  const { run, todayIso, setTodayIso, reset, runTemporalAnalysis } = useAiTemporalStore();
  if (!run) return null;
  const reviewRun = useAiReviewRunSync({
    sourceKey: "ai-features:f4:trial-001",
    featureKey: "F4_temporal_reasoning",
    featureLabel: "F4 Temporal reasoning",
    stageKey: "temporal",
    workspace: "ai_features",
    entityType: "trial_match",
    entityId: "trial-001",
    entityLabel: "Temporal eligibility window",
    deepLink: "/ai-features",
    summary: `Temporal decision is ${run.decision.tone} with earliest enrollment ${run.decision.earliestEnrollmentDate}.`,
    promptSnapshot: {
      todayIso,
    },
    inputSnapshot: {
      todayIso,
      windows: run.windows,
      labFreshness: run.labFreshness,
    },
    outputSnapshot: run,
    policy: "required_before_continue",
    allowedActions: [
      "approve_as_is",
      "edit_output",
      "modify_evidence",
      "edit_input_and_rerun",
      "override",
      "reject",
      "escalate_manual_review",
      "revert_to_ai_draft",
    ],
    editableFields: ["inputSnapshot", "outputSnapshot", "citations"],
    requiredFields: ["rationale"],
    citations: [
      ...run.windows.map((window) => ({
        id: window.id,
        label: window.label,
        detail: `${window.startDate} → ${window.endDate}`,
        quote: window.detail,
        tone: window.tone === "ok" ? "supporting" as const : "warning" as const,
      })),
      ...run.labFreshness.map((lab) => ({
        id: lab.id,
        label: `${lab.labName} · ${lab.lastDrawn}`,
        detail: lab.lastValue,
        quote: `Fresh through ${lab.freshThrough}`,
        tone: lab.tone === "blocked" ? "warning" as const : "supporting" as const,
      })),
    ],
    safetyFlags: [
      ...run.decision.blockers.map((blocker, index) => ({
        id: `temporal-blocker-${index}`,
        label: "Temporal blocker",
        detail: blocker,
        severity: "warning" as const,
      })),
    ],
  });
  const displayRun = getEffectiveReviewOutput(reviewRun.run, run);
  const { decision, windows, labFreshness } = displayRun;
  const isAtDefault = todayIso === DEFAULT_TODAY_ISO;

  return (
    <div className="aif-temporal">
      <div className="aif-temporal-controls">
        <label className="aif-label" htmlFor="aif-temporal-today">
          Simulate today
        </label>
        <input
          id="aif-temporal-today"
          type="date"
          className="aif-temporal-date"
          value={todayIso}
          min="2026-03-01"
          max="2026-06-30"
          onChange={(e) => setTodayIso(e.target.value)}
        />
        <button
          type="button"
          className="aif-btn"
          onClick={() => reset()}
          disabled={isAtDefault}
        >
          Reset to {DEFAULT_TODAY_ISO}
        </button>
      </div>

      <section className="aif-temporal-decision">
        <header className="aif-temporal-decision-head">
          <span className="aif-label">Eligibility decision</span>
          <span className={toneChipClass(decision.tone)}>{toneLabel(decision.tone)}</span>
        </header>
        <div>
          <div className="aif-label">Earliest enrollment date</div>
          <div className="aif-temporal-decision-date">{decision.earliestEnrollmentDate}</div>
          <div className="aif-temporal-decision-label">{decision.windowLabel}</div>
        </div>
        {decision.blockers.length > 0 && (
          <ul className="aif-temporal-decision-blockers">
            {decision.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="aif-section-subhead">Protocol windows (today {todayIso})</p>
      <div className="aif-temporal-grid">
        {windows.map((window) => (
          <WindowCard key={window.id} window={window} todayIso={todayIso} />
        ))}
      </div>

      <p className="aif-section-subhead">Lab freshness</p>
      <div className="aif-temporal-labs">
        {labFreshness.map((lab) => (
          <LabCard key={lab.id} lab={lab} />
        ))}
      </div>

      <HumanReviewPanel
        run={reviewRun.run}
        title="Review temporal blockers and corrected dates"
        compact
        onRerun={async (editedInput) => {
          const nextTodayIso =
            typeof editedInput === "object" &&
            editedInput &&
            "todayIso" in editedInput &&
            typeof (editedInput as { todayIso?: unknown }).todayIso === "string"
              ? (editedInput as { todayIso: string }).todayIso
              : todayIso;
          setTodayIso(nextTodayIso);
          runTemporalAnalysis();
        }}
      />
    </div>
  );
}
