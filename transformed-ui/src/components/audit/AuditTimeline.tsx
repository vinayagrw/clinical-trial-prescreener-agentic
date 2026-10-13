import React from "react";
import { auditEvents } from "../../data/index";
import type { MatchRecommendation } from "@old/types";

const eventTypeColors: Record<string, { bg: string; color: string }> = {
  "screening.job_completed": { bg: "var(--teal-50)", color: "var(--teal-500)" },
  "criterion.assessed": { bg: "var(--amber-50)", color: "var(--amber-500)" },
  "match.finalized": { bg: "var(--moss-50)", color: "var(--moss-500)" },
  "match.rank.compared": { bg: "var(--teal-50)", color: "var(--teal-600)" },
};

function getEventStyle(eventType: string) {
  return eventTypeColors[eventType] ?? { bg: "var(--slate-100)", color: "var(--slate-500)" };
}

interface AuditTimelineProps {
  match: MatchRecommendation;
}

export function AuditTimeline({ match }: AuditTimelineProps) {
  // Scope audit events to this match so every row belongs to the selected patient chain.
  const scopedEvents = auditEvents.filter((e) => match.auditIds.includes(e.id));

  if (scopedEvents.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-6) var(--space-4)",
          textAlign: "center",
          color: "var(--ink-muted)",
          fontSize: "var(--text-small)",
          fontStyle: "italic",
        }}
      >
        No audit events recorded yet for this match.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {scopedEvents.map((event, index) => {
        const style = getEventStyle(event.eventType);
        const isLast = index === scopedEvents.length - 1;

        return (
          <div
            key={event.id}
            style={{
              display: "flex",
              gap: "var(--space-3)",
              position: "relative",
            }}
          >
            {/* Timeline line + dot */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 20,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: style.color,
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              {!isLast && (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    background: "var(--slate-200)",
                    marginTop: 4,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: "var(--space-3)" }}>
              {/* Timestamp + Actor */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-1)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-micro)",
                    color: "var(--ink-muted)",
                  }}
                >
                  {event.timestamp}
                </span>

                {/* Actor avatar */}
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--teal-100)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "var(--text-nano)",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--teal-600)",
                    flexShrink: 0,
                  }}
                >
                  {event.actor.charAt(0).toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-micro)",
                    fontWeight: "var(--weight-medium)",
                    color: "var(--ink-secondary)",
                  }}
                >
                  {event.actor}
                </span>
              </div>

              {/* Event type badge */}
              <span
                style={{
                  display: "inline-block",
                  fontSize: "var(--text-micro)",
                  fontWeight: "var(--weight-bold)",
                  textTransform: "uppercase" as const,
                  letterSpacing: "var(--tracking-wide)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-xs)",
                  background: style.bg,
                  color: style.color,
                  marginBottom: "var(--space-2)",
                }}
              >
                {event.eventType}
              </span>

              {/* Summary */}
              <p
                style={{
                  fontSize: "var(--text-small)",
                  color: "var(--ink-secondary)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: 0,
                  marginBottom: "var(--space-2)",
                }}
              >
                {event.summary}
              </p>

              {/* Version info */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  fontSize: "var(--text-micro)",
                  color: "var(--ink-muted)",
                }}
              >
                <span>Rules: {event.ruleVersion}</span>
                <span>Prompt: {event.promptVersion}</span>
                <span>Model: {event.modelVersion}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
