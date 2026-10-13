import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResearchShell } from "../components/ResearchShell";
import { StatusChip } from "../components/StatusChip";
import {
  useCreateResearchProfileMutation,
  useGenerateResearchDigestsMutation,
  useResearchIngestMutation,
  useResearchProfilesQuery,
  useResearchRecomputeMutation,
} from "../data/queries/research";
import type { CreateResearchProfileInput, ResearchSource } from "../types";

function parseList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ResearchDigestArchivePage() {
  const navigate = useNavigate();
  const profilesQuery = useResearchProfilesQuery();
  const createProfile = useCreateResearchProfileMutation();
  const ingestMutation = useResearchIngestMutation();
  const recomputeMutation = useResearchRecomputeMutation();
  const generateMutation = useGenerateResearchDigestsMutation();
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [form, setForm] = useState({
    ownerType: "faculty" as CreateResearchProfileInput["ownerType"],
    ownerName: "",
    labName: "",
    keywords: "",
    excludedTerms: "",
    methodInterests: "",
    domainInterests: "",
    digestDayOfWeek: "Monday",
    digestTimeLocal: "06:00",
    timezone: "America/Chicago",
    sources: ["pubmed", "biorxiv", "medrxiv"] as ResearchSource[],
  });

  const sortedProfiles = useMemo(
    () => profilesQuery.data?.items ?? [],
    [profilesQuery.data?.items],
  );

  const busy =
    createProfile.isPending ||
    ingestMutation.isPending ||
    recomputeMutation.isPending ||
    generateMutation.isPending;

  return (
    <ResearchShell
      title="Weekly Digest Archive"
      subtitle="Create faculty or lab profiles, run live ingestion, and review generated research digests."
    >
      <section className="research-grid research-grid--archive">
        <article className="research-card research-card--hero">
          <div className="research-card__header">
            <div>
              <p className="eyebrow-label">Workspace view</p>
              <h3>Operational reading guide</h3>
            </div>
            <div className="stacked-chips">
              <StatusChip label="Live data only" tone="teal" compact />
              <StatusChip label="No seed digests" tone="paper" compact />
              <StatusChip label="Postgres required" tone="amber" compact />
            </div>
          </div>
          <p className="research-muted">
            This workspace monitors new papers from PubMed, bioRxiv, and medRxiv, then scores them against configurable faculty or lab profiles using method-aware relevance instead of keyword matching alone.
          </p>
          <div className="research-actions">
            <button
              className="research-button"
              type="button"
              disabled={busy}
              onClick={async () => {
                const result = await ingestMutation.mutateAsync(undefined);
                setStatusMessage(
                  `Ingested ${result.totalPublicationCount} publications across ${result.sources.length} sources.`,
                );
              }}
            >
              Run global ingest
            </button>
            <button
              className="research-button research-button--secondary"
              type="button"
              disabled={busy}
              onClick={async () => {
                const result = await recomputeMutation.mutateAsync(undefined);
                setStatusMessage(
                  `Recomputed ${result.assessmentCount} relevance assessments with ${result.crossDomainMatchCount} cross-domain method matches.`,
                );
              }}
            >
              Recompute relevance
            </button>
            <button
              className="research-button research-button--secondary"
              type="button"
              disabled={busy}
              onClick={async () => {
                const result = await generateMutation.mutateAsync({});
                setStatusMessage(`Generated ${result.generatedCount} digest archives.`);
              }}
            >
              Generate current digests
            </button>
          </div>
          {statusMessage ? <p className="research-status">{statusMessage}</p> : null}
        </article>

        <article className="research-card">
          <div className="research-card__header">
            <div>
              <p className="eyebrow-label">Create profile</p>
              <h3>Faculty or lab configuration</h3>
            </div>
          </div>

          <form
            className="research-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const created = await createProfile.mutateAsync({
                ownerType: form.ownerType,
                ownerName: form.ownerName,
                labName: form.labName,
                keywords: parseList(form.keywords),
                excludedTerms: parseList(form.excludedTerms),
                methodInterests: parseList(form.methodInterests),
                domainInterests: parseList(form.domainInterests),
                digestDayOfWeek: form.digestDayOfWeek,
                digestTimeLocal: form.digestTimeLocal,
                timezone: form.timezone,
                sources: form.sources,
              });
              navigate(`/research-digests/profiles/${created.id}`);
            }}
          >
            <label className="research-field">
              <span>Owner type</span>
              <select
                value={form.ownerType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ownerType: event.target.value as CreateResearchProfileInput["ownerType"],
                  }))
                }
              >
                <option value="faculty">Faculty</option>
                <option value="lab">Lab</option>
                <option value="department">Department</option>
              </select>
            </label>

            <label className="research-field">
              <span>Owner name</span>
              <input
                value={form.ownerName}
                onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                placeholder="Dr. Priya Raman"
              />
            </label>

            <label className="research-field">
              <span>Lab or department</span>
              <input
                value={form.labName}
                onChange={(event) => setForm((current) => ({ ...current, labName: event.target.value }))}
                placeholder="Computational Imaging Lab"
              />
            </label>

            <label className="research-field">
              <span>Method interests</span>
              <textarea
                rows={3}
                value={form.methodInterests}
                onChange={(event) => setForm((current) => ({ ...current, methodInterests: event.target.value }))}
                placeholder="compression models, radiomics, representation learning, multimodal fusion"
              />
            </label>

            <label className="research-field">
              <span>Domain interests</span>
              <textarea
                rows={3}
                value={form.domainInterests}
                onChange={(event) => setForm((current) => ({ ...current, domainInterests: event.target.value }))}
                placeholder="thoracic imaging, pathology, genomics"
              />
            </label>

            <label className="research-field">
              <span>Keywords</span>
              <textarea
                rows={3}
                value={form.keywords}
                onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
                placeholder="small cell lung cancer, weak supervision, lesion segmentation"
              />
            </label>

            <label className="research-field">
              <span>Excluded terms</span>
              <input
                value={form.excludedTerms}
                onChange={(event) => setForm((current) => ({ ...current, excludedTerms: event.target.value }))}
                placeholder="veterinary, plant biology"
              />
            </label>

            <div className="research-form__row">
              <label className="research-field">
                <span>Digest day</span>
                <select
                  value={form.digestDayOfWeek}
                  onChange={(event) => setForm((current) => ({ ...current, digestDayOfWeek: event.target.value }))}
                >
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>

              <label className="research-field">
                <span>Digest time</span>
                <input
                  type="time"
                  value={form.digestTimeLocal}
                  onChange={(event) => setForm((current) => ({ ...current, digestTimeLocal: event.target.value }))}
                />
              </label>
            </div>

            <label className="research-field">
              <span>Timezone</span>
              <input
                value={form.timezone}
                onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
              />
            </label>

            <fieldset className="research-fieldset">
              <legend>Sources</legend>
              <div className="research-checkboxes">
                {(["pubmed", "biorxiv", "medrxiv"] as ResearchSource[]).map((source) => (
                  <label key={source} className="research-checkbox">
                    <input
                      type="checkbox"
                      checked={form.sources.includes(source)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sources: event.target.checked
                            ? [...current.sources, source]
                            : current.sources.filter((item) => item !== source),
                        }))
                      }
                    />
                    <span>{source}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="research-button" type="submit" disabled={createProfile.isPending}>
              {createProfile.isPending ? "Creating..." : "Create profile"}
            </button>
          </form>
        </article>
      </section>

      <section className="research-section">
        <div className="research-section__header">
          <div>
            <p className="eyebrow-label">Configured profiles</p>
            <h3>Archive index</h3>
          </div>
          <StatusChip
            label={`${sortedProfiles.length} profiles`}
            tone={sortedProfiles.length > 0 ? "teal" : "paper"}
            compact
          />
        </div>

        {profilesQuery.isLoading ? <p className="research-muted">Loading research profiles...</p> : null}
        {profilesQuery.error ? (
          <p className="research-error">
            {profilesQuery.error instanceof Error ? profilesQuery.error.message : "Failed to load research profiles."}
          </p>
        ) : null}

        <div className="research-card-list">
          {sortedProfiles.map((item) => (
            <article key={item.profile.id} className="research-card research-card--compact">
              <div className="research-card__header">
                <div>
                  <p className="eyebrow-label">{item.profile.ownerType}</p>
                  <h3>{item.profile.ownerName}</h3>
                  <p className="research-muted">{item.profile.labName}</p>
                </div>
                <div className="stacked-chips">
                  <StatusChip label={`${item.projectCount} projects`} tone="paper" compact />
                  <StatusChip label={`${item.digestCount} digests`} tone="paper" compact />
                </div>
              </div>

              <p className="research-muted">
                Methods: {item.profile.methodInterests.slice(0, 4).join(", ") || "Not configured yet"}
              </p>
              <p className="research-muted">
                Domains: {item.profile.domainInterests.slice(0, 4).join(", ") || "Not configured yet"}
              </p>

              <div className="research-actions">
                <Link className="research-button" to={`/research-digests/profiles/${item.profile.id}`}>
                  Open profile
                </Link>
                {item.latestDigest ? (
                  <Link
                    className="research-button research-button--secondary"
                    to={`/research-digests/digests/${item.latestDigest.id}`}
                  >
                    Latest digest
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </ResearchShell>
  );
}
