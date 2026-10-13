import React from "react";
import { useParams } from "react-router-dom";
import { trials } from "../data/index";
import { trialCriteriaById, releaseGatesByTrial } from "../data/extendedMockData";
import { PageCrosslinks } from "../components/layout/PageCrosslinks";
import { EntitySwitcher, type EntitySwitcherItem } from "../components/layout/EntitySwitcher";
import { CriterionBuilder } from "../components/trial-config/CriterionBuilder";
import { ComputabilityGrid } from "../components/trial-config/ComputabilityGrid";
import { ReleaseGateStrip } from "../components/trial-config/ReleaseGateStrip";
import { ProtocolTimeline } from "../components/trial-config/ProtocolTimeline";
import { ProtocolDiff } from "../components/trial-config/ProtocolDiff";

export default function TrialConfigPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const resolvedTrialId = trialId || "trial-001";
  const trial = trials.find((t) => t.id === resolvedTrialId) ?? trials[0];
  // Look up trial-specific criteria; CriterionBuilder falls back to the global set if undefined.
  const trialCriteria = trialCriteriaById[trial.id];

  // Build the entity-switcher items for all trials. Chip label is the short
  // code (e.g., "BC-077"); tooltip carries the full title.
  const trialItems: EntitySwitcherItem[] = trials.map((t) => ({
    id: t.id,
    label: t.shortCode,
    href: `/trials/${t.id}`,
    title: t.title,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-serif)", marginBottom: 0 }}>Trial Configuration</h2>
        <PageCrosslinks
          links={[
            { label: `Back to Mission Control`, to: `/mission-control`, back: true },
          ]}
        />
        <EntitySwitcher
          eyebrow="Switch trial"
          items={trialItems}
          currentId={trial.id}
        />
      </div>

      <div className="trial-config">
        {/* Main area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Trial header card */}
          <div className="glass-surface--card" style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-small)",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--teal-500)",
                  background: "var(--teal-50)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                {trial.shortCode}
              </span>
              <span
                style={{
                  fontSize: "var(--text-micro)",
                  fontWeight: "var(--weight-medium)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-pill)",
                  background:
                    trial.localStatus === "active" ? "var(--moss-50)" : "var(--amber-50)",
                  color:
                    trial.localStatus === "active" ? "var(--moss-500)" : "var(--amber-500)",
                }}
              >
                {trial.localStatus}
              </span>
            </div>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-semibold)",
                marginBottom: "var(--space-3)",
              }}
            >
              {trial.title}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "var(--space-2)",
                fontSize: "var(--text-small)",
                color: "var(--ink-secondary)",
              }}
            >
              <div>Phase: {trial.phase}</div>
              <div>PI: {trial.pi}</div>
              <div>Protocol: {trial.protocolVersion}</div>
              <div>Disease Area: {trial.diseaseArea}</div>
              <div style={{ gridColumn: "1 / -1" }}>
                Screening Window: {trial.screeningWindow}
              </div>
            </div>
          </div>

          {/* Computability Grid — high-density snapshot of automation coverage */}
          <ComputabilityGrid criteria={trialCriteria ?? []} />

          {/* Criterion Builder */}
          <div>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-semibold)",
                marginBottom: "var(--space-3)",
              }}
            >
              Normalized Criteria
            </h3>
            <CriterionBuilder criteria={trialCriteria} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="glass-surface--card">
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-semibold)",
                padding: "var(--space-4) var(--space-4) 0",
              }}
            >
              Protocol Timeline
            </h3>
            <ProtocolTimeline />
          </div>

          <div className="glass-surface--card" style={{ padding: "var(--space-4)" }}>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-semibold)",
                marginBottom: "var(--space-3)",
              }}
            >
              Protocol Diff
            </h3>
            <ProtocolDiff />
          </div>

          <div className="glass-surface--card" style={{ padding: "var(--space-4)" }}>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-semibold)",
                marginBottom: "var(--space-1)",
              }}
            >
              Release Gates
            </h3>
            <p
              style={{
                fontSize: "var(--text-small)",
                color: "var(--ink-muted)",
                marginTop: 0,
                marginBottom: "var(--space-3)",
              }}
            >
              Readiness checklist before this trial can accept live screens.
            </p>
            <ReleaseGateStrip gates={releaseGatesByTrial[trial.id] ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
