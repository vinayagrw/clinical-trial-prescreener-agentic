import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ResearchShell } from "../components/ResearchShell";
import { StatusChip } from "../components/StatusChip";
import {
  useCreateInstitutionalProjectMutation,
  useGenerateResearchDigestsMutation,
  useResearchIngestMutation,
  useResearchProfileQuery,
  useResearchRecomputeMutation,
  useUpdateResearchProfileMutation,
} from "../data/queries/research";
import type { ResearchSource } from "../types";

function parseList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ResearchProfilePage() {
  const navigate = useNavigate();
  const { profileId } = useParams();
  const profileQuery = useResearchProfileQuery(profileId);
  const updateMutation = useUpdateResearchProfileMutation(profileId);
  const projectMutation = useCreateInstitutionalProjectMutation(profileId);
  const ingestMutation = useResearchIngestMutation();
  const recomputeMutation = useResearchRecomputeMutation();
  const generateMutation = useGenerateResearchDigestsMutation(profileId);
  const [statusMessage, setStatusMessage] = useState("");
  const [profileForm, setProfileForm] = useState({
    ownerType: "faculty",
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
  const [projectForm, setProjectForm] = useState({
    name: "",
    summary: "",
    methods: "",
    modalities: "",
    seedPapers: "",
    aliases: "",
  });

  useEffect(() => {
    const profile = profileQuery.data?.profile;
    if (!profile) {
      return;
    }

    setProfileForm({
      ownerType: profile.ownerType,
      ownerName: profile.ownerName,
      labName: profile.labName,
      keywords: profile.keywords.join(", "),
      excludedTerms: profile.excludedTerms.join(", "),
      methodInterests: profile.methodInterests.join(", "),
      domainInterests: profile.domainInterests.join(", "),
      digestDayOfWeek: profile.digestDayOfWeek,
      digestTimeLocal: profile.digestTimeLocal,
      timezone: profile.timezone,
      sources: profile.sources,
    });
  }, [profileQuery.data?.profile]);

  const detail = profileQuery.data;

  return (
    <ResearchShell
      title={detail ? detail.profile.ownerName : "Research Profile"}
      subtitle={
        detail
          ? `${detail.profile.labName} · ${detail.projects.length} active institutional projects`
          : "Configure interests, projects, and digest operations for this faculty or lab profile."
      }
      profileId={profileId}
    >
      {profileQuery.isLoading ? <p className="research-muted">Loading research profile...</p> : null}
      {profileQuery.error ? (
        <p className="research-error">
          {profileQuery.error instanceof Error ? profileQuery.error.message : "Failed to load profile."}
        </p>
      ) : null}

      {detail ? (
        <>
          <section className="research-grid research-grid--profile">
            <article className="research-card">
              <div className="research-card__header">
                <div>
                  <p className="eyebrow-label">Profile settings</p>
                  <h3>Research interest configuration</h3>
                </div>
                <div className="stacked-chips">
                  <StatusChip label={`${detail.recentDigests.length} archived digests`} tone="paper" compact />
                  <StatusChip label={`${detail.projects.length} projects`} tone="paper" compact />
                </div>
              </div>

              <form
                className="research-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await updateMutation.mutateAsync({
                    ownerType: profileForm.ownerType as typeof detail.profile.ownerType,
                    ownerName: profileForm.ownerName,
                    labName: profileForm.labName,
                    keywords: parseList(profileForm.keywords),
                    excludedTerms: parseList(profileForm.excludedTerms),
                    methodInterests: parseList(profileForm.methodInterests),
                    domainInterests: parseList(profileForm.domainInterests),
                    digestDayOfWeek: profileForm.digestDayOfWeek,
                    digestTimeLocal: profileForm.digestTimeLocal,
                    timezone: profileForm.timezone,
                    sources: profileForm.sources,
                  });
                  setStatusMessage("Profile settings saved.");
                }}
              >
                <label className="research-field">
                  <span>Owner type</span>
                  <select
                    value={profileForm.ownerType}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, ownerType: event.target.value }))
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
                    value={profileForm.ownerName}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, ownerName: event.target.value }))
                    }
                  />
                </label>

                <label className="research-field">
                  <span>Lab or department</span>
                  <input
                    value={profileForm.labName}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, labName: event.target.value }))
                    }
                  />
                </label>

                <label className="research-field">
                  <span>Method interests</span>
                  <textarea
                    rows={3}
                    value={profileForm.methodInterests}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, methodInterests: event.target.value }))
                    }
                  />
                </label>

                <label className="research-field">
                  <span>Domain interests</span>
                  <textarea
                    rows={3}
                    value={profileForm.domainInterests}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, domainInterests: event.target.value }))
                    }
                  />
                </label>

                <label className="research-field">
                  <span>Keywords</span>
                  <textarea
                    rows={3}
                    value={profileForm.keywords}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, keywords: event.target.value }))
                    }
                  />
                </label>

                <label className="research-field">
                  <span>Excluded terms</span>
                  <input
                    value={profileForm.excludedTerms}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, excludedTerms: event.target.value }))
                    }
                  />
                </label>

                <div className="research-form__row">
                  <label className="research-field">
                    <span>Digest day</span>
                    <select
                      value={profileForm.digestDayOfWeek}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, digestDayOfWeek: event.target.value }))
                      }
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
                      value={profileForm.digestTimeLocal}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, digestTimeLocal: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <label className="research-field">
                  <span>Timezone</span>
                  <input
                    value={profileForm.timezone}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, timezone: event.target.value }))
                    }
                  />
                </label>

                <fieldset className="research-fieldset">
                  <legend>Sources</legend>
                  <div className="research-checkboxes">
                    {(["pubmed", "biorxiv", "medrxiv"] as ResearchSource[]).map((source) => (
                      <label key={source} className="research-checkbox">
                        <input
                          type="checkbox"
                          checked={profileForm.sources.includes(source)}
                          onChange={(event) =>
                            setProfileForm((current) => ({
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

                <button className="research-button" type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save profile"}
                </button>
              </form>
            </article>

            <article className="research-card">
              <div className="research-card__header">
                <div>
                  <p className="eyebrow-label">Operations</p>
                  <h3>Manual controls</h3>
                </div>
              </div>
              <p className="research-muted">
                Use these controls to ingest new papers, recompute deterministic relevance scores, and generate the current weekly digest on demand.
              </p>
              <div className="research-actions research-actions--stacked">
                <button
                  className="research-button"
                  type="button"
                  disabled={ingestMutation.isPending}
                  onClick={async () => {
                    const result = await ingestMutation.mutateAsync(profileId);
                    setStatusMessage(`Ingested ${result.totalPublicationCount} papers for this profile.`);
                  }}
                >
                  Run ingest for this profile
                </button>
                <button
                  className="research-button research-button--secondary"
                  type="button"
                  disabled={recomputeMutation.isPending}
                  onClick={async () => {
                    const result = await recomputeMutation.mutateAsync(profileId);
                    setStatusMessage(
                      `Recomputed ${result.assessmentCount} relevance scores with ${result.crossDomainMatchCount} cross-domain matches.`,
                    );
                  }}
                >
                  Recompute relevance
                </button>
                <button
                  className="research-button research-button--secondary"
                  type="button"
                  disabled={generateMutation.isPending}
                  onClick={async () => {
                    const result = await generateMutation.mutateAsync({ profileId });
                    const digest = result.digests[0];
                    setStatusMessage(`Generated ${result.generatedCount} digest(s) for this profile.`);
                    if (digest) {
                      navigate(`/research-digests/digests/${digest.id}`);
                    }
                  }}
                >
                  Generate this week&apos;s digest
                </button>
              </div>
              {statusMessage ? <p className="research-status">{statusMessage}</p> : null}
            </article>
          </section>

          <section className="research-grid research-grid--profile">
            <article className="research-card">
              <div className="research-card__header">
                <div>
                  <p className="eyebrow-label">Institutional projects</p>
                  <h3>Project links used for digest flags</h3>
                </div>
              </div>

              <form
                className="research-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await projectMutation.mutateAsync({
                    name: projectForm.name,
                    summary: projectForm.summary,
                    methods: parseList(projectForm.methods),
                    modalities: parseList(projectForm.modalities),
                    seedPapers: parseList(projectForm.seedPapers),
                    aliases: parseList(projectForm.aliases),
                  });
                  setProjectForm({
                    name: "",
                    summary: "",
                    methods: "",
                    modalities: "",
                    seedPapers: "",
                    aliases: "",
                  });
                  setStatusMessage("Project added to the profile.");
                }}
              >
                <label className="research-field">
                  <span>Project name</span>
                  <input
                    value={projectForm.name}
                    onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Compression-aware thoracic radiomics"
                  />
                </label>
                <label className="research-field">
                  <span>Summary</span>
                  <textarea
                    rows={4}
                    value={projectForm.summary}
                    onChange={(event) => setProjectForm((current) => ({ ...current, summary: event.target.value }))}
                    placeholder="Briefly describe the ongoing institutional effort this digest should watch."
                  />
                </label>
                <label className="research-field">
                  <span>Methods</span>
                  <input
                    value={projectForm.methods}
                    onChange={(event) => setProjectForm((current) => ({ ...current, methods: event.target.value }))}
                    placeholder="compression, radiomics, weak supervision"
                  />
                </label>
                <label className="research-field">
                  <span>Modalities</span>
                  <input
                    value={projectForm.modalities}
                    onChange={(event) => setProjectForm((current) => ({ ...current, modalities: event.target.value }))}
                    placeholder="CT, pathology, genomics"
                  />
                </label>
                <label className="research-field">
                  <span>Seed papers</span>
                  <input
                    value={projectForm.seedPapers}
                    onChange={(event) => setProjectForm((current) => ({ ...current, seedPapers: event.target.value }))}
                    placeholder="doi:10.1101/..., PMID12345678"
                  />
                </label>
                <label className="research-field">
                  <span>Aliases</span>
                  <input
                    value={projectForm.aliases}
                    onChange={(event) => setProjectForm((current) => ({ ...current, aliases: event.target.value }))}
                    placeholder="thoracic compression, imaging compression"
                  />
                </label>

                <button className="research-button" type="submit" disabled={projectMutation.isPending}>
                  {projectMutation.isPending ? "Adding..." : "Add project"}
                </button>
              </form>

              <div className="research-card-list">
                {detail.projects.map((project) => (
                  <article key={project.id} className="research-card research-card--compact">
                    <div className="research-card__header">
                      <div>
                        <p className="eyebrow-label">Project</p>
                        <h3>{project.name}</h3>
                      </div>
                    </div>
                    <p className="research-muted">{project.summary}</p>
                    <p className="research-muted">
                      Methods: {project.methods.join(", ") || "Not specified"}
                    </p>
                    <p className="research-muted">
                      Modalities: {project.modalities.join(", ") || "Not specified"}
                    </p>
                  </article>
                ))}
              </div>
            </article>

            <article className="research-card">
              <div className="research-card__header">
                <div>
                  <p className="eyebrow-label">Digest archive</p>
                  <h3>Recent weekly digests</h3>
                </div>
              </div>
              {detail.recentDigests.length === 0 ? (
                <p className="research-muted">
                  No digests have been generated for this profile yet. Run ingest, recompute relevance, then generate a digest.
                </p>
              ) : (
                <div className="research-card-list">
                  {detail.recentDigests.map((digest) => (
                    <article key={digest.id} className="research-card research-card--compact">
                      <div className="research-card__header">
                        <div>
                          <p className="eyebrow-label">Week of {digest.weekStart}</p>
                          <h3>{new Date(digest.generatedAt).toLocaleString()}</h3>
                        </div>
                        <StatusChip label={digest.status} tone="teal" compact />
                      </div>
                      <p className="research-muted">{digest.summary}</p>
                      <Link className="research-button research-button--secondary" to={`/research-digests/digests/${digest.id}`}>
                        Open digest
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}
    </ResearchShell>
  );
}
