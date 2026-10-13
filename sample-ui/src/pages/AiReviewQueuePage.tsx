import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { HumanReviewPanel } from "../components/HumanReviewPanel";
import { StatusChip } from "../components/StatusChip";
import { useAiRunsQuery } from "../data/queries/aiReviews";

export function AiReviewQueuePage() {
  const runsQuery = useAiRunsQuery();
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [reviewerFilter, setReviewerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [commitStatusFilter, setCommitStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");

  const filteredRuns = useMemo(() => {
    const items = runsQuery.data?.items ?? [];
    return items.filter((run) => {
      const matchesWorkspace =
        workspaceFilter === "all" || run.workspace === workspaceFilter;
      const matchesFeature = featureFilter === "all" || run.featureKey === featureFilter;
      const reviewerId = run.latestDecision?.actorId ?? "unassigned";
      const matchesReviewer = reviewerFilter === "all" || reviewerId === reviewerFilter;
      const matchesStatus = statusFilter === "all" || run.status === statusFilter;
      const matchesCommitStatus =
        commitStatusFilter === "all" || run.commitStatus === commitStatusFilter;
      const haystack = [
        run.featureLabel,
        run.entityLabel,
        run.workspace,
        run.summary,
        reviewerId,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        search.trim().length === 0 || haystack.includes(search.trim().toLowerCase());
      return (
        matchesWorkspace &&
        matchesFeature &&
        matchesReviewer &&
        matchesStatus &&
        matchesCommitStatus &&
        matchesSearch
      );
    });
  }, [
    commitStatusFilter,
    featureFilter,
    reviewerFilter,
    runsQuery.data?.items,
    search,
    statusFilter,
    workspaceFilter,
  ]);

  useEffect(() => {
    if (!filteredRuns.length) {
      setSelectedRunId("");
      return;
    }

    if (!selectedRunId || !filteredRuns.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(filteredRuns[0].id);
    }
  }, [filteredRuns, selectedRunId]);

  const selectedRun = filteredRuns.find((run) => run.id === selectedRunId) ?? null;
  const workspaces = useMemo(
    () =>
      Array.from(
        new Set((runsQuery.data?.items ?? []).map((run) => run.workspace)),
      ).sort(),
    [runsQuery.data?.items],
  );
  const features = useMemo(
    () =>
      Array.from(
        new Set((runsQuery.data?.items ?? []).map((run) => run.featureKey)),
      ).sort(),
    [runsQuery.data?.items],
  );
  const reviewers = useMemo(
    () =>
      Array.from(
        new Set(
          (runsQuery.data?.items ?? [])
            .map((run) => run.latestDecision?.actorId)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [runsQuery.data?.items],
  );

  return (
    <AppShell
      title="Pending AI Reviews"
      subtitle="One shared human-review queue for AI drafts across trial screening, handoff summaries, research digests, and grounded agent answers."
      compactAlerts
    >
      <section className="surface human-review-queue">
        <div className="human-review-queue__header">
          <div>
            <p className="eyebrow-label">Review queue</p>
            <h3>All AI outputs waiting for a human decision</h3>
          </div>
          <div className="stacked-chips">
            <StatusChip label={`${filteredRuns.length} visible`} tone="teal" compact />
            <StatusChip
              label={`${(runsQuery.data?.items ?? []).filter((run) => run.status === "needs_review" || run.status === "draft").length} pending`}
              tone="amber"
              compact
            />
          </div>
        </div>

        <div className="human-review-queue__filters">
          <input
            className="topbar-search"
            placeholder="Filter by feature, entity, or summary"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)}>
            <option value="all">All workspaces</option>
            {workspaces.map((workspace) => (
              <option key={workspace} value={workspace}>
                {workspace}
              </option>
            ))}
          </select>
          <select value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value)}>
            <option value="all">All features</option>
            {features.map((feature) => (
              <option key={feature} value={feature}>
                {feature}
              </option>
            ))}
          </select>
          <select value={reviewerFilter} onChange={(event) => setReviewerFilter(event.target.value)}>
            <option value="all">All reviewers</option>
            {reviewers.map((reviewer) => (
              <option key={reviewer} value={reviewer}>
                {reviewer}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {["draft", "needs_review", "approved", "overridden", "rejected", "finalized"].map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={commitStatusFilter}
            onChange={(event) => setCommitStatusFilter(event.target.value)}
          >
            <option value="all">All commit states</option>
            {["pending", "applied", "failed"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="human-review-queue__layout">
          <div className="human-review-queue__list">
            {runsQuery.isLoading ? <p className="panel-copy">Loading review runs...</p> : null}
            {runsQuery.error ? (
              <p className="panel-copy">
                {runsQuery.error instanceof Error ? runsQuery.error.message : "Unable to load the AI review queue."}
              </p>
            ) : null}

            {filteredRuns.map((run) => (
              <button
                key={run.id}
                type="button"
                className={`human-review-queue__item${selectedRunId === run.id ? " human-review-queue__item--active" : ""}`}
                onClick={() => setSelectedRunId(run.id)}
              >
                <div className="human-review-queue__item-head">
                  <strong>{run.entityLabel}</strong>
                  <div className="stacked-chips">
                    <StatusChip
                      label={run.status.replace(/_/g, " ")}
                      tone={
                        run.status === "approved"
                          ? "moss"
                          : run.status === "overridden"
                            ? "teal"
                            : run.status === "finalized"
                              ? "slate"
                              : run.status === "rejected"
                                ? "brick"
                                : "amber"
                      }
                      compact
                    />
                    <StatusChip
                      label={run.commitStatus ?? "pending"}
                      tone={
                        run.commitStatus === "applied"
                          ? "moss"
                          : run.commitStatus === "failed"
                            ? "brick"
                            : "paper"
                      }
                      compact
                    />
                  </div>
                </div>
                <p>{run.featureLabel}</p>
                <small>
                  {run.summary}
                  {run.latestDecision?.actorId
                    ? ` · reviewer ${run.latestDecision.actorId}`
                    : ""}
                </small>
              </button>
            ))}
          </div>

          <div className="human-review-queue__detail">
            {selectedRun ? (
              <HumanReviewPanel run={selectedRun} title={`${selectedRun.featureLabel} review`} />
            ) : (
              <div className="surface">
                <p className="panel-copy">Select an AI run to review.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
