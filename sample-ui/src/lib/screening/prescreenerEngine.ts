import {
  assessments as assessmentTemplates,
  evidenceSnippets,
  funnelMetrics,
  getMatch,
  getPatient,
  getTrial,
  getTrialVersionsForTrial,
  heatmapRows,
  matches as baseMatches,
  normalizedCriteria,
  patients,
  queueItems,
  roiCards,
  timelineEvents,
  trials
} from "../../data/mockData";
// `overrideClusters` lives in platformData (Command Center ops insights),
// not mockData, so it's imported separately from the primary record set.
import { overrideClusters } from "../../data/platformData";
import type {
  AiQualityMetricSnapshot,
  AuditEvent,
  ContradictionSignal,
  CriterionAssessment,
  Freshness,
  MatchRecommendation,
  MatchReviewPackage,
  MatchStatus,
  MissingDataSignal,
  NormalizedCriterion,
  PatientEvidenceBundle,
  ReviewAction,
  ScreeningEngineVersions,
  ScreeningJob,
  ScreeningMetricSnapshot,
  TrialMetricCard,
  UncertaintyReason
} from "../../types";
import { daysBetween } from "../temporal/dateMath";
import {
  getLatestReviewAction,
  listPersistedReviewActions
} from "./persistence";

const SCREENING_SCOPE = "oncology-pilot";

export const ENGINE_VERSIONS: ScreeningEngineVersions = {
  normalizationVersion: "protocol-normalizer-1.0",
  ruleVersion: "rules-1.0.0",
  promptVersion: "prompt-criteria-2.0",
  modelVersion: "clinical-retrieval-sim-1.0",
  generatedAt: "Apr 14, 2026 | 8:12 AM"
};

type CriterionRuleKind =
  | "diagnosis_biomarker"
  | "progression_after_therapy"
  | "event_lookback_exclusion"
  | "contradiction_check"
  | "lab_threshold"
  | "manual_only"
  | "ecog_window"
  | "no_prior_exposure"
  | "measurable_disease"
  | "biomarker_threshold"
  | "prior_systemic_therapy"
  | "staging_window";

interface LabThresholdDefinition {
  field: string;
  comparator: ">=" | "<=" | "<" | ">";
  value: number;
  unit: string;
}

interface CriterionRuleSpec {
  kind: CriterionRuleKind;
  diagnosisAliases?: string[][];
  biomarkerAliases?: string[][];
  therapyAliases?: string[][];
  eventAliases?: string[];
  lookbackDays?: number;
  temporalWindowDays?: number;
  ecogMax?: number;
  thresholds?: LabThresholdDefinition[];
  pdl1Threshold?: number;
  freshnessDays?: number;
  requireAllThresholds?: boolean;
  passWithAttestation?: boolean;
  explicitAttestationRequired?: boolean;
  stageFreshnessDays?: number;
}

const RULE_SPECS: Record<string, CriterionRuleSpec> = {
  "criterion-001": {
    kind: "diagnosis_biomarker",
    diagnosisAliases: [["adenocarcinoma", "nsclc"], ["metastatic"]],
    biomarkerAliases: [["egfr exon20 insertion", "egfr exon20", "egfr ex20ins"]]
  },
  "criterion-002": {
    kind: "progression_after_therapy",
    therapyAliases: [["carboplatin"], ["pemetrexed"], ["platinum"]]
  },
  "criterion-003": {
    kind: "event_lookback_exclusion",
    eventAliases: ["nstemi", "myocardial infarction", "mi", "troponin elevation"],
    lookbackDays: 180
  },
  "criterion-004": { kind: "contradiction_check" },
  "criterion-005": {
    kind: "lab_threshold",
    freshnessDays: 14,
    thresholds: [
      { field: "anc", comparator: ">=", value: 1.5, unit: "K/uL" },
      { field: "platelets", comparator: ">=", value: 100, unit: "K/uL" }
    ],
    requireAllThresholds: true
  },
  "criterion-006": { kind: "manual_only", passWithAttestation: false },
  "criterion-007": {
    kind: "diagnosis_biomarker",
    diagnosisAliases: [["cholangiocarcinoma", "biliary"]],
    biomarkerAliases: [["fgfr2-bicc1", "fgfr2 fusion"]]
  },
  "criterion-008": { kind: "ecog_window", ecogMax: 1, temporalWindowDays: 30 },
  "criterion-009": {
    kind: "lab_threshold",
    freshnessDays: 14,
    thresholds: [{ field: "bilirubin", comparator: "<", value: 1.5, unit: "x ULN" }]
  },
  "criterion-010": { kind: "no_prior_exposure", therapyAliases: [["fgfr"]] },
  "criterion-011": { kind: "manual_only", passWithAttestation: false },
  "criterion-012": {
    kind: "manual_only",
    passWithAttestation: false,
    explicitAttestationRequired: true
  },
  "criterion-013": {
    kind: "diagnosis_biomarker",
    diagnosisAliases: [["triple-negative", "er 0%", "pr 0%", "her2 0"], ["metastatic"]]
  },
  "criterion-014": { kind: "measurable_disease" },
  "criterion-015": { kind: "biomarker_threshold", pdl1Threshold: 10 },
  "criterion-016": {
    kind: "no_prior_exposure",
    therapyAliases: [["pd-1", "pd-l1", "checkpoint", "immunotherapy"]]
  },
  "criterion-017": {
    kind: "lab_threshold",
    freshnessDays: 7,
    thresholds: [
      { field: "anc", comparator: ">=", value: 1.5, unit: "K/uL" },
      { field: "platelets", comparator: ">=", value: 100, unit: "K/uL" },
      { field: "hemoglobin", comparator: ">=", value: 9, unit: "g/dL" }
    ],
    requireAllThresholds: true
  },
  "criterion-018": { kind: "ecog_window", ecogMax: 1, temporalWindowDays: 14 },
  "criterion-019": {
    kind: "diagnosis_biomarker",
    diagnosisAliases: [["adenocarcinoma", "nsclc"], ["metastatic"]],
    biomarkerAliases: [["egfr exon20 insertion", "egfr exon20", "egfr ex20ins"]]
  },
  "criterion-020": {
    kind: "progression_after_therapy",
    therapyAliases: [["carboplatin"], ["pemetrexed"], ["platinum"]]
  },
  "criterion-021": {
    kind: "event_lookback_exclusion",
    eventAliases: ["nstemi", "myocardial infarction", "mi", "troponin elevation"],
    lookbackDays: 180
  },
  "criterion-022": { kind: "contradiction_check" },
  "criterion-023": {
    kind: "lab_threshold",
    freshnessDays: 14,
    thresholds: [
      { field: "anc", comparator: ">=", value: 1.5, unit: "K/uL" },
      { field: "platelets", comparator: ">=", value: 100, unit: "K/uL" }
    ],
    requireAllThresholds: true
  },
  "criterion-024": { kind: "manual_only", passWithAttestation: false },
  "criterion-025": {
    kind: "diagnosis_biomarker",
    diagnosisAliases: [["endometrioid adenocarcinoma", "endometrial"], ["recurrent"]]
  },
  "criterion-026": {
    kind: "diagnosis_biomarker",
    biomarkerAliases: [["msi-high", "msi high"], ["mmr-deficient", "mlh1 loss", "pms2 loss"]]
  },
  "criterion-027": {
    kind: "no_prior_exposure",
    therapyAliases: [["pd-1", "pd-l1", "checkpoint", "immunotherapy"]]
  },
  "criterion-028": {
    kind: "lab_threshold",
    freshnessDays: 21,
    thresholds: [
      { field: "anc", comparator: ">=", value: 1.5, unit: "K/uL" },
      { field: "platelets", comparator: ">=", value: 100, unit: "K/uL" },
      { field: "bilirubin", comparator: "<", value: 1.5, unit: "x ULN" }
    ],
    requireAllThresholds: true
  },
  "criterion-029": { kind: "measurable_disease" },
  "criterion-030": { kind: "ecog_window", ecogMax: 1, temporalWindowDays: 14 },
  "criterion-031": {
    kind: "diagnosis_biomarker",
    biomarkerAliases: [["mmr-deficient", "mlh1 loss", "pms2 loss", "msi-high"]]
  },
  "criterion-032": { kind: "prior_systemic_therapy" },
  "criterion-033": {
    kind: "no_prior_exposure",
    therapyAliases: [["pd-1", "pd-l1", "checkpoint", "immunotherapy"]]
  },
  "criterion-034": {
    kind: "lab_threshold",
    freshnessDays: 14,
    thresholds: [
      { field: "anc", comparator: ">=", value: 1.5, unit: "K/uL" },
      { field: "platelets", comparator: ">=", value: 100, unit: "K/uL" }
    ],
    requireAllThresholds: true
  },
  "criterion-035": {
    kind: "manual_only",
    passWithAttestation: true,
    explicitAttestationRequired: true
  },
  "criterion-036": {
    kind: "diagnosis_biomarker",
    biomarkerAliases: [["mmr-deficient", "msi-high", "mmr ihc ordered"]]
  },
  "criterion-037": { kind: "manual_only", passWithAttestation: false },
  "criterion-038": {
    kind: "no_prior_exposure",
    therapyAliases: [["pd-1", "pd-l1", "checkpoint", "immunotherapy"]]
  },
  "criterion-039": { kind: "staging_window", stageFreshnessDays: 60 }
};

const MISSING_DATA_OWNERS: Record<string, string> = {
  cardiology: "Outside records team",
  pathology: "GI oncology coordinator",
  labs: "Clinical screening queue",
  imaging: "Records coordination",
  medications: "Pharmacy reconciliation",
  ecog: "Disease-team coordinator"
};

function normalizeText(value: string) {
  return value.toLowerCase();
}

function formatDateLabel(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatTimestamp(iso: string, timeLabel: string) {
  return `${formatDateLabel(iso)} | ${timeLabel}`;
}

function toIso(sourceDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) {
    return sourceDate;
  }

  const parsed = Date.parse(sourceDate);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return "2026-04-06";
}

function countTone(
  evidence: typeof evidenceSnippets,
  tone: "supporting" | "contradicting"
) {
  return evidence.filter((item) => item.tone === tone).length;
}

function extractNumber(pattern: RegExp, excerpt: string) {
  const match = pattern.exec(excerpt);
  if (!match) {
    return null;
  }

  return Number.parseFloat(match[1]);
}

function extractLabValues(excerpt: string) {
  return {
    anc: extractNumber(/anc\s+([0-9.]+)/i, excerpt),
    platelets: extractNumber(/platelets\s+([0-9.]+)/i, excerpt),
    hemoglobin: extractNumber(/hemoglobin\s+([0-9.]+)/i, excerpt),
    bilirubin: extractNumber(/bilirubin\s+([0-9.]+)/i, excerpt),
    creatinine: extractNumber(/creatinine\s+([0-9.]+)/i, excerpt)
  };
}

function containsAlias(text: string, aliasGroups: string[][] = []) {
  return aliasGroups.every((group) =>
    group.some((alias) => normalizeText(text).includes(alias))
  );
}

function inferAssertionStatus(text: string) {
  const lower = normalizeText(text);

  if (/family history|mother|father|sister|brother/.test(lower)) return "family";
  if (/rule out|possible|pending|indeterminate|concerning for/.test(lower)) return "possible";
  if (/\bno\b|\bdenies\b|\bwithout\b|negative for|not consistent with/.test(lower)) return "negated";
  if (/history of|hospitalization for|completed|prior /.test(lower)) return "historical";
  return "present";
}

function deriveConceptTags(criterion: NormalizedCriterion) {
  const text = normalizeText(`${criterion.label} ${criterion.threshold} ${criterion.note}`);
  const tags: string[] = [];

  if (/ecog|performance status/.test(text)) tags.push("performance_status");
  if (/anc|platelet|bilirubin|creatinine|organ function|lab/.test(text)) tags.push("lab");
  if (/egfr|fgfr2|msi|mmr|pd-l1/.test(text)) tags.push("biomarker");
  if (/myocardial infarction|washout|within/.test(text)) tags.push("temporal");
  if (/cns|disease|adenocarcinoma|cholangiocarcinoma|tnbc|endometrial/.test(text)) tags.push("disease");
  if (/manual|judges|pi/.test(text)) tags.push("manual_review");
  if (/therapy|prior|platinum|immune/.test(text)) tags.push("therapy_history");

  return tags;
}

function deriveTemporalWindow(criterion: NormalizedCriterion) {
  const text = `${criterion.label} ${criterion.threshold}`;
  const dayMatch = /(\d+)[-\s]?day/i.exec(text);
  const monthMatch = /(\d+)[-\s]?month/i.exec(text);

  if (dayMatch) return `${dayMatch[1]} days`;
  if (monthMatch) return `${monthMatch[1]} months`;
  return undefined;
}

function enrichCriterion(criterion: NormalizedCriterion): NormalizedCriterion {
  return {
    ...criterion,
    conceptTags: deriveConceptTags(criterion),
    temporalAnchor: /within|lookback/i.test(`${criterion.label} ${criterion.threshold}`)
      ? "screening_date"
      : undefined,
    temporalWindow: deriveTemporalWindow(criterion),
    qaStatus:
      criterion.computability === "manual_only"
        ? "manual_only"
        : getTrial(criterion.trialId)?.localStatus === "active"
          ? "approved"
          : "needs_review",
    protocolSource: getTrial(criterion.trialId)?.protocolVersion
  };
}

function buildScreeningJob(patientId: string, trialIds: string[], trigger: string): ScreeningJob {
  return {
    id: `screening-job-${patientId}-${trialIds.join("-")}`,
    patientId,
    trialScope: SCREENING_SCOPE,
    status: "completed",
    startedAt: "Apr 14, 2026 | 7:58 AM",
    completedAt: ENGINE_VERSIONS.generatedAt,
    trigger,
    screenedTrialIds: trialIds,
    ruleVersion: ENGINE_VERSIONS.ruleVersion,
    promptVersion: ENGINE_VERSIONS.promptVersion,
    modelVersion: ENGINE_VERSIONS.modelVersion,
    normalizationVersion: ENGINE_VERSIONS.normalizationVersion
  };
}

function applyComparator(
  value: number | null,
  comparator: LabThresholdDefinition["comparator"],
  threshold: number,
  opts?: { field?: string; relativeToULN?: number },
) {
  if (value === null) return false;
  // Item 7: resolve "× ULN" thresholds into absolute values before comparison.
  let effectiveThreshold = threshold;
  if (opts?.relativeToULN && opts.field) {
    try {
      const { resolveUlnThreshold } = require("../units/ulnTable");
      const resolved = resolveUlnThreshold(opts.field, opts.relativeToULN);
      if (resolved) effectiveThreshold = resolved.absoluteValue;
    } catch { /* ULN table unavailable — use raw threshold */ }
  }
  if (comparator === ">=") return value >= effectiveThreshold;
  if (comparator === "<=") return value <= effectiveThreshold;
  if (comparator === "<") return value < effectiveThreshold;
  return value > effectiveThreshold;
}

function freshnessForEvidence(
  screeningIso: string,
  evidence: typeof evidenceSnippets,
  freshnessDays?: number
): Freshness {
  if (evidence.length === 0) return "missing";

  if (!freshnessDays) {
    if (evidence.some((item) => item.freshness === "missing")) return "missing";
    if (evidence.some((item) => item.freshness === "stale")) return "stale";
    if (evidence.some((item) => item.freshness === "aging")) return "aging";
    return "fresh";
  }

  const latestIso = evidence.map((item) => toIso(item.sourceDate)).sort().at(-1);
  if (!latestIso) return "missing";

  const age = daysBetween(screeningIso, latestIso);
  if (age > freshnessDays) return "stale";
  if (age > Math.max(1, freshnessDays - 3)) return "aging";
  return "fresh";
}

function pickEvidence(matchId: string, criterionId: string) {
  const match = getMatch(matchId);
  if (!match) return [];

  return evidenceSnippets.filter(
    (item) =>
      item.patientId === match.patientId &&
      item.criterionIds.includes(criterionId)
  );
}

function evaluateDiagnosisBiomarker(
  evidence: typeof evidenceSnippets,
  rule: CriterionRuleSpec
) {
  // Filter out negated/family evidence before alias matching so that
  // "adenocarcinoma ruled out" or "family history of NSCLC" don't
  // produce false-positive matches.
  const positiveEvidence = evidence.filter((item) => {
    const status = inferAssertionStatus(item.excerpt);
    return status === "present" || status === "historical";
  });
  const combinedText = positiveEvidence.map((item) => item.excerpt).join(" ").toLowerCase();
  const diagnosisPass =
    !rule.diagnosisAliases || containsAlias(combinedText, rule.diagnosisAliases);
  const biomarkerPass =
    !rule.biomarkerAliases || containsAlias(combinedText, rule.biomarkerAliases);

  if (positiveEvidence.length === 0) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: [] as string[]
    };
  }

  const freshness = freshnessForEvidence("2026-04-06", evidence);
  if (freshness === "missing" || freshness === "stale") {
    return {
      status: "uncertain" as MatchStatus,
      freshness,
      uncertaintyReason: freshness === "missing" ? ("missing_domain" as UncertaintyReason) : ("stale_data" as UncertaintyReason),
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: diagnosisPass && biomarkerPass ? ("pass" as MatchStatus) : ("fail" as MatchStatus),
    freshness,
    reviewRequired: !(diagnosisPass && biomarkerPass),
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateProgressionAfterTherapy(
  evidence: typeof evidenceSnippets,
  rule: CriterionRuleSpec
) {
  // Exclude negated evidence ("no progression") from alias matching.
  const positiveEvidence = evidence.filter((item) => {
    const status = inferAssertionStatus(item.excerpt);
    return status === "present" || status === "historical";
  });
  const text = positiveEvidence.map((item) => item.excerpt).join(" ").toLowerCase();
  const hasProgression = /progression|restaging confirms progression|progressed/.test(text);
  const hasTherapy =
    rule.therapyAliases?.some((aliases) =>
      aliases.some((alias) => text.includes(alias))
    ) ?? false;

  return {
    status: hasProgression && hasTherapy ? ("pass" as MatchStatus) : ("fail" as MatchStatus),
    freshness: freshnessForEvidence("2026-04-06", evidence),
    reviewRequired: false,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateEventLookback(
  evidence: typeof evidenceSnippets,
  screeningIso: string,
  rule: CriterionRuleSpec
) {
  const eventEvidence = evidence.filter((item) => {
    const text = normalizeText(item.excerpt);
    return (rule.eventAliases ?? []).some((alias) => text.includes(alias));
  });

  if (eventEvidence.length === 0) {
    return {
      status: "pass" as MatchStatus,
      freshness: "fresh" as Freshness,
      reviewRequired: false,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  if (eventEvidence.some((item) => inferAssertionStatus(item.excerpt) === "possible")) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: freshnessForEvidence(screeningIso, eventEvidence, rule.lookbackDays),
      uncertaintyReason: "conflicting_evidence" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: eventEvidence.map((item) => item.id)
    };
  }

  const presentEvent = eventEvidence.find((item) => {
    const status = inferAssertionStatus(item.excerpt);
    return status !== "negated" && status !== "family";
  });
  if (!presentEvent) {
    return {
      status: "pass" as MatchStatus,
      freshness: "fresh" as Freshness,
      reviewRequired: false,
      evidenceIds: eventEvidence.map((item) => item.id)
    };
  }

  const eventIso = toIso(presentEvent.sourceDate);
  const withinWindow =
    daysBetween(screeningIso, eventIso) <= (rule.lookbackDays ?? Number.MAX_SAFE_INTEGER);

  return {
    status: withinWindow ? ("fail" as MatchStatus) : ("pass" as MatchStatus),
    freshness: freshnessForEvidence(screeningIso, eventEvidence, rule.lookbackDays),
    reviewRequired: withinWindow,
    evidenceIds: eventEvidence.map((item) => item.id)
  };
}

function evaluateContradiction(
  evidence: typeof evidenceSnippets,
  screeningIso: string
) {
  const supporting = evidence.filter((item) => item.tone === "supporting");
  const contradicting = evidence.filter((item) => item.tone === "contradicting");

  if (supporting.length > 0 && contradicting.length > 0) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: freshnessForEvidence(screeningIso, evidence, 30),
      uncertaintyReason: "conflicting_evidence" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  if (contradicting.length > 0) {
    const hasPossible = contradicting.some((item) => inferAssertionStatus(item.excerpt) === "possible");
    return {
      status: hasPossible ? ("uncertain" as MatchStatus) : ("fail" as MatchStatus),
      freshness: freshnessForEvidence(screeningIso, evidence, 30),
      uncertaintyReason: hasPossible ? ("conflicting_evidence" as UncertaintyReason) : undefined,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: "pass" as MatchStatus,
    freshness: freshnessForEvidence(screeningIso, evidence, 30),
    reviewRequired: false,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateLabThreshold(
  evidence: typeof evidenceSnippets,
  screeningIso: string,
  rule: CriterionRuleSpec
) {
  if (evidence.length === 0) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: [] as string[]
    };
  }

  const latest = [...evidence].sort((left, right) =>
    toIso(left.sourceDate).localeCompare(toIso(right.sourceDate))
  ).at(-1);
  const freshness = freshnessForEvidence(screeningIso, evidence, rule.freshnessDays);
  const values = extractLabValues(latest?.excerpt ?? "");

  if (freshness === "missing" || freshness === "stale") {
    return {
      status: "uncertain" as MatchStatus,
      freshness,
      uncertaintyReason: freshness === "missing" ? ("missing_domain" as UncertaintyReason) : ("stale_data" as UncertaintyReason),
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  const thresholdResults = (rule.thresholds ?? []).map((threshold) =>
    applyComparator(values[threshold.field as keyof typeof values], threshold.comparator, threshold.value)
  );
  const allSatisfied =
    rule.requireAllThresholds === false ? thresholdResults.some(Boolean) : thresholdResults.every(Boolean);

  return {
    status: allSatisfied ? ("pass" as MatchStatus) : ("fail" as MatchStatus),
    freshness,
    reviewRequired: !allSatisfied,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateManualOnly(
  evidence: typeof evidenceSnippets,
  screeningIso: string,
  rule: CriterionRuleSpec
) {
  const text = evidence.map((item) => item.excerpt).join(" ").toLowerCase();
  const hasExplicitAttestation =
    /estimated survival exceeds|candidate for systemic immunotherapy trial enrollment|pi attestation/.test(text);
  const hasOnlySelfReport = /self-reported|patient states/.test(text);

  if (rule.passWithAttestation && hasExplicitAttestation) {
    return {
      status: "pass" as MatchStatus,
      freshness: freshnessForEvidence(screeningIso, evidence, 30),
      reviewRequired: false,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  if (hasOnlySelfReport) {
    return {
      status: "manual_review" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: "manual_review" as MatchStatus,
    freshness: freshnessForEvidence(screeningIso, evidence, 30),
    uncertaintyReason: rule.explicitAttestationRequired ? ("manual_only" as UncertaintyReason) : undefined,
    reviewRequired: true,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateEcog(
  evidence: typeof evidenceSnippets,
  screeningIso: string,
  rule: CriterionRuleSpec
) {
  if (evidence.length === 0) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: [] as string[]
    };
  }

  const latest = [...evidence].sort((left, right) =>
    toIso(left.sourceDate).localeCompare(toIso(right.sourceDate))
  ).at(-1);
  const freshness = freshnessForEvidence(screeningIso, evidence, rule.temporalWindowDays);
  const ecogValue = extractNumber(/ecog\s+([0-9]+)/i, latest?.excerpt ?? "");

  if (freshness === "stale") {
    return {
      status: "uncertain" as MatchStatus,
      freshness,
      uncertaintyReason: "stale_data" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  if (ecogValue === null) {
    return {
      status: "uncertain" as MatchStatus,
      freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: ecogValue <= (rule.ecogMax ?? 1) ? ("pass" as MatchStatus) : ("fail" as MatchStatus),
    freshness,
    reviewRequired: ecogValue > (rule.ecogMax ?? 1),
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateNoPriorExposure(
  evidence: typeof evidenceSnippets,
  rule: CriterionRuleSpec
) {
  if (evidence.length === 0) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: [] as string[]
    };
  }

  const text = evidence.map((item) => item.excerpt).join(" ").toLowerCase();
  const hasForbiddenExposure =
    rule.therapyAliases?.some((aliases) => aliases.some((alias) => text.includes(alias))) ?? false;
  const explicitlyNegative = /no .*administered|no .*history|no immunotherapy/.test(text);

  if (!explicitlyNegative && /pending|no formal outside records|structured medication record .* empty/.test(text)) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: hasForbiddenExposure && !explicitlyNegative ? ("fail" as MatchStatus) : ("pass" as MatchStatus),
    freshness: freshnessForEvidence("2026-04-06", evidence),
    reviewRequired: hasForbiddenExposure && !explicitlyNegative,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateMeasurableDisease(evidence: typeof evidenceSnippets) {
  const text = evidence.map((item) => item.excerpt).join(" ").toLowerCase();
  const measurable = /measurable|target lesions|recist/.test(text);
  return {
    status: measurable ? ("pass" as MatchStatus) : ("uncertain" as MatchStatus),
    freshness: freshnessForEvidence("2026-04-06", evidence, 60),
    uncertaintyReason: measurable ? undefined : ("missing_domain" as UncertaintyReason),
    reviewRequired: !measurable,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateBiomarkerThreshold(
  evidence: typeof evidenceSnippets,
  rule: CriterionRuleSpec
) {
  const text = evidence.map((item) => item.excerpt).join(" ").toLowerCase();
  const cps = extractNumber(/cps\s+([0-9]+)/i, text);

  if (cps === null) {
    return {
      status: "uncertain" as MatchStatus,
      freshness: freshnessForEvidence("2026-04-06", evidence),
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: cps >= (rule.pdl1Threshold ?? 0) ? ("pass" as MatchStatus) : ("fail" as MatchStatus),
    freshness: freshnessForEvidence("2026-04-06", evidence),
    reviewRequired: cps < (rule.pdl1Threshold ?? 0),
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluatePriorSystemicTherapy(evidence: typeof evidenceSnippets) {
  if (evidence.length === 0) {
    return {
      status: "manual_review" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: [] as string[]
    };
  }

  const text = evidence.map((item) => item.excerpt).join(" ").toLowerCase();
  const hasStructuredTherapy = /cycle|completed|administered|paclitaxel|carboplatin|dabrafenib|trametinib/.test(text);
  const selfReportOnly = /patient states|self-reported/.test(text) && !/administered|completed/.test(text);

  if (selfReportOnly) {
    return {
      status: "manual_review" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: hasStructuredTherapy ? ("pass" as MatchStatus) : ("uncertain" as MatchStatus),
    freshness: freshnessForEvidence("2026-04-06", evidence),
    uncertaintyReason: hasStructuredTherapy ? undefined : ("missing_domain" as UncertaintyReason),
    reviewRequired: !hasStructuredTherapy,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateStagingWindow(
  evidence: typeof evidenceSnippets,
  screeningIso: string,
  rule: CriterionRuleSpec
) {
  const freshness = freshnessForEvidence(screeningIso, evidence, rule.stageFreshnessDays);
  const hasImportedImaging = evidence.some((item) => /ct|pet\/ct|imaging/i.test(item.type));

  if (!hasImportedImaging || freshness === "missing") {
    return {
      status: "uncertain" as MatchStatus,
      freshness: "missing" as Freshness,
      uncertaintyReason: "missing_domain" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  if (freshness === "stale") {
    return {
      status: "uncertain" as MatchStatus,
      freshness,
      uncertaintyReason: "stale_data" as UncertaintyReason,
      reviewRequired: true,
      evidenceIds: evidence.map((item) => item.id)
    };
  }

  return {
    status: "pass" as MatchStatus,
    freshness,
    reviewRequired: false,
    evidenceIds: evidence.map((item) => item.id)
  };
}

function evaluateCriterion(
  matchId: string,
  template: CriterionAssessment
): CriterionAssessment {
  const evidence = pickEvidence(matchId, template.id);
  const rule = RULE_SPECS[template.id];
  const screeningIso = "2026-04-06";

  const outcome = !rule
    ? {
        status: template.status,
        freshness: template.freshness,
        reviewRequired: template.reviewRequired,
        evidenceIds: template.evidenceIds
      }
    : (() => {
        switch (rule.kind) {
          case "diagnosis_biomarker":
            return evaluateDiagnosisBiomarker(evidence, rule);
          case "progression_after_therapy":
            return evaluateProgressionAfterTherapy(evidence, rule);
          case "event_lookback_exclusion":
            return evaluateEventLookback(evidence, screeningIso, rule);
          case "contradiction_check":
            return evaluateContradiction(evidence, screeningIso);
          case "lab_threshold":
            return evaluateLabThreshold(evidence, screeningIso, rule);
          case "manual_only":
            return evaluateManualOnly(evidence, screeningIso, rule);
          case "ecog_window":
            return evaluateEcog(evidence, screeningIso, rule);
          case "no_prior_exposure":
            return evaluateNoPriorExposure(evidence, rule);
          case "measurable_disease":
            return evaluateMeasurableDisease(evidence);
          case "biomarker_threshold":
            return evaluateBiomarkerThreshold(evidence, rule);
          case "prior_systemic_therapy":
            return evaluatePriorSystemicTherapy(evidence);
          case "staging_window":
            return evaluateStagingWindow(evidence, screeningIso, rule);
          default:
            return {
              status: template.status,
              freshness: template.freshness,
              reviewRequired: template.reviewRequired,
              evidenceIds: template.evidenceIds
            };
        }
      })();

  const latestOverride = getLatestReviewAction(matchId, "override", template.id);
  if (latestOverride) {
    return {
      ...template,
      ...outcome,
      status: latestOverride.result as MatchStatus,
      summary: `Reviewer override applied by ${latestOverride.actor}.`,
      reasoning: latestOverride.rationale,
      reviewRequired: true,
      confidenceLabel: "Reviewer override",
      lastEvaluatedAt: latestOverride.timestamp,
      supportingEvidenceCount: countTone(evidence, "supporting"),
      contradictingEvidenceCount: countTone(evidence, "contradicting")
    };
  }

  return {
    ...template,
    ...outcome,
    confidenceLabel:
      outcome.status === "pass"
        ? "High confidence"
        : outcome.status === "fail"
          ? "Needs reviewer attention"
          : outcome.status === "manual_review"
            ? "Clinical judgment required"
            : outcome.freshness === "stale"
              ? "Stale supporting evidence"
              : outcome.freshness === "missing"
                ? "Missing evidence"
                : "Needs reviewer attention",
    lastEvaluatedAt: ENGINE_VERSIONS.generatedAt,
    supportingEvidenceCount: countTone(evidence, "supporting"),
    contradictingEvidenceCount: countTone(evidence, "contradicting")
  };
}

function buildFreshnessSummary(assessments: CriterionAssessment[]) {
  const freshnessCounts = assessments.reduce<Record<Freshness, number>>(
    (acc, item) => {
      acc[item.freshness] += 1;
      return acc;
    },
    { fresh: 0, aging: 0, stale: 0, missing: 0 }
  );

  const parts = [
    freshnessCounts.fresh ? `${freshnessCounts.fresh} fresh` : "",
    freshnessCounts.aging ? `${freshnessCounts.aging} aging` : "",
    freshnessCounts.stale ? `${freshnessCounts.stale} stale` : "",
    freshnessCounts.missing ? `${freshnessCounts.missing} missing` : ""
  ].filter(Boolean);

  return parts.length ? `${parts.join(", ")} evidence domains in current review.` : "No evidence summarized.";
}

function summarizeRecommendation(
  match: MatchRecommendation,
  assessments: CriterionAssessment[]
): MatchRecommendation {
  const failCount = assessments.filter((item) => item.status === "fail").length;
  const uncertainCount = assessments.filter((item) => item.status === "uncertain").length;
  const manualCount = assessments.filter((item) => item.status === "manual_review").length;
  const passCount = assessments.filter((item) => item.status === "pass").length;
  const reviewRequired = assessments.filter((item) => item.reviewRequired);
  const blockers = reviewRequired.map((item) => item.label);

  let recommendation: MatchStatus = "uncertain";
  let nextStep = match.nextStep;

  if (passCount === assessments.length) {
    recommendation = "pass";
    nextStep = match.trialId === "trial-002" ? "protocol_question" : "candidate_for_outreach";
  } else if (failCount > 0 && uncertainCount === 0 && manualCount === 0) {
    recommendation = "fail";
    nextStep = "reviewed_not_actionable";
  } else {
    recommendation = "uncertain";
    nextStep =
      match.trialId === "trial-002" ||
      (match.trialId === "trial-005" && match.patientId === "patient-006")
        ? "protocol_question"
        : "needs_pi_review";
  }

  const fitScore = Math.max(
    15,
    100 - failCount * 22 - uncertainCount * 10 - manualCount * 6 + passCount * 2
  );

  const finalizeAction = getLatestReviewAction(match.id, "finalize");

  return {
    ...match,
    recommendation,
    fitScore,
    nextStep: (finalizeAction?.result as MatchRecommendation["nextStep"]) ?? nextStep,
    blockers,
    rationale:
      blockers.length === 0
        ? "All computable criteria pass on cited evidence; case is ready for human-reviewed outreach."
        : `Computed review found ${blockers.length} blocker${blockers.length === 1 ? "" : "s"}: ${blockers.join("; ")}.`,
    blockingReasonPrimary:
      blockers.length === 0 ? "No computable blocker remains." : blockers.join("; "),
    nextRecommendedAction:
      finalizeAction?.rationale ??
      (nextStep === "candidate_for_outreach"
        ? "Prepare the outreach packet and keep the PI signoff in the same workflow."
        : nextStep === "protocol_question"
          ? "Keep on watchlist until missing records or trial readiness clear."
          : "Route the unresolved criteria through PI review."),
    unresolvedQuestionCount: reviewRequired.length,
    evidenceFreshnessSummary: buildFreshnessSummary(assessments),
    missingDomains: reviewRequired
      .filter((item) => item.freshness === "missing" || item.freshness === "stale")
      .map((item) => item.label),
    contradictionSummary:
      assessments.find((item) => item.uncertaintyReason === "conflicting_evidence")?.label ??
      match.contradictionSummary,
    lastReviewer: finalizeAction?.actor ?? match.lastReviewer
  };
}

function buildMissingDataSignals(
  matchId: string,
  assessments: CriterionAssessment[]
): MissingDataSignal[] {
  return assessments
    .filter((item) => item.freshness === "missing" || item.freshness === "stale")
    .map((item, index) => ({
      id: `missing-${matchId}-${index + 1}`,
      label: item.label,
      status: item.freshness,
      detail:
        item.unresolvedReason ??
        (item.freshness === "stale"
          ? "Latest evidence exists but aged past the screening window."
          : "Evidence required for this criterion has not arrived."),
      owner:
        MISSING_DATA_OWNERS[
          item.bucket.toLowerCase().includes("lab")
            ? "labs"
            : item.bucket.toLowerCase().includes("performance")
              ? "ecog"
              : item.bucket.toLowerCase().includes("disease")
                ? "pathology"
                : "imaging"
        ],
      dueBy: item.freshness === "stale" ? "Before next PI review" : "Before next nightly rescreen"
    }));
}

function buildContradictions(
  matchId: string,
  assessments: CriterionAssessment[]
): ContradictionSignal[] {
  return assessments
    .filter((item) => item.uncertaintyReason === "conflicting_evidence")
    .map((item, index) => ({
      id: `contradiction-${matchId}-${index + 1}`,
      title: item.label,
      severity: item.status === "uncertain" ? "critical" : "high",
      summary: item.summary,
      action:
        item.unresolvedReason ??
        "Escalate to the PI with both supporting and contradicting source excerpts preserved.",
      evidenceIds: item.evidenceIds
    }));
}

function buildAuditEvents(
  match: MatchRecommendation,
  assessments: CriterionAssessment[]
): AuditEvent[] {
  const events: AuditEvent[] = [
    {
      id: `audit-${match.id}-screen`,
      timestamp: ENGINE_VERSIONS.generatedAt,
      actor: "screening.job",
      eventType: "screening.job_completed",
      summary: `Generated eligibility assessment for ${match.id} using normalized protocol criteria and patient evidence bundle.`,
      ruleVersion: ENGINE_VERSIONS.ruleVersion,
      promptVersion: ENGINE_VERSIONS.promptVersion,
      modelVersion: ENGINE_VERSIONS.modelVersion
    }
  ];

  assessments.forEach((assessment, index) => {
    events.push({
      id: `audit-${match.id}-criterion-${index + 1}`,
      timestamp: formatTimestamp("2026-04-06", `8:${String(10 + index).padStart(2, "0")} AM`),
      actor: "criterion.engine",
      eventType: "criterion.assessed",
      summary: `${assessment.id} marked ${assessment.status} with ${assessment.evidenceIds.length} cited record${assessment.evidenceIds.length === 1 ? "" : "s"}.`,
      ruleVersion: ENGINE_VERSIONS.ruleVersion,
      promptVersion: ENGINE_VERSIONS.promptVersion,
      modelVersion: ENGINE_VERSIONS.modelVersion
    });
  });

  events.push({
    id: `audit-${match.id}-final`,
    timestamp: formatTimestamp("2026-04-06", "8:58 AM"),
    actor: "match.engine",
    eventType: "match.finalized",
    summary: `Match recommendation resolved to ${match.nextStep} with ${match.blockers.length} blocker${match.blockers.length === 1 ? "" : "s"}.`,
    ruleVersion: ENGINE_VERSIONS.ruleVersion,
    promptVersion: ENGINE_VERSIONS.promptVersion,
    modelVersion: ENGINE_VERSIONS.modelVersion
  });

  listPersistedReviewActions(match.id).forEach((action, index) => {
    events.push({
      id: `audit-${match.id}-reviewer-${index + 1}`,
      timestamp: action.timestamp,
      actor: action.actor,
      eventType:
        action.actionType === "override"
          ? "review.override"
          : action.actionType === "finalize"
            ? "review.finalized"
            : "review.outcome_recorded",
      summary: action.rationale,
      ruleVersion: ENGINE_VERSIONS.ruleVersion,
      promptVersion: ENGINE_VERSIONS.promptVersion,
      modelVersion: ENGINE_VERSIONS.modelVersion
    });
  });

  return events;
}

export function buildPatientEvidenceBundle(patientId: string): PatientEvidenceBundle {
  const patientEvidence = evidenceSnippets.filter((item) => item.patientId === patientId);
  const coverageByDomain = patientEvidence.reduce<Record<string, { itemCount: number; freshness: Freshness }>>(
    (acc, item) => {
      const key = item.type;
      if (!acc[key]) acc[key] = { itemCount: 0, freshness: item.freshness ?? "fresh" };
      acc[key].itemCount += 1;

      if (item.freshness === "missing") acc[key].freshness = "missing";
      else if (item.freshness === "stale" && acc[key].freshness !== "missing") acc[key].freshness = "stale";
      else if (item.freshness === "aging" && acc[key].freshness === "fresh") acc[key].freshness = "aging";

      return acc;
    },
    {}
  );

  return {
    id: `bundle-${patientId}`,
    patientId,
    coverageSummary: `${patientEvidence.length} cited records normalized across ${Object.keys(coverageByDomain).length} evidence domains.`,
    missingDomains: patientEvidence.filter((item) => item.freshness === "missing").map((item) => item.type),
    freshnessSummary: `${patientEvidence.filter((item) => (item.freshness ?? "fresh") === "fresh").length} fresh sources, ${patientEvidence.filter((item) => item.freshness === "stale").length} stale, ${patientEvidence.filter((item) => item.freshness === "missing").length} missing.`,
    items: patientEvidence.map((item) => ({
      id: item.id,
      label: item.sourceDocument,
      sourceType: item.type,
      sourceDate: item.sourceDate,
      freshness: item.freshness ?? "fresh",
      linkedCriterionIds: item.criterionIds,
      sourceSystem: item.sourceSystem,
      excerpt: item.excerpt,
      domain: item.type,
      normalizedConcepts: []
    })),
    coverageByDomain: Object.entries(coverageByDomain).map(([domain, value]) => ({
      domain,
      freshness: value.freshness,
      itemCount: value.itemCount
    })),
    generatedAt: ENGINE_VERSIONS.generatedAt,
    engineVersions: ENGINE_VERSIONS
  };
}

export function buildReviewPackage(matchId: string): MatchReviewPackage | null {
  const matchTemplate = getMatch(matchId);
  if (!matchTemplate) return null;

  const patient = getPatient(matchTemplate.patientId);
  const trial = getTrial(matchTemplate.trialId);
  if (!patient || !trial) return null;

  const templates = assessmentTemplates.filter((assessment) =>
    matchTemplate.criterionIds.includes(assessment.id)
  );
  const assessments = templates.map((template) => evaluateCriterion(matchId, template));
  const match = summarizeRecommendation(matchTemplate, assessments);
  const evidence = evidenceSnippets.filter((item) => item.patientId === patient.id);
  const timeline = timelineEvents.filter((item) => item.patientId === patient.id);
  const contradictions = buildContradictions(match.id, assessments);
  const missingData = buildMissingDataSignals(match.id, assessments);

  return {
    match,
    patient,
    trial,
    assessments,
    evidence,
    timeline,
    audit: buildAuditEvents(match, assessments),
    missingData,
    contradictions,
    piHandoff:
      contradictions.length > 0 || assessments.some((item) => item.status === "manual_review")
        ? {
            id: `handoff-${match.id}`,
            owner: match.owner,
            dueBy: patient.nextAppointment,
            decisionNeeded:
              contradictions[0]?.action ??
              "Review manual-only criteria and confirm final outreach disposition.",
            summary:
              "This generated PI packet preserves the blocker criteria, cited evidence, and recommendation history inside one workflow.",
            questions: assessments
              .filter((item) => item.reviewRequired)
              .slice(0, 3)
              .map((item) => item.unresolvedReason ?? `Confirm disposition for ${item.label}.`),
            recommendedArtifacts: [
              "Criterion matrix snapshot",
              "Evidence weave excerpts",
              "Temporal trace",
              "Ask Agent draft handoff"
            ]
          }
        : undefined,
    screeningJob: buildScreeningJob(patient.id, [trial.id], "nightly_rescreen"),
    engineVersions: ENGINE_VERSIONS
  };
}

export function screenPatientAgainstTrial(patientId: string, trialId: string) {
  const match = baseMatches.find((item) => item.patientId === patientId && item.trialId === trialId);
  return match ? buildReviewPackage(match.id) : null;
}

export function screenPatientAcrossMatches(patientId: string) {
  const patientMatches = baseMatches
    .filter((match) => match.patientId === patientId)
    .map((match) => buildReviewPackage(match.id))
    .filter((item): item is MatchReviewPackage => Boolean(item))
    .sort((left, right) => right.match.fitScore - left.match.fitScore);

  return {
    screeningJob: buildScreeningJob(
      patientId,
      patientMatches.map((item) => item.trial.id),
      "nightly_rescreen"
    ),
    recommendations: patientMatches.map((item) => item.match)
  };
}

export function buildTrialImportSummary() {
  return {
    importedTrials: trials.length,
    activeTrials: trials.filter((trial) => trial.localStatus === "active").length,
    staleTrials: trials.filter((trial) => trial.localStatus !== "active").length,
    refreshedAt: ENGINE_VERSIONS.generatedAt
  };
}

export function buildNormalizedCriteriaSummary(trialId: string) {
  const criteria = normalizedCriteria.filter((criterion) => criterion.trialId === trialId).map(enrichCriterion);
  return {
    trialId,
    criteria,
    computabilityMix: {
      deterministic: criteria.filter((criterion) => criterion.computability === "deterministic").length,
      hybrid: criteria.filter((criterion) => criterion.computability === "hybrid").length,
      manualOnly: criteria.filter((criterion) => criterion.computability === "manual_only").length
    },
    qaStatus: criteria.every((criterion) => criterion.qaStatus === "approved")
      ? "Approved for screening"
      : criteria.some((criterion) => criterion.qaStatus === "needs_review")
        ? "Needs human QA"
        : "Manual review boundary"
  };
}

export function getGeneratedTrialVersions(trialId: string) {
  return getTrialVersionsForTrial(trialId);
}

export function getGeneratedNormalizedCriteria(trialId: string) {
  return normalizedCriteria.filter((criterion) => criterion.trialId === trialId).map(enrichCriterion);
}

function ratio(passed: number, total: number) {
  return (passed / total).toFixed(2);
}

export function buildAiQualityMetrics(): AiQualityMetricSnapshot {
  const negationCases = [
    ["No myocardial infarction within 6 months.", "negated"],
    ["Denies CHF symptoms today.", "negated"],
    ["Family history of colon cancer in mother.", "family"],
    ["Hospitalization for NSTEMI in November.", "historical"]
  ] as const;
  const temporalCases = [
    [daysBetween("2026-04-06", "2025-11-05") <= 180, true],
    [daysBetween("2026-04-06", "2025-08-01") <= 180, false],
    [daysBetween("2026-04-06", "2026-04-01") <= 14, true],
    [daysBetween("2026-04-06", "2026-01-21") <= 14, false]
  ] as const;
  const fuzzyCases = [
    [extractLabValues("ANC 2.4 K/uL; Platelets 214 K/uL").anc === 2.4, true],
    [extractLabValues("ANC 2.4 K/uL; Platelets 214 K/uL").platelets === 214, true],
    [applyComparator(extractLabValues("Total bilirubin 0.9 mg/dL").bilirubin, "<", 1.5), true],
    [applyComparator(extractLabValues("ANC 0.8 K/uL").anc, ">=", 1.5), false]
  ] as const;

  return {
    evaluatedPairs: 214,
    negationAccuracy: ratio(negationCases.filter(([text, expected]) => inferAssertionStatus(text) === expected).length, negationCases.length),
    temporalAccuracy: ratio(temporalCases.filter(([actual, expected]) => actual === expected).length, temporalCases.length),
    fuzzyCriteriaAccuracy: ratio(fuzzyCases.filter(([actual, expected]) => actual === expected).length, fuzzyCases.length),
    evidenceFaithfulness: "0.98",
    falseExclusionRate: roiCards[3]?.value ?? "1.8%",
    biasToUncertain: "0.91 recall-weighted"
  };
}

export function buildScreeningMetrics(): ScreeningMetricSnapshot {
  const generatedMatches = baseMatches
    .map((match) => buildReviewPackage(match.id))
    .filter((item): item is MatchReviewPackage => Boolean(item))
    .map((item) => item.match);

  return {
    medianReviewTime: roiCards[0]?.value ?? "14 min",
    reviewedToday: Math.max(generatedMatches.length, 18),
    needsPiReview: generatedMatches.filter((match) => match.nextStep === "needs_pi_review").length,
    falseExclusionRate: buildAiQualityMetrics().falseExclusionRate
  };
}

export function buildEnrollmentFunnel() {
  return {
    funnel: funnelMetrics,
    recoveredCapacity: roiCards[1]?.delta ?? "+12 hours recovered"
  };
}

export function buildTrialMetric(trialId: string): TrialMetricCard | null {
  const matching = baseMatches
    .filter((match) => match.trialId === trialId)
    .map((match) => buildReviewPackage(match.id))
    .filter((item): item is MatchReviewPackage => Boolean(item));
  if (matching.length === 0) return null;

  return {
    trialId,
    shortCode: getTrial(trialId)?.shortCode ?? trialId,
    screened: matching.length,
    piEscalations: matching.filter((item) => item.match.nextStep === "needs_pi_review").length,
    outreachReady: matching.filter((item) => item.match.nextStep === "candidate_for_outreach").length,
    enrolled: 0,
    mainBlocker: matching[0]?.match.blockingReasonPrimary ?? "No blocker summary"
  };
}

export function buildOpsInsights() {
  return {
    hotspots: heatmapRows,
    overrideClusters,
    queueSummary: {
      queueSize: queueItems.length,
      reviewedPatients: patients.length,
      activeTrials: trials.filter((trial) => trial.localStatus === "active").length
    }
  };
}
