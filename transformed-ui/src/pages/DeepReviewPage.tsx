import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { QueueDisposition } from "../types/index";
import {
  getMatch,
  getPatient,
  getTrial,
  matches,
  assessments,
  evidenceSnippets,
  timelineEvents,
} from "../data/index";
import { formatDisposition } from "../data/helpers";
import { useScrollCollapse } from "../hooks/useScrollCollapse";
import { ReviewProvider, useReview } from "../context/ReviewContext";

import { PageCrosslinks } from "../components/layout/PageCrosslinks";
import { EntitySwitcher, type EntitySwitcherItem } from "../components/layout/EntitySwitcher";
import { CollapsibleHeader } from "../components/deep-review/CollapsibleHeader";
import { WhyNowBanner } from "../components/deep-review/WhyNowBanner";
import { CriterionStatusBar } from "../components/deep-review/CriterionStatusBar";
import { CriterionAccordion } from "../components/deep-review/CriterionAccordion";
import { EvidencePanel } from "../components/deep-review/EvidencePanel";
import { TemporalBar, type ExclusionWindow } from "../components/deep-review/TemporalBar";
import { PatientNav } from "../components/deep-review/PatientNav";
import { TrialComparisonStrip } from "../components/deep-review/TrialComparisonStrip";
import { CollaborationPanel } from "../components/deep-review/CollaborationPanel";
import { DeepReviewLayout } from "../components/deep-review/DeepReviewLayout";

const dispositionOptions: QueueDisposition[] = [
  "candidate_for_outreach",
  "needs_pi_review",
  "reviewed_not_actionable",
  "closed_not_eligible",
  "protocol_question",
];

function DeepReviewContent() {
  const { matchId } = useParams<{ matchId: string }>();
  const { collapsed, scrollRef } = useScrollCollapse(80);
  const {
    expandedCriterionId,
    toggleCriterion,
    evidencePanelCriterionId,
    disposition,
    setDisposition,
    savedBanner,
    saveReview,
    setHeaderCollapsed,
  } = useReview();

  // Sync scroll-based collapse into context
  React.useEffect(() => {
    setHeaderCollapsed(collapsed);
  }, [collapsed, setHeaderCollapsed]);

  const match = getMatch(matchId ?? "");
  const patient = match ? getPatient(match.patientId) : undefined;
  const trial = match ? getTrial(match.trialId) : undefined;

  const matchAssessments = useMemo(() => {
    if (!match) return [];
    return assessments.filter((a) => match.criterionIds.includes(a.id));
  }, [match]);

  const patientEvidence = useMemo(() => {
    if (!patient) return [];
    return evidenceSnippets.filter((e) => e.patientId === patient.id);
  }, [patient]);

  const patientTimeline = useMemo(() => {
    if (!patient) return [];
    return timelineEvents.filter((e) => e.patientId === patient.id);
  }, [patient]);

  // Compute temporal exclusion windows from any failing "Temporal exclusion"
  // criterion that references a dated evidence anchor. For Angela Brooks this
  // resolves to: NSTEMI Nov 5 2025 + 180 days → window ends May 4 2026.
  const exclusionWindows = useMemo<ExclusionWindow[]>(() => {
    if (!match) return [];
    const windows: ExclusionWindow[] = [];
    for (const criterion of matchAssessments) {
      if (criterion.status !== "fail") continue;
      if (criterion.bucket !== "Temporal exclusion") continue;
      // Pull threshold length (e.g. "180-day lookback from planned screening date")
      const m = (criterion.thresholdLabel ?? "").match(/(\d+)[- ]day/i);
      if (!m) continue;
      const days = parseInt(m[1], 10);
      // Anchor = earliest supporting evidence date attached to this criterion.
      const linkedEvidence = patientEvidence.filter((e) =>
        criterion.evidenceIds.includes(e.id) && e.tone === "supporting"
      );
      if (linkedEvidence.length === 0) continue;
      const anchor = linkedEvidence.reduce((earliest, e) =>
        new Date(e.sourceDate).getTime() < new Date(earliest.sourceDate).getTime()
          ? e
          : earliest
      );
      const anchorDate = new Date(anchor.sourceDate);
      const endDate = new Date(anchorDate.getTime() + days * 86400000);
      windows.push({
        id: `window-${criterion.id}`,
        startDate: anchor.sourceDate,
        endDate: endDate.toDateString(),
        label: `${days}-day lookback`,
        detail: `${criterion.label} — anchor ${anchor.sourceDocument}`,
        tone: "critical",
      });
    }
    return windows;
  }, [match, matchAssessments, patientEvidence]);

  // Build the entity-switcher items for all matches. Chip label is the patient
  // name and sublabel is the trial shortcode — this disambiguates multi-match
  // patients (e.g., Priya appears twice, once per trial).
  // NOTE: the URL id is matchId, not patientId. For a patient with two matches,
  // each produces its own chip. The sublabel makes the "this patient on this
  // trial" framing visually obvious.
  const matchItems: EntitySwitcherItem[] = matches.map((m) => {
    const p = getPatient(m.patientId);
    const t = getTrial(m.trialId);
    return {
      id: m.id,
      label: p?.name ?? m.patientId,
      sublabel: t?.shortCode,
      href: `/review/${m.id}`,
      title: `${p?.name ?? ""} — ${t?.title ?? ""}`.trim(),
    };
  });

  if (!match || !patient || !trial) {
    return (
      <div className="deep-review" style={{ padding: "var(--space-8)", textAlign: "center" }}>
        <h2>Match not found</h2>
        <p style={{ color: "var(--ink-muted)" }}>
          No match record found for ID: {matchId}
        </p>
      </div>
    );
  }

  return (
    <div
      className="deep-review"
      ref={scrollRef as React.RefObject<HTMLDivElement>}
      style={{ overflow: "auto", maxHeight: "100vh", padding: "var(--space-4)" }}
    >
      {/* 1. Collapsible Header */}
      <CollapsibleHeader
        patient={patient}
        match={match}
        trial={trial}
        collapsed={collapsed}
      />

      {/* 1b. Cross-links: audit + trial config for this match */}
      <PageCrosslinks
        links={[
          { label: `View audit trace`, to: `/audit/${match.id}` },
          {
            label: `Configure trial ${trial.shortCode}`,
            to: `/trials/${trial.id}`,
          },
        ]}
      />

      {/* 1c. Sibling-match switcher — flip between any match in the pilot stack */}
      <EntitySwitcher
        eyebrow="Switch patient"
        items={matchItems}
        currentId={match.id}
      />

      {/* 2. Why Now Banner */}
      <WhyNowBanner matchId={match.id} />

      {/* 3. Criterion Status Bar */}
      <CriterionStatusBar criteria={matchAssessments} />

      {/* 4. Trial Comparison Strip */}
      <TrialComparisonStrip
        patientId={patient.id}
        currentTrialId={trial.id}
      />

      {/* 5. Split Layout: Criteria + Evidence */}
      <DeepReviewLayout>
        {/* Left pane: Criterion Accordions */}
        <div>
          {matchAssessments.map((criterion) => (
            <CriterionAccordion
              key={criterion.id}
              criterion={criterion}
              evidence={patientEvidence}
              isExpanded={expandedCriterionId === criterion.id}
              onToggle={() => toggleCriterion(criterion.id)}
            />
          ))}
        </div>

        {/* Right pane: Evidence Panel */}
        <EvidencePanel
          criterionId={evidencePanelCriterionId}
          allEvidence={patientEvidence}
        />
      </DeepReviewLayout>

      {/* 6. Temporal Bar */}
      <TemporalBar
        events={patientTimeline}
        screeningDate="Apr 6, 2026"
        exclusionWindows={exclusionWindows}
      />

      {/* 7. Disposition Selector */}
      <div
        className="deep-review__bottom"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-4) 0",
        }}
      >
        <label
          style={{
            fontSize: "var(--text-small)",
            fontWeight: "var(--weight-semibold)" as string,
            color: "var(--ink-secondary)",
          }}
        >
          Disposition:
        </label>
        <select
          className="filter-bar__select"
          value={disposition}
          onChange={(e) => setDisposition(e.target.value as QueueDisposition)}
        >
          {dispositionOptions.map((d) => (
            <option key={d} value={d}>
              {formatDisposition(d)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="inline-override__save"
          onClick={saveReview}
        >
          Save Review
        </button>
      </div>

      {/* 8. Success Banner */}
      {savedBanner && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--moss-50)",
            color: "var(--moss-500)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-small)",
            fontWeight: "var(--weight-semibold)" as string,
            marginBottom: "var(--space-4)",
            border: "1px solid var(--moss-200, var(--moss-50))",
          }}
        >
          {savedBanner}
        </div>
      )}

      {/* 10. Collaboration Panel */}
      <CollaborationPanel matchId={match.id} />

      {/* 9. Floating Patient Nav */}
      <PatientNav />
    </div>
  );
}

export default function DeepReviewPage() {
  return (
    <ReviewProvider>
      <DeepReviewContent />
    </ReviewProvider>
  );
}
