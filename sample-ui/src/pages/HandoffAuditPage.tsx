import { useParams } from "react-router-dom";
import { HandoffAuditPanel } from "../components/HandoffAuditPanel";
import { HandoffShell } from "../components/HandoffShell";
import { MetricCard } from "../components/MetricCard";
import { useHandoffAuditQuery, useHandoffQuery } from "../data/queries/handoffs";

export function HandoffAuditPage() {
  const { handoffId } = useParams();
  const handoffQuery = useHandoffQuery(handoffId);
  const auditQuery = useHandoffAuditQuery(handoffId);

  if (handoffQuery.isLoading || auditQuery.isLoading) {
    return (
      <HandoffShell
        title="Loading audit trail"
        subtitle="Fetching pipeline events and stored summary metadata."
      >
        <section className="surface handoff-surface">
          <p className="panel-copy">Loading audit events...</p>
        </section>
      </HandoffShell>
    );
  }

  if (handoffQuery.error || auditQuery.error || !handoffQuery.data || !auditQuery.data) {
    return (
      <HandoffShell
        title="Audit unavailable"
        subtitle="The requested audit trail could not be loaded."
      >
        <section className="surface handoff-surface">
          <p className="panel-copy">
            {handoffQuery.error?.message ?? auditQuery.error?.message ?? "No audit data returned."}
          </p>
        </section>
      </HandoffShell>
    );
  }

  const record = handoffQuery.data;
  const audit = auditQuery.data;

  return (
    <HandoffShell
      title={`Audit trail | ${record.patientName}`}
      subtitle={`${record.encounterId} | ${record.windowHours}-hour window`}
      recordId={record.id}
    >
      <section className="metric-grid metric-grid--three">
        <MetricCard
          label="Audit events"
          value={`${audit.audit.length}`}
          detail="Ingestion through persistence"
        />
        <MetricCard
          label="Status"
          value={audit.status.replace("_", " ")}
          detail={record.headline}
        />
        <MetricCard
          label="Citations"
          value={`${record.summary.citations.length}`}
          detail="Verbatim evidence references attached to the case"
        />
      </section>

      <HandoffAuditPanel events={audit.audit} />
    </HandoffShell>
  );
}
