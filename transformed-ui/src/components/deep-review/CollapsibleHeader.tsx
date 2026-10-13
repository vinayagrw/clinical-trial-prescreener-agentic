import React from "react";
import type { Patient, Trial, MatchRecommendation } from "../../types/index";
import { ProgressRing } from "../shared/ProgressRing";
import { StatusDot } from "../shared/StatusDot";
import { statusTone } from "../../data/helpers";

export interface CollapsibleHeaderProps {
  patient: Patient;
  match: MatchRecommendation;
  trial: Trial;
  collapsed: boolean;
}

export function CollapsibleHeader({
  patient,
  match,
  trial,
  collapsed,
}: CollapsibleHeaderProps) {
  const ringColor = match.fitScore >= 80 ? "teal" : match.fitScore >= 60 ? "amber" : "brick";

  if (collapsed) {
    return (
      <div className="collapsible-header glass-surface glass-surface--card collapsible-header--collapsed">
        <div className="collapsible-header__compact">
          <span className="collapsible-header__name" style={{ fontSize: "var(--text-body)" }}>
            {patient.name}
          </span>
          <StatusDot status={match.recommendation} size="sm" />
          <span className="patient-card__trial-code">{trial.shortCode}</span>
          <span className="patient-card__score">{match.fitScore}%</span>
          <span
            className="criterion-accordion__chevron"
            aria-label="Expand header"
          >
            &#9660;
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="collapsible-header glass-surface glass-surface--card collapsible-header--expanded">
      <div className="collapsible-header__full">
        <div>
          <div className="collapsible-header__name">{patient.name}</div>
          <div className="collapsible-header__meta">
            <span className="collapsible-header__chip">{patient.diagnosis}</span>
            <span className="collapsible-header__chip">{patient.stage}</span>
            <span className="collapsible-header__chip">{patient.ecog}</span>
            <span className="collapsible-header__chip">
              {patient.age}{patient.sex === "Female" ? "F" : "M"}
            </span>
            {patient.biomarkers.map((bm) => (
              <span key={bm} className="collapsible-header__chip">{bm}</span>
            ))}
          </div>
          <div className="collapsible-header__detail-list">
            <span>Care team: {patient.careTeam}</span>
            <span>Next appt: {patient.nextAppointment}</span>
            <span>{patient.mrn}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)" }}>
          <ProgressRing value={match.fitScore} size={64} color={ringColor} />
          <StatusDot
            status={match.recommendation}
            size="sm"
            label={match.recommendation.replace("_", " ")}
          />
        </div>
      </div>
    </div>
  );
}
