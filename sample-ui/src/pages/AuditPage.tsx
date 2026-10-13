import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { AuditPanel } from "../components/AuditPanel";
import { DetailContextBar } from "../components/DetailContextBar";
import {
  CoverageCompositionBar,
  DecisionTraceRail,
  ProvenanceRiver
} from "../components/visuals/AuditVisuals";
import { AuditSwimlane } from "../features/audit/components/viz/AuditSwimlane";
import { StatusChip } from "../components/StatusChip";
import {
  buildCoverageComposition,
  buildProvenanceGroups,
  buildTraceNodes,
  filterEvidenceForTrace
} from "../lib/visualAdapters";
import {
  findMatchByPatientAndTrial,
  getMatchReviewPackage,
  getPatientEvidenceBundle,
  listMatchesForPatient,
  listPatientsWithMatches
} from "../data/mockApi";
import { useVisualFocusStore } from "../stores/visualFocus";

// Stable reference — returning a fresh [] from a zustand selector trips
// React's useSyncExternalStore infinite-loop detection.
// Never mutated — reference-stable shared fallback used when the visual
// focus store points at a different route.
const EMPTY_TERMS: string[] = [];

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

export function AuditPage() {
  const navigate = useNavigate();
  const { matchId = "match-001" } = useParams();
  const reviewPackage = getMatchReviewPackage(matchId);
  const patientOptions = useMemo(() => listPatientsWithMatches(), []);
  const selectedPatientId =
    reviewPackage?.patient.id ?? patientOptions[0]?.id ?? "";
  const patientMatchOptions = useMemo(
    () => (selectedPatientId ? listMatchesForPatient(selectedPatientId) : []),
    [selectedPatientId]
  );
  const trialOptions = patientMatchOptions.map((option) => ({
    value: option.trialId,
    label: option.trialLabel
  }));
  const selectedTrialId =
    reviewPackage?.trial.id ?? patientMatchOptions[0]?.trialId ?? "";
  // Split the selector — see CockpitPage rationale.
  const routeKind = useVisualFocusStore((state) => state.routeKind);
  const storeTerms = useVisualFocusStore((state) => state.terms);
  const highlightTerms = routeKind === "audit" ? storeTerms : EMPTY_TERMS;
  const traceNodes = useMemo(
    () => buildTraceNodes(reviewPackage?.audit ?? []),
    [matchId]
  );
  const [selectedTraceId, setSelectedTraceId] = useState(traceNodes[0]?.id ?? "");
  // Wave B — ref to the swimlane section so clicking a trace rail node
  // scrolls the paired swimlane event into view. The state sync is already
  // wired (selectedTraceId drives selectedEventId on AuditSwimlane), so we
  // just need to bring the swimlane into the user's viewport.
  const swimlaneRef = useRef<HTMLDivElement | null>(null);

  const handleTraceSelect = useCallback((id: string) => {
    setSelectedTraceId(id);
    // Use requestAnimationFrame so the DOM can flush the aria-selected +
    // highlight update before the scroll starts. Smooth scroll respects
    // prefers-reduced-motion at the browser level.
    requestAnimationFrame(() => {
      swimlaneRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth"
      });
    });
  }, []);

  useEffect(() => {
    setSelectedTraceId(traceNodes[0]?.id ?? "");
  }, [matchId]);

  if (!reviewPackage) {
    return (
      <AppShell
        title="Audit View"
        subtitle="Trace data is unavailable for this mock route."
      >
        <section className="surface">
          <p>No sample audit data exists for this match route.</p>
        </section>
      </AppShell>
    );
  }

  const { match, patient, trial, audit, evidence, missingData, contradictions } = reviewPackage;
  const evidenceBundle = getPatientEvidenceBundle(patient.id);
  const selectedTraceNode =
    traceNodes.find((node) => node.id === selectedTraceId) ?? traceNodes[0];
  const filteredEvidence = filterEvidenceForTrace(evidence, selectedTraceNode);
  const provenanceGroups = buildProvenanceGroups(filteredEvidence);
  const coverageModel = buildCoverageComposition(
    evidenceBundle,
    contradictions,
    missingData
  );

  return (
    <AppShell
      title="Audit View"
      subtitle="Audit is now organized around a decision trace rail, provenance river, and coverage composition so reviewers can replay the case visually."
      compactAlerts
    >
      <DetailContextBar
        eyebrow="Replay context"
        title="Switch patient or trial while staying in the audit route"
        description="Use the same patient-first context switch here to inspect a different match history without leaving audit."
        fields={[
          {
            id: "audit-patient-select",
            label: "Patient",
            value: selectedPatientId,
            options: patientOptions.map((option) => ({
              value: option.id,
              label: option.label
            })),
            onChange: (patientId) => {
              const nextMatch = listMatchesForPatient(patientId)[0];

              if (nextMatch) {
                navigate(`/audit/${nextMatch.matchId}`);
              }
            }
          },
          {
            id: "audit-trial-select",
            label: "Trial",
            value: selectedTrialId,
            options: trialOptions,
            onChange: (trialId) => {
              const nextMatch = findMatchByPatientAndTrial(selectedPatientId, trialId);

              if (nextMatch) {
                navigate(`/audit/${nextMatch.matchId}`);
              }
            }
          }
        ]}
        actions={
          <div className="stacked-chips">
            <StatusChip label={match.recommendation} tone="paper" compact />
            <StatusChip label={`${audit.length} audit events`} tone="teal" compact />
          </div>
        }
      />

      <div className="audit-workspace">
        <section className="surface audit-workspace__main">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Trace summary</p>
              <h3>
                {patient.name} | {trial.shortCode}
              </h3>
              <p className="panel-copy">
                Keep the trace summary, decision rail, and replay lane in one
                continuous surface so the audit flow reads like a single replay
                tool instead of disconnected sections.
              </p>
            </div>
            <div className="stacked-chips">
              <StatusChip label="rules-0.9.8" tone="paper" />
              <StatusChip label="prompt-criteria-1.4" tone="paper" />
              <StatusChip label="gpt-5.4-mini" tone="teal" />
            </div>
          </div>

          {/* Wave D.2 — 3-col summary-list key/value grid converted to a
             horizontal chips strip. Reuses .admin-summary-chips styling via
             the shared chip block. Same 6 facts, denser vertical footprint. */}
          <div
            className="audit-workspace__summary admin-summary-chips"
            role="list"
            aria-label="Audit summary facts"
          >
            <div className="admin-summary-chip" role="listitem">
              <span>Recommendation state</span>
              <strong>{match.recommendation}</strong>
            </div>
            <div className="admin-summary-chip" role="listitem">
              <span>Queue owner</span>
              <strong>{match.owner}</strong>
            </div>
            <div className="admin-summary-chip" role="listitem">
              <span>Disposition</span>
              <strong>{humanize(match.nextStep)}</strong>
            </div>
            <div className="admin-summary-chip" role="listitem">
              <span>Evidence bundle</span>
              <strong>{evidenceBundle.items.length} cited records</strong>
            </div>
            <div className="admin-summary-chip" role="listitem">
              <span>Missing domains</span>
              <strong>{evidenceBundle.missingDomains.join(" | ") || "None"}</strong>
            </div>
            <div className="admin-summary-chip" role="listitem">
              <span>Contradiction summary</span>
              <strong>{match.contradictionSummary ?? "No contradiction"}</strong>
            </div>
          </div>

          <DecisionTraceRail
            nodes={traceNodes}
            selectedId={selectedTraceNode?.id ?? ""}
            onSelect={handleTraceSelect}
            highlightTerms={highlightTerms}
          />

          <div ref={swimlaneRef} className="audit-workspace__swimlane">
            <AuditSwimlane
              events={audit}
              selectedEventId={selectedTraceNode?.id}
              onEventClick={setSelectedTraceId}
            />
          </div>
        </section>

        <aside className="audit-workspace__rail">
          <CoverageCompositionBar model={coverageModel} />

          <section className="surface audit-workspace__inspector">
            <div className="panel-heading">
              <div>
                <p className="eyebrow-label">Supporting inspector</p>
                <h3>Provenance, excerpts, and raw replay stay visible together</h3>
                <p className="panel-copy">
                  The replay rail now keeps evidence origin, filtered excerpts,
                  and the raw audit log on-screen together so nothing reads like
                  a missing feature.
                </p>
              </div>
            </div>

            <ProvenanceRiver
              groups={provenanceGroups}
              highlightTerms={highlightTerms}
              embedded
            />

            <section className="surface surface--embedded">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow-label">Evidence excerpts</p>
                  <h3>Trace-filtered source text</h3>
                </div>
                <StatusChip label={`${filteredEvidence.length} excerpts`} tone="paper" compact />
              </div>

              <div className="evidence-stack">
                {filteredEvidence.map((item) => (
                  <article key={item.id} className="evidence-card">
                    <div className="evidence-card__top">
                      <StatusChip label={item.type} tone="paper" compact />
                      <span>{item.sourceDate}</span>
                    </div>
                    <strong>{item.sourceDocument}</strong>
                    <p>{item.excerpt}</p>
                    <div className="evidence-card__meta">
                      <span>{item.sourceSystem}</span>
                      <span>{item.author}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="surface surface--embedded">
              <AuditPanel events={audit} />
            </section>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
