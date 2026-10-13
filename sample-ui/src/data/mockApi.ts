import {
  assessments,
  auditEvents,
  evidenceSnippets,
  findMatchByPatientAndTrial,
  funnelMetrics,
  getMatch,
  getNormalizedCriteriaForTrial,
  getPatient,
  getTrial,
  getTrialVersionsForTrial,
  getVisibleMatches,
  getVisiblePatients,
  getVisibleQueueItems,
  heatmapRows,
  listMatchesForPatient,
  listPatientsWithMatches,
  listTrials,
  roiCards,
  timelineEvents,
  trials
} from "./mockData";
import {
  apiEndpointCatalog,
  contradictionSignalsByMatch,
  domainEntityCatalog,
  integrationFeeds,
  missingDataSignalsByMatch,
  overrideClusters,
  piHandoffsByMatch,
  pilotAcceptanceCards,
  trialMetricCards
} from "./platformData";
import type {
  MatchReviewPackage,
  PatientEvidenceBundle,
  ReviewAction,
  ScreeningJob,
  ScreeningMetricSnapshot
} from "../types";

function buildScreeningJob(patientId: string, trialScope: string, trigger: string): ScreeningJob {
  return {
    id: `screening-job-${patientId}-${trialScope}`,
    patientId,
    trialScope,
    status: "completed",
    startedAt: "Apr 6, 2026 | 7:10 AM",
    completedAt: "Apr 6, 2026 | 7:14 AM",
    trigger
  };
}

function buildEvidenceBundle(patientId: string): PatientEvidenceBundle {
  const items = evidenceSnippets
    .filter((item) => item.patientId === patientId)
    .map((item) => ({
      id: item.id,
      label: item.sourceDocument,
      sourceType: item.type,
      sourceDate: item.sourceDate,
      freshness: item.freshness ?? "fresh",
      linkedCriterionIds: item.criterionIds
    }));

  const relatedMatch = getVisibleMatches().find((item) => item.patientId === patientId);

  return {
    id: `bundle-${patientId}`,
    patientId,
    coverageSummary: `${items.length} cited records across structured and unstructured evidence domains.`,
    missingDomains: relatedMatch?.missingDomains ?? [],
    freshnessSummary:
      relatedMatch?.evidenceFreshnessSummary ??
      "Fresh structured evidence with one late-arriving outside packet.",
    items
  };
}

export const screeningApi = apiEndpointCatalog;
export const domainEntities = domainEntityCatalog;
export const sourceAdapters = integrationFeeds;
export const rolloutGuardrails = pilotAcceptanceCards;

export function importTrials() {
  const availableTrials = listTrials();

  return {
    importedTrials: availableTrials.length,
    staleTrials: availableTrials.filter((trial) => trial.status !== "active").length,
    refreshedAt: "Apr 6, 2026 | 6:42 AM"
  };
}

export function parseTrialCriteria(trialId: string) {
  const criteria = getNormalizedCriteriaForTrial(trialId);

  return {
    trialId,
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      trialId: criterion.trialId,
      label: criterion.label,
      type: criterion.type,
      computability: criterion.computability,
      threshold: criterion.threshold,
      owner: criterion.owner
    })),
    computabilityMix: {
      deterministic: criteria.filter((criterion) => criterion.computability === "deterministic").length,
      hybrid: criteria.filter((criterion) => criterion.computability === "hybrid").length,
      manualOnly: criteria.filter((criterion) => criterion.computability === "manual_only").length
    }
  };
}

export function screenPatient(patientId: string) {
  return {
    screeningJob: buildScreeningJob(patientId, "Oncology-pilot", "nightly_rescreen"),
    recommendations: getVisibleMatches().filter((match) => match.patientId === patientId)
  };
}

export function screenPatientTrial(patientId: string, trialId: string) {
  const match = getVisibleMatches().find(
    (item) => item.patientId === patientId && item.trialId === trialId
  );

  return match ? getMatchReviewPackage(match.id) : null;
}

export function listPatientMatches(patientId: string) {
  return {
    recommendations: getVisibleMatches().filter((match) => match.patientId === patientId)
  };
}

export function getMatchReviewPackage(matchId: string): MatchReviewPackage | null {
  const match = getMatch(matchId);
  if (!match) {
    return null;
  }

  const patient = getPatient(match.patientId);
  const trial = getTrial(match.trialId);
  if (!patient || !trial) {
    return null;
  }

  const reviewAssessments = assessments.filter((assessment) =>
    match.criterionIds.includes(assessment.id)
  );
  const reviewEvidence = evidenceSnippets.filter(
    (item) => item.patientId === patient.id
  );
  const reviewTimeline = timelineEvents.filter((item) => item.patientId === patient.id);
  const reviewAudit = auditEvents.filter((item) => match.auditIds.includes(item.id));

  return {
    match,
    patient,
    trial,
    assessments: reviewAssessments,
    evidence: reviewEvidence,
    timeline: reviewTimeline,
    audit: reviewAudit,
    missingData: missingDataSignalsByMatch[matchId] ?? [],
    contradictions: contradictionSignalsByMatch[matchId] ?? [],
    piHandoff: piHandoffsByMatch[matchId]
  };
}

export function getPatientEvidenceBundle(patientId: string) {
  return buildEvidenceBundle(patientId);
}

export function overrideAssessment(
  matchId: string,
  assessmentId: string,
  result: string,
  rationale: string
): ReviewAction {
  return {
    id: `review-action-${matchId}-${assessmentId}`,
    matchId,
    criterionId: assessmentId,
    actor: "Lena Ortiz",
    actionType: "override",
    result,
    rationale,
    timestamp: "Apr 6, 2026 | 8:04 AM"
  };
}

export function finalizeMatch(
  matchId: string,
  result: string,
  rationale: string
): ReviewAction {
  return {
    id: `review-finalize-${matchId}`,
    matchId,
    actor: "Lena Ortiz",
    actionType: "finalize",
    result,
    rationale,
    timestamp: "Apr 6, 2026 | 8:07 AM"
  };
}

export function recordMatchOutcome(matchId: string, outcome: string): ReviewAction {
  return {
    id: `review-outcome-${matchId}`,
    matchId,
    actor: "Research ops automation",
    actionType: "outcome_recorded",
    result: outcome,
    rationale: "Recorded from the mock command-center workflow.",
    timestamp: "Apr 6, 2026 | 8:18 AM"
  };
}

export function getScreeningMetrics(): ScreeningMetricSnapshot {
  const visibleQueueItems = getVisibleQueueItems();
  return {
    medianReviewTime: roiCards[0]?.value ?? "14 min",
    reviewedToday: 18,
    needsPiReview: visibleQueueItems.filter((item) => item.nextStep === "needs_pi_review").length,
    falseExclusionRate: roiCards[3]?.value ?? "1.8%"
  };
}

export function getEnrollmentFunnel() {
  return {
    funnel: funnelMetrics,
    recoveredCapacity: roiCards[1]?.delta ?? "+12 hours recovered"
  };
}

export function getTrialMetric(trialId: string) {
  return trialMetricCards.find((card) => card.trialId === trialId) ?? null;
}

export {
  findMatchByPatientAndTrial,
  getNormalizedCriteriaForTrial,
  getTrialVersionsForTrial,
  listMatchesForPatient,
  listPatientsWithMatches,
  listTrials
};

export function getOpsInsights() {
  const visibleQueueItems = getVisibleQueueItems();
  const visiblePatients = getVisiblePatients();
  return {
    hotspots: heatmapRows,
    overrideClusters,
    queueSummary: {
      queueSize: visibleQueueItems.length,
      reviewedPatients: visiblePatients.length,
      activeTrials: trials.length
    }
  };
}
