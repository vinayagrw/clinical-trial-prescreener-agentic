import { useNavigate } from "react-router-dom";
import { HandoffShell } from "../components/HandoffShell";
import { HandoffWorklistTable } from "../components/HandoffWorklistTable";
import { MetricCard } from "../components/MetricCard";
import {
  useReindexDocumentsMutation,
  useWorklistQuery,
} from "../data/queries/handoffs";
import { useUiStore } from "../stores/ui";

export function HandoffWorklistPage() {
  const navigate = useNavigate();
  const pushToast = useUiStore((state) => state.pushToast);
  const worklistQuery = useWorklistQuery();
  const reindexMutation = useReindexDocumentsMutation();

  const items = worklistQuery.data?.items ?? [];
  const needsReviewCount = items.filter((item) => item.status === "needs_review").length;
  const completedCount = items.filter((item) => item.status === "completed").length;
  const disagreementCount = items.reduce(
    (count, item) => count + item.openDisagreements,
    0,
  );
  const missingInfoCount = items.reduce(
    (count, item) => count + item.missingInfoCount,
    0,
  );

  async function handleReindex() {
    try {
      const result = await reindexMutation.mutateAsync();
      pushToast({
        title: "Documents reindexed",
        description: `${result.documentCount} normalized documents refreshed across ${result.handoffCount} handoffs.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "Reindex failed",
        description: error instanceof Error ? error.message : "Unknown reindex error",
        tone: "critical",
      });
    }
  }

  return (
    <HandoffShell
      title="Handoff worklist"
      subtitle="Generate and review SBAR shift summaries backed by deterministic extraction, conflict-aware reasoning, and sentence-level provenance."
      topRight={
        <button
          type="button"
          className="button-secondary"
          onClick={() => void handleReindex()}
          disabled={reindexMutation.isPending}
        >
          {reindexMutation.isPending ? "Reindexing..." : "Reindex documents"}
        </button>
      }
    >
      <section className="metric-grid metric-grid--four">
        <MetricCard
          label="Active handoffs"
          value={`${items.length}`}
          detail="Default 72-hour encounter summaries"
        />
        <MetricCard
          label="Needs review"
          value={`${needsReviewCount}`}
          detail="Critical disagreement or missing information present"
        />
        <MetricCard
          label="Completed"
          value={`${completedCount}`}
          detail="Ready for resident sign-out with citations intact"
        />
        <MetricCard
          label="Total flags"
          value={`${disagreementCount + missingInfoCount}`}
          detail={`${disagreementCount} disagreements, ${missingInfoCount} missing-info markers`}
        />
      </section>

      {worklistQuery.isLoading ? (
        <section className="surface handoff-surface">
          <p className="panel-copy">Loading the live handoff worklist from the local API...</p>
        </section>
      ) : worklistQuery.error ? (
        <section className="surface handoff-surface">
          <p className="panel-copy">
            Failed to load the worklist: {worklistQuery.error.message}
          </p>
        </section>
      ) : (
        <HandoffWorklistTable
          items={items}
          onOpen={(handoffId) => navigate(`/handoffs/${handoffId}`)}
        />
      )}
    </HandoffShell>
  );
}
