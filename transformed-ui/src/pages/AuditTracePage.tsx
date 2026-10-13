import React from "react";
import { useParams } from "react-router-dom";
import { matches, trials, getPatient, getTrial } from "../data/index";
import type { Trial } from "@old/types";
import { PageCrosslinks } from "../components/layout/PageCrosslinks";
import { EntitySwitcher, type EntitySwitcherItem } from "../components/layout/EntitySwitcher";
import { AuditFlowGraph } from "../components/audit/AuditFlowGraph";
import { AuditTimeline } from "../components/audit/AuditTimeline";
import { EvidenceMap } from "../components/audit/EvidenceMap";

export default function AuditTracePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const resolvedMatchId = matchId || "match-001";
  // Resolve the match explicitly; no silent fallback to matches[0], which would
  // render Angela's audit chain for any unknown matchId.
  const match = matches.find((m) => m.id === resolvedMatchId);
  const trial: Trial | undefined = match ? trials.find((t) => t.id === match.trialId) : undefined;

  // Build the entity-switcher items for all matches. Same shape as Deep Review
  // but href points at /audit/ instead of /review/.
  const matchItems: EntitySwitcherItem[] = matches.map((m) => {
    const p = getPatient(m.patientId);
    const t = getTrial(m.trialId);
    return {
      id: m.id,
      label: p?.name ?? m.patientId,
      sublabel: t?.shortCode,
      href: `/audit/${m.id}`,
      title: `${p?.name ?? ""} — ${t?.title ?? ""}`.trim(),
    };
  });

  if (!match) {
    return (
      <div className="audit-trace">
        <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: "var(--space-2)" }}>
          Audit Trace
        </h2>
        <div
          className="glass-surface--card"
          style={{
            padding: "var(--space-6)",
            textAlign: "center",
            color: "var(--ink-muted)",
          }}
        >
          Match <code>{resolvedMatchId}</code> not found. Select a match from Mission Control.
        </div>
      </div>
    );
  }

  return (
    <div className="audit-trace">
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: "var(--space-2)" }}>
          Audit Trace
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            fontSize: "var(--text-small)",
            color: "var(--ink-secondary)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-micro)",
              fontWeight: "var(--weight-bold)",
              color: "var(--teal-500)",
              background: "var(--teal-50)",
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
            }}
          >
            {match.id}
          </span>
          {trial && (
            <span>
              {trial.shortCode} &mdash; {trial.title}
            </span>
          )}
          <span
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: "var(--weight-medium)",
              padding: "2px 8px",
              borderRadius: "var(--radius-pill)",
              background:
                match.recommendation === "pass"
                  ? "var(--moss-50)"
                  : match.recommendation === "fail"
                    ? "var(--brick-50)"
                    : "var(--amber-50)",
              color:
                match.recommendation === "pass"
                  ? "var(--moss-500)"
                  : match.recommendation === "fail"
                    ? "var(--brick-500)"
                    : "var(--amber-500)",
            }}
          >
            {match.recommendation}
          </span>
          <span>Score: {match.fitScore}</span>
        </div>

        {/* Cross-links: back to review + trial config */}
        <PageCrosslinks
          links={[
            { label: `Back to Deep Review`, to: `/review/${match.id}`, back: true },
            ...(trial
              ? [{ label: `Configure trial ${trial.shortCode}`, to: `/trials/${trial.id}` }]
              : []),
          ]}
        />

        {/* Sibling-match switcher — flip between any audit trace in the stack */}
        <EntitySwitcher
          eyebrow="Switch patient"
          items={matchItems}
          currentId={match.id}
        />
      </div>

      {/* Flow Graph */}
      <div className="glass-surface--card">
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-body)",
            fontWeight: "var(--weight-semibold)",
            padding: "var(--space-4) var(--space-4) 0",
          }}
        >
          Decision Flow
        </h3>
        <AuditFlowGraph match={match} />
      </div>

      {/* Two-column: Timeline + Evidence Map */}
      <div className="audit-trace__split">
        <div className="glass-surface--card" style={{ padding: "var(--space-4)" }}>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              marginBottom: "var(--space-4)",
            }}
          >
            Event Timeline
          </h3>
          <AuditTimeline match={match} />
        </div>

        <div className="glass-surface--card" style={{ padding: "var(--space-4)" }}>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-body)",
              fontWeight: "var(--weight-semibold)",
              marginBottom: "var(--space-4)",
            }}
          >
            Evidence Map
          </h3>
          <EvidenceMap match={match} />
        </div>
      </div>
    </div>
  );
}
