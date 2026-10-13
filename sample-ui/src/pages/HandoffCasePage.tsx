import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DisagreementPanel } from "../components/DisagreementPanel";
import { DocumentFeed } from "../components/DocumentFeed";
import { HandoffShell } from "../components/HandoffShell";
import { HumanReviewPanel } from "../components/HumanReviewPanel";
import { MetricCard } from "../components/MetricCard";
import { ProvenancePanel } from "../components/ProvenancePanel";
import { SbarSection } from "../components/SbarSection";
import {
  useCommittedHandoffQuery,
  useGenerateHandoffMutation,
  useHandoffQuery,
  usePatientDocumentsQuery,
} from "../data/queries/handoffs";
import { getEffectiveReviewOutput, useAiReviewRunSync } from "../lib/reviews";
import type { WindowHours } from "../types";
import { useUiStore } from "../stores/ui";

const windowChoices: WindowHours[] = [24, 48, 72];

export function HandoffCasePage() {
  const { handoffId } = useParams();
  const navigate = useNavigate();
  const pushToast = useUiStore((state) => state.pushToast);
  const handoffQuery = useHandoffQuery(handoffId);
  const generateMutation = useGenerateHandoffMutation();
  const record = handoffQuery.data;
  const committedHandoffQuery = useCommittedHandoffQuery(handoffId);
  const [selectedWindow, setSelectedWindow] = useState<WindowHours>(72);

  useEffect(() => {
    if (record) {
      setSelectedWindow(record.windowHours);
    }
  }, [record]);

  const documentsQuery = usePatientDocumentsQuery(record?.patientId, record?.windowHours);
  const citationMap = useMemo(
    () =>
      Object.fromEntries(
        (record?.summary.citations ?? []).map((citation) => [citation.id, citation]),
      ),
    [record?.summary.citations],
  );
  const reviewRun = useAiReviewRunSync(
    record
      ? {
          sourceKey: `handoff:${record.id}`,
          featureKey: "handoff_sbar_summary",
          featureLabel: "Clinical handoff SBAR",
          stageKey: "summarization",
          workspace: "handoff",
          entityType: "handoff_record",
          entityId: record.id,
          entityLabel: `${record.patientName} / ${record.primaryService}`,
          deepLink: `/handoffs/${record.id}`,
          summary: `${record.summary.status} summary with ${record.summary.disagreements.length} disagreements and ${record.summary.missingInfo.length} missing-info markers.`,
          promptSnapshot: {
            windowHours: record.windowHours,
            handoffId: record.id,
          },
          inputSnapshot: {
            patientId: record.patientId,
            encounterId: record.encounterId,
            windowHours: record.windowHours,
          },
          outputSnapshot: record,
          provider: "local-handoff-pipeline",
          model: "deterministic+heuristic",
          policy: "required_before_apply",
          allowedActions: [
            "approve_as_is",
            "edit_output",
            "modify_evidence",
            "edit_input_and_rerun",
            "override",
            "reject",
            "escalate_manual_review",
            "finalize_apply",
            "revert_to_ai_draft",
          ],
          commitTargetType: "handoff",
          commitTargetId: record.id,
          editableFields: ["inputSnapshot", "outputSnapshot", "citations"],
          requiredFields: ["rationale"],
          citations: record.summary.citations.map((citation) => ({
            id: citation.id,
            label: `${citation.documentTitle} · ${citation.service}`,
            detail: new Date(citation.authoredAt).toLocaleString(),
            quote: citation.quotedEvidence,
            tone: "supporting",
          })),
          safetyFlags: [
            ...record.summary.disagreements
              .filter((disagreement) => disagreement.requiresHumanReview)
              .map((disagreement) => ({
                id: disagreement.id,
                label: disagreement.summary,
                detail: "Conflicting cross-service documentation remains unresolved and must stay visible.",
                severity: "critical" as const,
              })),
            ...record.summary.missingInfo.map((item, index) => ({
              id: `missing-${index}`,
              label: "Missing information",
              detail: item,
              severity: "warning" as const,
            })),
          ],
        }
      : null,
  );

  async function handleRegenerate() {
    if (!record) return;

    try {
      const next = await generateMutation.mutateAsync({
        patientId: record.patientId,
        windowHours: selectedWindow,
      });
      navigate(`/handoffs/${next.id}`);
      pushToast({
        title: "SBAR regenerated",
        description: `Refreshed ${next.patientName}'s handoff using the ${selectedWindow}-hour window.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Regeneration failed",
        description: error instanceof Error ? error.message : "Unknown generation error",
        tone: "critical",
      });
    }
  }

  if (handoffQuery.isLoading) {
    return (
      <HandoffShell
        title="Loading handoff"
        subtitle="Fetching the case from the local API."
      >
        <section className="surface handoff-surface">
          <p className="panel-copy">Loading the structured handoff record...</p>
        </section>
      </HandoffShell>
    );
  }

  if (handoffQuery.error || !record) {
    return (
      <HandoffShell
        title="Handoff unavailable"
        subtitle="The requested handoff could not be loaded."
      >
        <section className="surface handoff-surface">
          <p className="panel-copy">
            {handoffQuery.error?.message ?? "No handoff record was returned by the API."}
          </p>
        </section>
      </HandoffShell>
    );
  }

  const liveDocuments = documentsQuery.data?.documents ?? record.documents;
  const displayRecord =
    committedHandoffQuery.data?.record ?? getEffectiveReviewOutput(reviewRun.run, record);
  const displayCitationMap = Object.fromEntries(
    (displayRecord.summary.citations ?? []).map((citation) => [citation.id, citation]),
  );

  return (
    <HandoffShell
      title={`${displayRecord.patientName} | ${displayRecord.diagnosis}`}
      subtitle={`${displayRecord.unit} | ${displayRecord.primaryService} | ${displayRecord.maskedMrn}`}
      recordId={displayRecord.id}
      topRight={
        <>
          <div className="window-toggle">
            {windowChoices.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`button-toggle ${selectedWindow === choice ? "button-toggle--active" : ""}`}
                onClick={() => setSelectedWindow(choice)}
              >
                {choice}h
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void handleRegenerate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? "Refreshing..." : "Regenerate SBAR"}
          </button>
        </>
      }
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard
          label="Status"
          value={displayRecord.summary.status.replace("_", " ")}
          detail={displayRecord.headline}
        />
        <MetricCard
          label="Documents"
          value={`${liveDocuments.length}`}
          detail={`${record.windowHours}-hour normalized source window`}
        />
        <MetricCard
          label="Facts"
          value={`${record.facts.length}`}
          detail="Deterministic plus heuristic narrative facts"
        />
        <MetricCard
          label="Disagreements"
          value={`${displayRecord.summary.disagreements.length}`}
          detail={`${displayRecord.summary.missingInfo.length} missing-information markers`}
        />
      </section>

      {committedHandoffQuery.data ? (
        <section className="surface handoff-surface">
          <div className="callout callout--success">
            <strong>Published handoff</strong>
            <p>
              This case is currently rendering the committed SBAR published on{" "}
              {new Date(committedHandoffQuery.data.committedAt).toLocaleString()} by{" "}
              {committedHandoffQuery.data.actorId}.
            </p>
          </div>
        </section>
      ) : null}

      <section className="surface handoff-surface">
        <div className="panel-heading">
          <div>
            <p className="eyebrow-label">Case headline</p>
            <h3>{displayRecord.headline}</h3>
          </div>
        </div>
        <div className="detail-list">
          <div className="detail-list__row">
            <strong>Next action</strong>
            <span>{displayRecord.nextAction}</span>
          </div>
          <div className="detail-list__row">
            <strong>Generated at</strong>
            <span>{new Date(displayRecord.summary.generatedAt).toLocaleString()}</span>
          </div>
          <div className="detail-list__row">
            <strong>Patient context</strong>
            <span>{displayRecord.age} years old | encounter {displayRecord.encounterId}</span>
          </div>
        </div>
      </section>

      <HumanReviewPanel
        run={reviewRun.run}
        title="Approve, edit, or finalize the SBAR handoff"
        onRerun={async (editedInput) => {
          const nextWindow =
            typeof editedInput === "object" &&
            editedInput &&
            "windowHours" in editedInput &&
            typeof (editedInput as { windowHours?: unknown }).windowHours === "number"
              ? ((editedInput as { windowHours: WindowHours }).windowHours)
              : selectedWindow;
          setSelectedWindow(nextWindow);
          await handleRegenerate();
        }}
      />

      <div className="handoff-grid">
        <div className="handoff-grid__main">
          <div className="sbar-grid">
            <SbarSection
              eyebrow="S"
              title="Situation"
              bullets={displayRecord.summary.situation}
              citationMap={displayCitationMap}
              emptyMessage="No immediate situation bullets were generated."
            />
            <SbarSection
              eyebrow="B"
              title="Background"
              bullets={displayRecord.summary.background}
              citationMap={displayCitationMap}
              emptyMessage="No background bullets were generated."
            />
            <SbarSection
              eyebrow="A"
              title="Assessment"
              bullets={displayRecord.summary.assessment}
              citationMap={displayCitationMap}
              emptyMessage="No assessment bullets were generated."
            />
            <SbarSection
              eyebrow="R"
              title="Recommendation"
              bullets={displayRecord.summary.recommendations}
              citationMap={displayCitationMap}
              emptyMessage="No recommendation bullets were generated."
            />
          </div>

          <DisagreementPanel disagreements={displayRecord.summary.disagreements} />
          <ProvenancePanel citations={displayRecord.summary.citations} />
        </div>

        <div className="handoff-grid__side">
          <section className="surface handoff-surface">
            <div className="panel-heading">
              <div>
                <p className="eyebrow-label">Missing information</p>
                <h3>Open data gaps</h3>
              </div>
            </div>
            {displayRecord.summary.missingInfo.length === 0 ? (
              <p className="panel-copy">No missing-information markers were raised in this window.</p>
            ) : (
              <div className="missing-info-list">
                {displayRecord.summary.missingInfo.map((item) => (
                  <article key={item} className="callout callout--warning">
                    <strong>Needs follow-up</strong>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <DocumentFeed documents={liveDocuments} />
        </div>
      </div>
    </HandoffShell>
  );
}
