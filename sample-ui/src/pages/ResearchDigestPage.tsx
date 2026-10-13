import { Link, useParams } from "react-router-dom";
import { HumanReviewPanel } from "../components/HumanReviewPanel";
import { ResearchShell } from "../components/ResearchShell";
import { StatusChip } from "../components/StatusChip";
import {
  useArchiveResearchDigestMutation,
  useGenerateResearchDigestsMutation,
  useResearchDigestQuery,
  useResearchDigestPublicationQuery,
} from "../data/queries/research";
import { useUiStore } from "../stores/ui";
import { getEffectiveReviewOutput, useAiReviewRunSync } from "../lib/reviews";

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ResearchDigestPage() {
  const { digestId } = useParams();
  const digestQuery = useResearchDigestQuery(digestId);
  const publicationQuery = useResearchDigestPublicationQuery(digestId);
  const regenerateDigestMutation = useGenerateResearchDigestsMutation();
  const archiveDigestMutation = useArchiveResearchDigestMutation(digestId);
  const pushToast = useUiStore((state) => state.pushToast);
  const detail = digestQuery.data;
  const reviewRun = useAiReviewRunSync(
    detail
      ? {
          sourceKey: `research-digest:${detail.id}`,
          featureKey: "research_weekly_digest",
          featureLabel: "Research digest summary",
          stageKey: "digest_generation",
          workspace: "research",
          entityType: "research_digest",
          entityId: detail.id,
          entityLabel: `${detail.profile.ownerName} / ${detail.weekStart}`,
          deepLink: `/research-digests/digests/${detail.id}`,
          summary: `${detail.entries.length} ranked papers across ${detail.sections.length} digest sections.`,
          promptSnapshot: {
            profileId: detail.profile.id,
            weekStart: detail.weekStart,
          },
          inputSnapshot: {
            profileId: detail.profile.id,
            digestId: detail.id,
          },
          outputSnapshot: detail,
          provider: "research-digest-pipeline",
          model: "deterministic+optional-gemini",
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
          commitTargetType: "research_digest",
          commitTargetId: detail.id,
          editableFields: ["outputSnapshot", "citations"],
          requiredFields: ["rationale"],
          citations: detail.entries.flatMap((entry) =>
            entry.paperSummary.citations.map((citation) => ({
              id: `${entry.id}-${citation.chunkId}`,
              label: `${entry.publication.title} · ${citation.section}`,
              detail: `${entry.publication.venue} · ${new Date(entry.publication.publishedAt).toLocaleDateString()}`,
              quote: citation.excerpt,
              tone: entry.peerReviewStatus === "peer_reviewed" ? "supporting" : "warning",
            })),
          ),
          safetyFlags: [
            ...detail.entries
              .filter((entry) => entry.peerReviewStatus === "preprint")
              .map((entry) => ({
                id: `preprint-${entry.id}`,
                label: "Preprint requires human publication judgment",
                detail: entry.publication.title,
                severity: "warning" as const,
              })),
            ...detail.entries
              .filter((entry) => entry.assessment.crossDomainMethodMatch)
              .map((entry) => ({
                id: `cross-domain-${entry.id}`,
                label: "Cross-domain method match",
                detail: `Reviewer should confirm that ${entry.publication.title} is a meaningful methodological analogue.`,
                severity: "info" as const,
              })),
          ],
        }
      : null,
  );
  const displayDetail =
    publicationQuery.data?.detail ?? getEffectiveReviewOutput(reviewRun.run, detail);
  const projectMap = new Map((displayDetail?.projects ?? []).map((project) => [project.id, project.name]));

  async function handleArchive() {
    const checkpointId = reviewRun.run?.reviewCheckpoints[0]?.id;
    if (!reviewRun.run || !checkpointId) {
      return;
    }

    try {
      await archiveDigestMutation.mutateAsync({
        runId: reviewRun.run.id,
        checkpointId,
        rationale: "Archived from the research digest page after reviewer confirmation.",
      });
      pushToast({
        title: "Digest archived",
        description: "The committed digest version is now marked archived.",
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Archive failed",
        description: error instanceof Error ? error.message : "Unable to archive the digest.",
        tone: "critical",
      });
    }
  }

  return (
    <ResearchShell
      title={detail ? `${detail.profile.ownerName} digest` : "Weekly digest"}
      subtitle={
        displayDetail
          ? `Week of ${displayDetail.weekStart} · ${displayDetail.entries.length} included papers`
          : "Review relevance-ranked papers, source quality signals, and citation-backed summaries."
      }
      profileId={displayDetail?.profile.id}
      digestId={digestId}
    >
      {digestQuery.isLoading ? <p className="research-muted">Loading digest...</p> : null}
      {digestQuery.error ? (
        <p className="research-error">
          {digestQuery.error instanceof Error ? digestQuery.error.message : "Failed to load digest."}
        </p>
      ) : null}

      {displayDetail ? (
        <>
          <section className="research-grid research-grid--digest">
            <article className="research-card research-card--hero">
              <div className="research-card__header">
                <div>
                  <p className="eyebrow-label">Digest summary</p>
                  <h3>{displayDetail.profile.ownerName}</h3>
                  <p className="research-muted">{displayDetail.profile.labName}</p>
                </div>
                <div className="stacked-chips">
                  <StatusChip label={`Week ${displayDetail.weekStart}`} tone="paper" compact />
                  <StatusChip label={`${displayDetail.entries.length} papers`} tone="teal" compact />
                  {publicationQuery.data ? (
                    <StatusChip
                      label={
                        publicationQuery.data.publicationState === "archived"
                          ? "Archived digest"
                          : "Published digest"
                      }
                      tone={
                        publicationQuery.data.publicationState === "archived"
                          ? "paper"
                          : "moss"
                      }
                      compact
                    />
                  ) : null}
                </div>
              </div>
              <p className="research-muted">{displayDetail.summary}</p>
              {publicationQuery.data ? (
                <div className="callout callout--success" style={{ marginBottom: "var(--space-4)" }}>
                  <strong>
                    {publicationQuery.data.publicationState === "archived"
                      ? "Archived digest"
                      : "Published digest"}
                  </strong>
                  <p>
                    This page is currently rendering the committed digest version from{" "}
                    {new Date(publicationQuery.data.committedAt).toLocaleString()} by{" "}
                    {publicationQuery.data.actorId}.
                  </p>
                </div>
              ) : null}
              <div className="research-actions">
                <Link className="research-button" to={`/research-digests/profiles/${displayDetail.profile.id}`}>
                  Back to profile
                </Link>
                <Link className="research-button research-button--secondary" to="/research-digests">
                  Digest archive
                </Link>
                {publicationQuery.data?.publicationState !== "archived" ? (
                  <button
                    type="button"
                    className="research-button research-button--secondary"
                    onClick={() => void handleArchive()}
                    disabled={
                      archiveDigestMutation.isPending ||
                      !reviewRun.run?.reviewCheckpoints[0]?.id
                    }
                  >
                    {archiveDigestMutation.isPending ? "Archiving..." : "Archive digest"}
                  </button>
                ) : null}
              </div>
            </article>

            <article className="research-card">
              <div className="research-card__header">
                <div>
                  <p className="eyebrow-label">Configured research lens</p>
                  <h3>What the ranker is optimizing for</h3>
                </div>
              </div>
              <p className="research-muted">
                Methods: {displayDetail.profile.methodInterests.join(", ") || "No method interests configured"}
              </p>
              <p className="research-muted">
                Domains: {displayDetail.profile.domainInterests.join(", ") || "No domain interests configured"}
              </p>
              <p className="research-muted">
                Keywords: {displayDetail.profile.keywords.join(", ") || "No keywords configured"}
              </p>
            </article>
          </section>

          <HumanReviewPanel
            run={reviewRun.run}
            title="Review, edit, or publish this weekly digest"
            onRerun={async (editedInput) => {
              const nextProfileId =
                typeof editedInput === "object" &&
                editedInput &&
                "profileId" in editedInput &&
                typeof (editedInput as { profileId?: unknown }).profileId === "string"
                  ? (editedInput as { profileId: string }).profileId
                  : displayDetail.profile.id;
              const nextWeekStart =
                typeof editedInput === "object" &&
                editedInput &&
                "weekStart" in editedInput &&
                typeof (editedInput as { weekStart?: unknown }).weekStart === "string"
                  ? (editedInput as { weekStart: string }).weekStart
                  : displayDetail.weekStart;
              await regenerateDigestMutation.mutateAsync({
                profileId: nextProfileId,
                weekStart: nextWeekStart,
              });
              await digestQuery.refetch({ cancelRefetch: false });
            }}
          />

          {displayDetail.sections.map((section) => {
            const entries = displayDetail.entries.filter((entry) => section.entryIds.includes(entry.id));
            return (
              <section key={section.key} className="research-section">
                <div className="research-section__header">
                  <div>
                    <p className="eyebrow-label">Digest section</p>
                    <h3>{section.title}</h3>
                    <p className="research-muted">{section.description}</p>
                  </div>
                  <StatusChip label={`${entries.length} papers`} tone="paper" compact />
                </div>

                <div className="research-card-list">
                  {entries.map((entry) => (
                    <article key={entry.id} className="research-card research-card--digest-entry">
                      <div className="research-card__header">
                        <div>
                          <p className="eyebrow-label">
                            {entry.publication.venue} · {new Date(entry.publication.publishedAt).toLocaleDateString()}
                          </p>
                          <h3>{entry.publication.title}</h3>
                        </div>
                        <div className="stacked-chips">
                          <StatusChip label={`${Math.round(entry.finalScore * 100)} score`} tone="teal" compact />
                          <StatusChip
                            label={entry.peerReviewStatus === "peer_reviewed" ? "Peer reviewed" : "Preprint"}
                            tone={entry.peerReviewStatus === "peer_reviewed" ? "paper" : "amber"}
                            compact
                          />
                          <StatusChip
                            label={entry.contentCoverage === "full_text" ? "Full text" : "Abstract only"}
                            tone="paper"
                            compact
                          />
                        </div>
                      </div>

                      <p className="research-muted">
                        {entry.publication.authors.slice(0, 4).map((author) => author.displayName).join(", ") || "Authors unavailable"}
                      </p>

                      <div className="research-metrics">
                        <div className="research-metric">
                          <span>Method similarity</span>
                          <strong>{formatPercent(entry.assessment.methodSimilarity)}</strong>
                        </div>
                        <div className="research-metric">
                          <span>Project similarity</span>
                          <strong>{formatPercent(entry.assessment.projectSimilarity)}</strong>
                        </div>
                        <div className="research-metric">
                          <span>Topic similarity</span>
                          <strong>{formatPercent(entry.assessment.topicSimilarity)}</strong>
                        </div>
                        <div className="research-metric">
                          <span>Recency</span>
                          <strong>{formatPercent(entry.assessment.recencyScore)}</strong>
                        </div>
                      </div>

                        <div className="research-chip-row">
                          {entry.reasonCodes.map((code) => (
                          <StatusChip key={code} label={code.replace(/_/g, " ")} tone="paper" compact />
                          ))}
                        {entry.assessment.crossDomainMethodMatch ? (
                          <StatusChip label="Cross-domain method match" tone="teal" compact />
                        ) : null}
                      </div>

                      {entry.matchedProjects.length > 0 ? (
                        <p className="research-muted">
                          Matched projects:{" "}
                          {entry.matchedProjects.map((projectId) => projectMap.get(projectId) ?? projectId).join(", ")}
                        </p>
                      ) : null}

                      <div className="research-summary-grid">
                        <div>
                          <h4>Overview</h4>
                          <p>{entry.paperSummary.overview}</p>
                        </div>
                        <div>
                          <h4>Methods</h4>
                          <p>{entry.paperSummary.methods}</p>
                        </div>
                        <div>
                          <h4>Findings</h4>
                          <p>{entry.paperSummary.findings}</p>
                        </div>
                        <div>
                          <h4>Limitations</h4>
                          <p>{entry.paperSummary.limitations}</p>
                        </div>
                        <div>
                          <h4>Why relevant</h4>
                          <p>{entry.paperSummary.whyRelevant}</p>
                        </div>
                        <div>
                          <h4>Source quality note</h4>
                          <p>{entry.paperSummary.sourceQualityNote}</p>
                        </div>
                      </div>

                      <div className="research-citation-block">
                        <h4>Supporting source excerpts</h4>
                        <div className="research-card-list">
                          {entry.paperSummary.citations.map((citation) => (
                            <article key={citation.chunkId} className="research-citation-card">
                              <p className="eyebrow-label">{citation.section}</p>
                              <p>{citation.excerpt}</p>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="research-actions">
                        {entry.publication.url ? (
                          <a className="research-button research-button--secondary" href={entry.publication.url} target="_blank" rel="noreferrer">
                            Open source paper
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : null}
    </ResearchShell>
  );
}
