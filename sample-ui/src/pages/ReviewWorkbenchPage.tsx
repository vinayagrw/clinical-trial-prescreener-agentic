import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ActionRibbon } from "../components/ActionRibbon";
import { AppShell } from "../components/AppShell";
import { AuditPanel } from "../components/AuditPanel";
import { DetailContextBar } from "../components/DetailContextBar";
import { PatientSummaryHeader } from "../components/PatientSummaryHeader";
import {
  EligibilityAtlas,
  EvidenceWeave,
  ResolutionBoard
} from "../components/visuals/ReviewVisuals";
import { StatusChip } from "../components/StatusChip";
import { CriterionDotMatrix } from "../features/review/components/viz/CriterionDotMatrix";
import { PatientTemporalBar } from "../features/review/components/viz/PatientTemporalBar";
import {
  buildEligibilityAtlas,
  buildResolutionBoard,
  buildTimelineWindows
} from "../lib/visualAdapters";
import {
  findMatchByPatientAndTrial,
  getMatchReviewPackage,
  getPatientEvidenceBundle,
  listMatchesForPatient,
  listPatientsWithMatches,
  listTrials
} from "../data/mockApi";
import {
  useCommitTrialReviewMutation,
  useTrialReviewCommitQuery,
} from "../data/queries/trialReviews";
import { useImportedTrialsStore } from "../stores/importedTrials";
import { useVisualFocusStore } from "../stores/visualFocus";
import { useAiReviewModeStore } from "../stores/aiReviewMode";
import type { MatchStatus, QueueDisposition } from "../types";

// Lazy-load the AI Live overlay so the default read-only render path pays
// zero bundle cost when the toggle is OFF (the plan's acceptance criterion
// is that /review/match-001 with AI Live OFF is byte-for-byte identical).
const AiLiveOverlay = lazy(() => import("../features/reviewAi/AiLiveOverlay"));

// Stable reference to avoid useSyncExternalStore infinite-loop detection
// when the selector's fallback branch fires.
// Never mutated — reference-stable shared fallback used when the visual
// focus store points at a different route.
const EMPTY_TERMS: string[] = [];

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

interface RelatedTrialCard {
  id: string;
  title: string;
  fit: string;
  detail: string;
  route?: string;
}

export function ReviewWorkbenchPage() {
  const navigate = useNavigate();
  const { matchId = "match-001" } = useParams();
  const importedTrialsUpdatedAt = useImportedTrialsStore((state) => state.updatedAt);
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
  // Split the selector into two primitive/stable-reference reads — see
  // CockpitPage for the rationale.
  const routeKind = useVisualFocusStore((state) => state.routeKind);
  const storeTerms = useVisualFocusStore((state) => state.terms);
  const highlightTerms = routeKind === "review" ? storeTerms : EMPTY_TERMS;

  const [selectedCriterionId, setSelectedCriterionId] = useState(
    reviewPackage?.assessments[0]?.id ?? ""
  );
  const [overrideStatus, setOverrideStatus] = useState<MatchStatus>("uncertain");
  const [disposition, setDisposition] = useState<QueueDisposition>(
    reviewPackage?.match.nextStep ?? "needs_pi_review"
  );
  const [rationale, setRationale] = useState(
    "MRI wording conflict still needs PI interpretation before any outreach step."
  );
  const [savedBanner, setSavedBanner] = useState("");

  useEffect(() => {
    setSelectedCriterionId(reviewPackage?.assessments[0]?.id ?? "");
    setDisposition(reviewPackage?.match.nextStep ?? "needs_pi_review");
  }, [matchId, reviewPackage?.match.nextStep]);

  useEffect(() => {
    const selectedCriterion = reviewPackage?.assessments.find(
      (criterion) => criterion.id === selectedCriterionId
    );

    if (selectedCriterion) {
      setOverrideStatus(selectedCriterion.status);
    }
  }, [selectedCriterionId, matchId, reviewPackage?.assessments]);

  const relatedTrialCards = useMemo<RelatedTrialCard[]>(() => {
    if (!reviewPackage) {
      return [];
    }

    const alternateMatches = patientMatchOptions
      .filter((option) => option.matchId !== reviewPackage.match.id)
      .map((option) => ({
        id: option.matchId,
        title: option.trialLabel,
        fit: "Matched for this patient",
        detail:
          "Open the alternate patient-trial match from the current workbench context.",
        route: `/review/${option.matchId}`
      }));

    const matchedTrialIds = new Set(patientMatchOptions.map((option) => option.trialId));
    const watchlistCards = listTrials()
      .filter((option) => option.id !== reviewPackage.trial.id && !matchedTrialIds.has(option.id))
      .slice(0, Math.max(1, 2 - alternateMatches.length))
      .map((option) => ({
        id: option.id,
        title: option.label,
        fit: option.status === "active" ? "Watchlist only" : "Unavailable in pilot",
        detail:
          option.status === "active"
            ? "No current patient-trial match exists yet. Keep this option on the watchlist until new evidence lands."
            : "This trial is not actionable for the selected patient in the current pilot scope."
      }));

    return [...alternateMatches, ...watchlistCards];
  }, [importedTrialsUpdatedAt, patientMatchOptions, reviewPackage]);
  const trialReviewEntityId = reviewPackage
    ? `${reviewPackage.patient.id}:${reviewPackage.trial.id}`
    : undefined;
  const committedTrialReviewQuery = useTrialReviewCommitQuery(trialReviewEntityId);
  const commitTrialReviewMutation = useCommitTrialReviewMutation(trialReviewEntityId);

  if (!reviewPackage) {
    return (
      <AppShell
        title="Review Workbench"
        subtitle="Mock review data is unavailable for this route."
      >
        <section className="surface">
          <p>No sample data exists for this match route.</p>
        </section>
      </AppShell>
    );
  }

  const {
    match,
    patient,
    trial,
    assessments,
    evidence,
    timeline,
    audit,
    missingData,
    contradictions,
    piHandoff
  } = reviewPackage;

  // Read AI Live state for the current matchId. Default is OFF so the read-only
  // render path is byte-for-byte unchanged. When ON, the lazy `<AiLiveOverlay />`
  // renders below the PatientSummaryHeader and pulls in the 4 review-AI panels.
  const aiLiveEnabled = useAiReviewModeStore((s) => Boolean(s.enabled[match.id]));
  const toggleAiLive = useAiReviewModeStore((s) => s.toggle);
  const selectedCriterion =
    assessments.find((criterion) => criterion.id === selectedCriterionId) ?? assessments[0];
  const selectedEvidence = evidence.filter((item) =>
    selectedCriterion?.evidenceIds.includes(item.id)
  );
  const evidenceBundle = getPatientEvidenceBundle(patient.id);
  const rationaleTrimmed = rationale.trim();
  const atlasGroups = buildEligibilityAtlas(assessments);
  const resolutionItems = buildResolutionBoard(contradictions, missingData);
  const timelineWindows = buildTimelineWindows(selectedCriterion);

  return (
    <AppShell
      title="Patient Evidence Workbench"
      subtitle="Criterion review now runs through an atlas, evidence weave, resolution board, and washout timeline instead of long text-only stacks."
    >
      <DetailContextBar
        eyebrow="Case context"
        title="Pull another patient or trial without leaving review"
        description="Switch patient first, then move between that patient's matched trials from the same review route."
        fields={[
          {
            id: "review-patient-select",
            label: "Patient",
            value: selectedPatientId,
            options: patientOptions.map((option) => ({
              value: option.id,
              label: option.label
            })),
            onChange: (patientId) => {
              const nextMatch = listMatchesForPatient(patientId)[0];

              if (nextMatch) {
                navigate(`/review/${nextMatch.matchId}`);
              }
            }
          },
          {
            id: "review-trial-select",
            label: "Trial",
            value: selectedTrialId,
            options: trialOptions,
            onChange: (trialId) => {
              const nextMatch = findMatchByPatientAndTrial(selectedPatientId, trialId);

              if (nextMatch) {
                navigate(`/review/${nextMatch.matchId}`);
              }
            }
          }
        ]}
        actions={
          <div className="stacked-chips">
            <StatusChip label={match.storyCategory ?? "Review context"} tone="paper" compact />
            <StatusChip label={`${match.fitScore} fit`} tone="teal" compact />
          </div>
        }
      />

      <PatientSummaryHeader patient={patient} trial={trial} match={match} />

      <div className="review-ai-toggle-row">
        <button
          type="button"
          className={`review-ai-toggle${aiLiveEnabled ? " review-ai-toggle--on" : ""}`}
          onClick={() => toggleAiLive(match.id)}
          aria-pressed={aiLiveEnabled}
        >
          <span className="review-ai-toggle__dot" aria-hidden="true" />
          AI Live {aiLiveEnabled ? "on" : "off"}
        </button>
        <span className="review-ai-toggle__hint">
          {aiLiveEnabled
            ? "Showing live F1–F4 overlays against the active patient/trial. Default read-only content stays below."
            : "Toggle ON to overlay live F1–F4 AI outputs against this case. Default read-only view is unchanged."}
        </span>
      </div>

      {aiLiveEnabled ? (
        <Suspense
          fallback={
            <section className="review-ai-loading" role="status">
              Loading AI Live overlay…
            </section>
          }
        >
          <AiLiveOverlay />
        </Suspense>
      ) : null}

      <ActionRibbon
        eyebrow="Why now"
        title="Current case action ribbon"
        items={[
          {
            label: "What changed",
            value:
              match.whatChangedSinceLastReview?.[0] ??
              "New evidence changed the review state overnight."
          },
          {
            label: "Primary blocker",
            value:
              match.blockingReasonPrimary ??
              "One exclusion and one contradiction remain unresolved."
          },
          {
            label: "Missing domains",
            value: match.missingDomains?.join(" | ") || "No material domain gaps."
          },
          {
            label: "Next action",
            value:
              match.nextRecommendedAction ??
              "Prepare PI escalation before any outreach action."
          }
        ]}
      />

      {savedBanner ? (
        <div className="callout callout--success">
          <strong>Prototype workflow state updated</strong>
          <p>{savedBanner}</p>
        </div>
      ) : null}

      {committedTrialReviewQuery.data ? (
        <div className="callout callout--success">
          <strong>Screening artifact is committed</strong>
          <p>
            Overall eligibility: {committedTrialReviewQuery.data.overallEligibility ?? "pending"}.
            Last applied {new Date(committedTrialReviewQuery.data.committedAt).toLocaleString()}.
          </p>
        </div>
      ) : (
        <div className="callout callout--warning">
          <strong>Finalize screening first</strong>
          <p>
            This workbench now writes reviewer overrides into the committed screening artifact.
            Run and finalize `/screening` for this patient/trial before applying a final disposition here.
          </p>
        </div>
      )}

      <div className="review-workspace">
        <div className="review-workspace__main">
          <CriterionDotMatrix
            assessments={assessments}
            selectedCriterionId={selectedCriterion?.id ?? ""}
            onCriterionClick={setSelectedCriterionId}
          />

          <EligibilityAtlas
            groups={atlasGroups}
            selectedCriterionId={selectedCriterion?.id ?? ""}
            onSelect={setSelectedCriterionId}
            highlightTerms={highlightTerms}
          />

          <PatientTemporalBar
            events={timeline}
            windows={timelineWindows}
            anchorLabel={selectedCriterion?.lastEvaluatedAt ?? "Current screening run"}
            anchorDate={selectedCriterion?.lastEvaluatedAt}
            highlightTerms={highlightTerms}
          />
        </div>

        <aside className="review-workspace__rail">
          {selectedCriterion ? (
            <EvidenceWeave
              assessment={selectedCriterion}
              evidence={selectedEvidence}
              highlightTerms={highlightTerms}
              embedded
            />
          ) : null}

          <ResolutionBoard
            items={resolutionItems}
            highlightTerms={highlightTerms}
            embedded
          />

          <section className="surface review-workspace__inspector">
            <div className="panel-heading">
              <div>
                <p className="eyebrow-label">Right rail</p>
                <h3>Context, action, and audit stay visible beside the criterion</h3>
                <p className="panel-copy">
                  Evidence and resolution stay live above; this rail now keeps
                  related trials, preserved handoff detail, final actions, and
                  audit replay visible together instead of hiding them behind
                  tab state.
                </p>
              </div>
            </div>

            <div className="workspace-stack workspace-stack--tight">
              <section className="workspace-panel">
                <div className="card-row">
                  <div>
                    <p className="eyebrow-label">Task modes</p>
                    <strong>Active review context</strong>
                  </div>
                  <div className="stacked-chips">
                    {(match.taskModes ?? []).map((mode) => (
                      <StatusChip key={mode} label={humanize(mode)} tone="paper" compact />
                    ))}
                  </div>
                </div>

                <div className="candidate-stack candidate-stack--compact">
                  {relatedTrialCards.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`candidate-card candidate-card--interactive ${
                        option.route ? "" : "candidate-card--disabled"
                      }`}
                      disabled={!option.route}
                      onClick={() => {
                        if (option.route) {
                          navigate(option.route);
                        }
                      }}
                    >
                      <strong>{option.title}</strong>
                      <span>{option.fit}</span>
                      <p>{option.detail}</p>
                      <small className="candidate-card__hint">
                        {option.route
                          ? "Open this review context"
                          : "No live match available for direct review"}
                      </small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="workspace-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow-label">Case coverage</p>
                    <h3>What the reviewer still needs</h3>
                  </div>
                </div>
                <div className="detail-list detail-list--tight">
                  <div className="detail-list__row">
                    <strong>Coverage summary</strong>
                    <span>{evidenceBundle.coverageSummary}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Freshness</strong>
                    <span>{evidenceBundle.freshnessSummary}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Missing domains</strong>
                    <span>{evidenceBundle.missingDomains.join(" | ") || "None"}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Contradiction summary</strong>
                    <span>{match.contradictionSummary ?? "No active contradiction"}</span>
                  </div>
                </div>
              </section>

              {piHandoff ? (
                <section className="workspace-panel">
                  <div className="card-row">
                    <div>
                      <p className="eyebrow-label">PI escalation</p>
                      <strong>Preserved-context handoff packet</strong>
                    </div>
                    <StatusChip label="Ask Agent ready" tone="teal" compact />
                  </div>

                  <p className="panel-copy">{piHandoff.summary}</p>

                  <div className="detail-list detail-list--tight">
                    <div className="detail-list__row">
                      <strong>Owner</strong>
                      <span>{piHandoff.owner}</span>
                    </div>
                    <div className="detail-list__row">
                      <strong>Due by</strong>
                      <span>{piHandoff.dueBy}</span>
                    </div>
                    <div className="detail-list__row">
                      <strong>Decision needed</strong>
                      <span>{piHandoff.decisionNeeded}</span>
                    </div>
                    <div className="detail-list__row">
                      <strong>Evidence bundle</strong>
                      <span>{evidenceBundle.coverageSummary}</span>
                    </div>
                  </div>

                  <div className="signal-list">
                    {piHandoff.questions.map((question) => (
                      <div key={question} className="signal-list__item">
                        <strong>Question</strong>
                        <p>{question}</p>
                      </div>
                    ))}
                  </div>

                  <div className="stacked-chips">
                    {piHandoff.recommendedArtifacts.map((artifact) => (
                      <StatusChip key={artifact} label={artifact} tone="paper" compact />
                    ))}
                  </div>
                </section>
              ) : (
                <section className="workspace-panel">
                  <p>No PI handoff exists for this case.</p>
                </section>
              )}

              <section className="workspace-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow-label">Review actions</p>
                    <h3>Override and disposition</h3>
                  </div>
                </div>

                <div className="stacked-chips">
                  {(["pass", "fail", "uncertain", "manual_review"] as MatchStatus[]).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        className={`chip-toggle ${
                          overrideStatus === status ? "chip-toggle--active" : ""
                        }`}
                        onClick={() => setOverrideStatus(status)}
                      >
                        {humanize(status)}
                      </button>
                    )
                  )}
                </div>

                <label className="field-label" htmlFor="disposition">
                  Final queue disposition
                </label>
                <select
                  id="disposition"
                  className="input"
                  value={disposition}
                  onChange={(event) =>
                    setDisposition(event.target.value as QueueDisposition)
                  }
                >
                  <option value="candidate_for_outreach">candidate_for_outreach</option>
                  <option value="needs_pi_review">needs_pi_review</option>
                  <option value="protocol_question">protocol_question</option>
                  <option value="reviewed_not_actionable">
                    reviewed_not_actionable
                  </option>
                  <option value="closed_not_eligible">closed_not_eligible</option>
                </select>

                <label className="field-label" htmlFor="rationale">
                  Reviewer rationale
                </label>
                <textarea
                  id="rationale"
                  className="textarea"
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                />

                <div className="detail-list detail-list--tight">
                  <div className="detail-list__row">
                    <strong>Selected criterion</strong>
                    <span>{selectedCriterion?.label ?? "None"}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Evidence freshness</strong>
                    <span>{evidenceBundle.freshnessSummary}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Missing domains</strong>
                    <span>{evidenceBundle.missingDomains.join(" | ") || "None"}</span>
                  </div>
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      !rationaleTrimmed ||
                      !selectedCriterion ||
                      !committedTrialReviewQuery.data ||
                      commitTrialReviewMutation.isPending
                    }
                    onClick={async () => {
                      if (
                        !selectedCriterion ||
                        !rationaleTrimmed ||
                        !committedTrialReviewQuery.data
                      ) {
                        return;
                      }
                      try {
                        await commitTrialReviewMutation.mutateAsync({
                          runId: committedTrialReviewQuery.data.runId,
                          checkpointId: committedTrialReviewQuery.data.checkpointId,
                          featureLabel: committedTrialReviewQuery.data.featureLabel,
                          rationale: rationaleTrimmed,
                          disposition,
                          finalRecommendation: disposition,
                          override: {
                            criterionId: selectedCriterion.id,
                            criterionLabel: selectedCriterion.label,
                            reviewerStatus: overrideStatus,
                          },
                        });
                        setSavedBanner(
                          `Applied ${overrideStatus} for ${selectedCriterion.label} and updated the committed trial disposition to ${disposition}.`,
                        );
                      } catch (error) {
                        setSavedBanner(
                          error instanceof Error
                            ? error.message
                            : "Unable to update the committed trial review.",
                        );
                      }
                    }}
                  >
                    Save override and finalize
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSavedBanner("")}
                  >
                    Clear banner
                  </button>
                </div>
              </section>

              <AuditPanel events={audit} />
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
