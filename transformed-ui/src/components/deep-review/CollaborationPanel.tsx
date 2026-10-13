import React from "react";
import { collaborationThreads } from "../../data/extendedMockData";
import { StatusDot } from "../shared/StatusDot";

export interface CollaborationPanelProps {
  matchId: string;
}

const threadStatusMap: Record<string, string> = {
  open: "amber",
  resolved: "moss",
  waiting: "slate",
};

export function CollaborationPanel({ matchId }: CollaborationPanelProps) {
  const threads = collaborationThreads.filter((t) => t.matchId === matchId);

  return (
    <div className="collab-panel">
      <div
        style={{
          fontSize: "var(--text-micro)",
          fontWeight: "var(--weight-bold)" as string,
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase" as const,
          color: "var(--ink-muted)",
          marginBottom: "var(--space-3)",
        }}
      >
        PI Escalation &amp; Collaboration ({threads.length})
      </div>

      {threads.length === 0 && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            fontSize: "var(--text-small)",
            color: "var(--ink-muted)",
            fontStyle: "italic",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "var(--space-3)",
            border: "1px dashed var(--slate-200)",
          }}
        >
          No discussions yet — start a thread with the escalation button below.
        </div>
      )}

      {threads.map((thread) => (
        <div key={thread.id} className="collab-panel__thread">
          <div className="collab-panel__thread-header">
            <StatusDot
              status={threadStatusMap[thread.status] ?? "slate"}
              size="sm"
            />
            <span style={{ fontWeight: "var(--weight-semibold)" as string }}>
              {thread.initiator}
            </span>
            <span style={{ color: "var(--ink-muted)" }}>&rarr;</span>
            <span>{thread.escalatedTo}</span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "var(--text-micro)",
                color: "var(--ink-muted)",
              }}
            >
              {thread.status}
            </span>
          </div>

          <div className="collab-panel__question">{thread.question}</div>

          {thread.responses.length > 0 && (
            <div style={{ marginTop: "var(--space-2)" }}>
              {thread.responses.map((resp) => (
                <div
                  key={resp.id}
                  style={{
                    fontSize: "var(--text-small)",
                    color: "var(--ink-secondary)",
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--teal-50)",
                    borderRadius: "var(--radius-xs)",
                    marginTop: "var(--space-1)",
                  }}
                >
                  <strong>{resp.author}</strong>{" "}
                  <span style={{ color: "var(--ink-muted)", fontSize: "var(--text-micro)" }}>
                    {resp.timestamp}
                  </span>
                  <br />
                  {resp.text}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button type="button" className="collab-panel__escalate-btn">
        + New Escalation
      </button>
    </div>
  );
}
