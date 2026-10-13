import React, { useMemo } from "react";
import type { TimelineEvent } from "../../types/index";

export interface ExclusionWindow {
  id: string;
  /** Start date of the exclusion window (e.g. the event date). */
  startDate: string;
  /** End date of the exclusion window (e.g. event date + threshold). */
  endDate: string;
  /** Short label drawn above the shaded band. */
  label: string;
  /** Optional detail shown in tooltip title. */
  detail?: string;
  tone: "critical" | "warning";
}

export interface TemporalBarProps {
  events: TimelineEvent[];
  screeningDate?: string;
  exclusionWindows?: ExclusionWindow[];
}

const toneColors: Record<string, string> = {
  neutral: "var(--slate-400)",
  positive: "var(--moss-500)",
  warning: "var(--amber-500)",
  critical: "var(--brick-500)",
};

const windowFills: Record<ExclusionWindow["tone"], string> = {
  critical: "rgba(181, 69, 58, 0.18)",
  warning: "rgba(217, 155, 46, 0.18)",
};

const windowStrokes: Record<ExclusionWindow["tone"], string> = {
  critical: "var(--brick-500)",
  warning: "var(--amber-500)",
};

function parseDate(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function daysBetween(a: string, b: string): number {
  const ms = parseDate(b) - parseDate(a);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function TemporalBar({
  events,
  screeningDate,
  exclusionWindows = [],
}: TemporalBarProps) {
  const svgWidth = 600;
  const svgHeight = 110;
  const lineY = 62;
  const padX = 40;
  const usableWidth = svgWidth - padX * 2;

  const sorted = useMemo(() => {
    const all = [...events].sort(
      (a, b) => parseDate(a.date) - parseDate(b.date)
    );
    return all;
  }, [events]);

  const { minTime, maxTime } = useMemo(() => {
    if (sorted.length === 0 && exclusionWindows.length === 0) {
      return { minTime: 0, maxTime: 1 };
    }
    let min = sorted.length > 0 ? parseDate(sorted[0].date) : Infinity;
    let max = sorted.length > 0 ? parseDate(sorted[sorted.length - 1].date) : -Infinity;
    if (screeningDate) {
      const sd = parseDate(screeningDate);
      if (sd < min) min = sd;
      if (sd > max) max = sd;
    }
    for (const w of exclusionWindows) {
      const s = parseDate(w.startDate);
      const e = parseDate(w.endDate);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { minTime: 0, maxTime: 1 };
    }
    if (max === min) max = min + 1;
    return { minTime: min, maxTime: max };
  }, [sorted, screeningDate, exclusionWindows]);

  function xPos(dateStr: string): number {
    const t = parseDate(dateStr);
    const ratio = (t - minTime) / (maxTime - minTime);
    return padX + ratio * usableWidth;
  }

  if (events.length === 0) {
    // Render an empty-state band rather than vanishing — vanishing looks like a bug
    // when a coordinator lands on a patient with no timeline events yet.
    return (
      <div className="temporal-bar glass-surface glass-surface--card">
        <div className="temporal-bar__label">Patient Timeline</div>
        <div
          style={{
            padding: "var(--space-4)",
            textAlign: "center",
            color: "var(--ink-muted)",
            fontSize: "var(--text-small)",
            fontStyle: "italic",
          }}
        >
          No timeline events yet for this patient.
        </div>
      </div>
    );
  }

  const bandTop = lineY - 22;
  const bandHeight = 44;

  return (
    <div className="temporal-bar glass-surface glass-surface--card">
      <div className="temporal-bar__label">
        Patient Timeline
        {exclusionWindows.length > 0 && (
          <span className="temporal-bar__legend">
            <span
              className="temporal-bar__legend-swatch"
              style={{ background: windowFills.critical, borderColor: windowStrokes.critical }}
            />
            Exclusion window
          </span>
        )}
      </div>
      <svg width={svgWidth} height={svgHeight} style={{ display: "block", maxWidth: "100%" }}>
        {/* Exclusion window bands (drawn behind events) */}
        {exclusionWindows.map((w) => {
          const startX = xPos(w.startDate);
          const endX = xPos(w.endDate);
          const width = Math.max(2, endX - startX);
          const daysToEnd = screeningDate
            ? daysBetween(screeningDate, w.endDate)
            : null;
          const countdownText =
            daysToEnd !== null && daysToEnd > 0
              ? `${daysToEnd} days until window ends`
              : daysToEnd !== null && daysToEnd <= 0
                ? "Window passed"
                : "";
          const title = `${w.label}${w.detail ? " — " + w.detail : ""}${
            countdownText ? " (" + countdownText + ")" : ""
          }`;

          return (
            <g key={w.id}>
              <title>{title}</title>
              <rect
                x={startX}
                y={bandTop}
                width={width}
                height={bandHeight}
                fill={windowFills[w.tone]}
                stroke={windowStrokes[w.tone]}
                strokeDasharray="3 2"
                strokeWidth={1}
                rx={2}
                ry={2}
              />
              <text
                x={startX + width / 2}
                y={bandTop - 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                fill={windowStrokes[w.tone]}
              >
                {w.label}
              </text>
              {countdownText && (
                <text
                  x={startX + width / 2}
                  y={bandTop + bandHeight + 34}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill={windowStrokes[w.tone]}
                >
                  {countdownText}
                </text>
              )}
            </g>
          );
        })}

        {/* Horizontal line */}
        <line
          x1={padX}
          y1={lineY}
          x2={svgWidth - padX}
          y2={lineY}
          stroke="var(--slate-300)"
          strokeWidth={2}
        />

        {/* Screening date dashed line */}
        {screeningDate && (
          <>
            <line
              x1={xPos(screeningDate)}
              y1={bandTop - 16}
              x2={xPos(screeningDate)}
              y2={svgHeight - 8}
              stroke="var(--teal-500)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <text
              x={xPos(screeningDate)}
              y={bandTop - 20}
              textAnchor="middle"
              fontSize={9}
              fill="var(--teal-500)"
              fontWeight={600}
            >
              Screening
            </text>
          </>
        )}

        {/* Event circles + labels */}
        {sorted.map((ev) => {
          const cx = xPos(ev.date);
          const color = toneColors[ev.tone] ?? toneColors.neutral;

          return (
            <g key={ev.id}>
              <title>{`${ev.title} — ${ev.date}`}</title>
              <circle
                cx={cx}
                cy={lineY}
                r={5}
                fill={color}
                stroke="white"
                strokeWidth={1.5}
              />
              {/* Title above */}
              <text
                x={cx}
                y={lineY - 10}
                textAnchor="middle"
                fontSize={8}
                fill="var(--ink-secondary)"
                style={{ maxWidth: 60 }}
              >
                {ev.title.length > 18 ? ev.title.slice(0, 16) + "..." : ev.title}
              </text>
              {/* Date below */}
              <text
                x={cx}
                y={lineY + 18}
                textAnchor="middle"
                fontSize={8}
                fill="var(--ink-muted)"
              >
                {formatShort(ev.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
