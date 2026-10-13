import type { MatchRecommendation, Patient, Trial } from "../types";
import { MetricCard } from "./MetricCard";
import { StatusChip } from "./StatusChip";

interface PatientSummaryHeaderProps {
  patient: Patient;
  trial: Trial;
  match: MatchRecommendation;
}

export function PatientSummaryHeader({
  patient,
  trial,
  match
}: PatientSummaryHeaderProps) {
  const summaryParts = [
    patient.mrn,
    patient.age != null ? `Age ${patient.age}` : "Age unknown",
    patient.sex,
    patient.diagnosis,
  ];

  return (
    <section className="summary-header">
      <div className="summary-header__main">
        <div>
          <p className="eyebrow-label">Patient summary</p>
          <h3>{patient.name}</h3>
          <p>
            {summaryParts.join(" | ")}
          </p>
        </div>

        <div className="stacked-chips">
          <StatusChip label={patient.stage} tone="paper" />
          <StatusChip label={patient.ecog} tone="paper" />
          <StatusChip label={trial.shortCode} tone="teal" />
          <StatusChip label={match.recommendation} tone="amber" />
        </div>

        <div className="summary-list">
          <div>
            <span>Care team</span>
            <strong>{patient.careTeam}</strong>
          </div>
          <div>
            <span>Next appointment</span>
            <strong>{patient.nextAppointment}</strong>
          </div>
          <div>
            <span>Biomarkers</span>
            <strong>{patient.biomarkers.join(" | ")}</strong>
          </div>
          <div>
            <span>Top blockers</span>
            <strong>{match.blockers.join(" | ") || "None"}</strong>
          </div>
          <div>
            <span>Visit context</span>
            <strong>{match.visitContext ?? "Consult-driven review context."}</strong>
          </div>
          <div>
            <span>Evidence freshness</span>
            <strong>
              {match.evidenceFreshnessSummary ??
                "Mixed freshness across labs, notes, and outside records."}
            </strong>
          </div>
          <div>
            <span>Missing domains</span>
            <strong>{match.missingDomains?.join(" | ") || "No material gaps"}</strong>
          </div>
          <div>
            <span>Contradiction focus</span>
            <strong>{match.contradictionSummary ?? "No contradiction currently open."}</strong>
          </div>
        </div>
      </div>

      <div className="summary-header__metrics">
        <MetricCard
          label="Fit score"
          value={`${match.fitScore}`}
          detail="High-value candidate if exclusions clear"
        />
        <MetricCard label="Owner" value={match.owner} detail={match.assignedQueue} />
        <MetricCard
          label="Tracking"
          value="Active"
          detail={match.continuousTracking}
        />
        <MetricCard
          label="Manager metric"
          value={match.managerMetric ?? "Queue throughput"}
          detail={match.watchlistTrigger ?? "No active watchlist trigger"}
        />
      </div>
    </section>
  );
}
