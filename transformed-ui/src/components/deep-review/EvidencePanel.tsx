import React, { useEffect, useRef, useState } from "react";
import type { EvidenceSnippet } from "../../types/index";

export interface EvidencePanelProps {
  criterionId: string | null;
  allEvidence: EvidenceSnippet[];
}

export function EvidencePanel({ criterionId, allEvidence }: EvidencePanelProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  // Listen for Ask Agent citation clicks (dispatched from AgentCitationChip).
  // When the target evidence is currently rendered in this panel, scroll it
  // into view and pulse it for ~2 seconds so the user sees the link.
  useEffect(() => {
    function handleScrollRequest(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (!detail?.id) return;

      const target = document.getElementById(`evidence-${detail.id}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(detail.id);
        if (highlightTimerRef.current) {
          window.clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightedId(null);
          highlightTimerRef.current = null;
        }, 2000);
      }
    }

    window.addEventListener("ctp:scroll-to-evidence", handleScrollRequest);
    return () => {
      window.removeEventListener("ctp:scroll-to-evidence", handleScrollRequest);
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  if (!criterionId) {
    return (
      <div className="evidence-panel glass-surface glass-surface--card" style={{ padding: "var(--space-5)" }}>
        <div
          style={{
            color: "var(--ink-muted)",
            fontSize: "var(--text-small)",
            textAlign: "center",
            padding: "var(--space-8) 0",
          }}
        >
          Select a criterion to view evidence
        </div>
      </div>
    );
  }

  const filtered = allEvidence.filter((e) => e.criterionIds.includes(criterionId));

  return (
    <div className="evidence-panel glass-surface glass-surface--card" style={{ padding: "var(--space-4)" }}>
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
        Evidence ({filtered.length})
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            color: "var(--ink-muted)",
            fontSize: "var(--text-small)",
            textAlign: "center",
            padding: "var(--space-5) 0",
          }}
        >
          No evidence linked to this criterion
        </div>
      )}

      {filtered.map((ev) => {
        const isHighlighted = highlightedId === ev.id;
        return (
          <div
            key={ev.id}
            id={`evidence-${ev.id}`}
            className={
              "evidence-card" + (isHighlighted ? " evidence-card--highlighted" : "")
            }
          >
            <div className="evidence-card__header">
              <span className={`evidence-card__type evidence-card__type--${ev.tone}`}>
                {ev.tone}
              </span>
              <span className="evidence-card__date">{ev.sourceDate}</span>
            </div>
            <div className="evidence-card__title">{ev.sourceDocument}</div>
            <div className="evidence-card__excerpt">{ev.excerpt}</div>
            <div className="evidence-card__meta">
              <span>{ev.author}</span>
              <span style={{ color: "var(--slate-300)" }}>|</span>
              <span>{ev.sourceSystem}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
