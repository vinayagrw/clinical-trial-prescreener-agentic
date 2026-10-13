import React, { useCallback, useEffect, useRef, useState } from "react";
import { getMatch, getPatient, getTrial } from "../../data/index";

// Wow #2 — the missed patient reveal. Drives home "cost of inaction" with a
// scripted rescreen replay for Robert Hale (match-002). The moment is what
// converts exec-sponsor interest into urgency, so stage timing matters:
//
//   Stage 0: Intro card + Play button
//   Stage 1: Jan 15 — Robert greyed out, "Not evaluated — outside pathology missing"
//   Stage 2: Feb 10 — Pathology import chip slides in
//   Stage 3: Feb 10 — Rescreen fires (score rises from — to 84)
//   Stage 4: Card moves from Watching → Action Now with NEW MATCH banner
//   Stage 5: Closing overlay — "In your current workflow this rescreen would
//            not have fired."

const STAGE_DURATIONS_MS = [0, 2200, 2000, 2200, 2400, 2600];

interface StageDef {
  label: string;
  timestamp: string;
  headline: string;
  body: string;
  scoreShown: string;
  laneShown: "watching" | "action_now";
  greyed: boolean;
  newMatchBanner: boolean;
  pathologyChip: boolean;
  overlay?: string;
}

const STAGES: StageDef[] = [
  {
    label: "Before rescreen",
    timestamp: "Jan 15, 2026 · 9:02 AM",
    headline: "Robert Hale is not evaluated",
    body: "Outside pathology report is missing. Today's workflow moves on without a match attempt.",
    scoreShown: "—",
    laneShown: "watching",
    greyed: true,
    newMatchBanner: false,
    pathologyChip: false,
  },
  {
    label: "New evidence lands",
    timestamp: "Feb 10, 2026 · 7:14 AM",
    headline: "Outside pathology report imported",
    body: "FGFR2 fusion confirmation arrives via Care Everywhere. The pre-screener sees the new evidence domain.",
    scoreShown: "—",
    laneShown: "watching",
    greyed: true,
    newMatchBanner: false,
    pathologyChip: true,
  },
  {
    label: "Rescreen fires",
    timestamp: "Feb 10, 2026 · 7:15 AM",
    headline: "Continuous rescreen triggered",
    body: "Criterion engine re-runs GI-118 eligibility against the updated chart. Fit score rises from — to 84.",
    scoreShown: "84",
    laneShown: "watching",
    greyed: false,
    newMatchBanner: false,
    pathologyChip: true,
  },
  {
    label: "New match surfaces",
    timestamp: "Feb 10, 2026 · 7:15 AM",
    headline: "Robert Hale moved to Action Now",
    body: "Match-002 attaches to the GI coordinator queue with a NEW MATCH banner. Nina Patel sees it on her next refresh.",
    scoreShown: "84",
    laneShown: "action_now",
    greyed: false,
    newMatchBanner: true,
    pathologyChip: true,
  },
  {
    label: "Cost of inaction",
    timestamp: "",
    headline: "In your current workflow, this rescreen would not have fired.",
    body: "Robert would still be in your queue today, unseen. The pre-screener watches every evidence domain every night and replays eligibility the moment a new record lands.",
    scoreShown: "84",
    laneShown: "action_now",
    greyed: false,
    newMatchBanner: true,
    pathologyChip: true,
    overlay:
      "Recorded misses are the most common pilot objection. This is what removing them looks like.",
  },
];

export function TimeMachineControl() {
  const [open, setOpen] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  const match = getMatch("match-002");
  const patient = match ? getPatient(match.patientId) : undefined;
  const trial = match ? getTrial(match.trialId) : undefined;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(() => {
    setOpen(true);
    setStageIdx(1);
  }, []);

  const handleClose = useCallback(() => {
    clearTimer();
    setOpen(false);
    setStageIdx(0);
  }, [clearTimer]);

  const handleStepForward = useCallback(() => {
    clearTimer();
    setStageIdx((idx) => Math.min(idx + 1, STAGES.length - 1));
  }, [clearTimer]);

  const handleReplay = useCallback(() => {
    clearTimer();
    setStageIdx(1);
  }, [clearTimer]);

  // Auto-advance through stages while modal is open and not at the end.
  useEffect(() => {
    if (!open) return;
    if (stageIdx <= 0 || stageIdx >= STAGES.length - 1) return;
    const duration = STAGE_DURATIONS_MS[stageIdx + 1] ?? 2000;
    timerRef.current = window.setTimeout(() => {
      setStageIdx((idx) => Math.min(idx + 1, STAGES.length - 1));
    }, duration);
    return () => clearTimer();
  }, [open, stageIdx, clearTimer]);

  // ESC closes the modal.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!match || !patient || !trial) return null;

  const stage = STAGES[stageIdx];
  const atEnd = stageIdx >= STAGES.length - 1;

  return (
    <>
      <button
        type="button"
        className="time-machine-control"
        onClick={handleStart}
        title="Replay how continuous rescreening would catch a missed patient"
      >
        <span className="time-machine-control__icon" aria-hidden="true">
          &#9193;
        </span>
        <span className="time-machine-control__label">
          Replay rescreening &mdash; Jan 15, 2026
        </span>
        <span className="time-machine-control__hint">
          Show what today's workflow would miss
        </span>
      </button>

      {open && (
        <div
          className="missed-patient-reveal__backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="missed-patient-reveal-title"
          onClick={handleClose}
        >
          <div
            className="missed-patient-reveal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="missed-patient-reveal__header">
              <div>
                <div className="missed-patient-reveal__eyebrow">
                  Time machine · continuous rescreening
                </div>
                <h3
                  id="missed-patient-reveal-title"
                  className="missed-patient-reveal__title"
                >
                  {stage.headline}
                </h3>
                {stage.timestamp && (
                  <div className="missed-patient-reveal__timestamp">
                    {stage.timestamp}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="missed-patient-reveal__close"
                onClick={handleClose}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="missed-patient-reveal__body">
              <p>{stage.body}</p>
              {stage.overlay && (
                <p className="missed-patient-reveal__overlay">{stage.overlay}</p>
              )}
            </div>

            {/* The animated "queue card" — state driven by the stage */}
            <div
              className={
                "missed-patient-reveal__card" +
                (stage.greyed ? " missed-patient-reveal__card--greyed" : "")
              }
            >
              {stage.newMatchBanner && (
                <div className="missed-patient-reveal__new-banner">
                  NEW MATCH
                </div>
              )}
              <div className="missed-patient-reveal__card-row">
                <div className="missed-patient-reveal__card-lane">
                  <span className="missed-patient-reveal__lane-dot" />
                  {stage.laneShown === "action_now" ? "Action Now" : "Watching"}
                </div>
                <div className="missed-patient-reveal__card-score">
                  Fit {stage.scoreShown}
                </div>
              </div>
              <div className="missed-patient-reveal__card-name">
                {patient.name}
              </div>
              <div className="missed-patient-reveal__card-meta">
                {patient.diagnosis} · {trial.shortCode}
              </div>
              <div className="missed-patient-reveal__card-flags">
                {stage.pathologyChip && (
                  <span className="missed-patient-reveal__chip missed-patient-reveal__chip--supporting">
                    + Outside pathology imported
                  </span>
                )}
                {stage.greyed && (
                  <span className="missed-patient-reveal__chip missed-patient-reveal__chip--missing">
                    Outside pathology missing
                  </span>
                )}
                {!stage.greyed && stage.scoreShown !== "—" && (
                  <span className="missed-patient-reveal__chip missed-patient-reveal__chip--fresh">
                    Rescreened · GI-118 FGFR2
                  </span>
                )}
              </div>
            </div>

            <div className="missed-patient-reveal__footer">
              <div className="missed-patient-reveal__progress">
                {STAGES.slice(1).map((_, i) => (
                  <span
                    key={i}
                    className={
                      "missed-patient-reveal__pip" +
                      (i + 1 <= stageIdx
                        ? " missed-patient-reveal__pip--active"
                        : "")
                    }
                  />
                ))}
              </div>
              <div className="missed-patient-reveal__actions">
                {!atEnd ? (
                  <button
                    type="button"
                    className="missed-patient-reveal__btn"
                    onClick={handleStepForward}
                  >
                    Skip &raquo;
                  </button>
                ) : (
                  <button
                    type="button"
                    className="missed-patient-reveal__btn"
                    onClick={handleReplay}
                  >
                    Replay
                  </button>
                )}
                <button
                  type="button"
                  className="missed-patient-reveal__btn missed-patient-reveal__btn--primary"
                  onClick={handleClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
