import type { EvaluationEvidence } from "../ai/prompts/evaluateCriterion.ts";
import {
  getNormalizedCriteriaForTrial,
  getPatient,
} from "../../data/mockData.ts";
import { getImportedTrialByTrialId } from "../../stores/importedTrials.ts";
import { getClinicalRecordByPatientId } from "../../stores/patientCatalog.ts";
import { daysBetween, todayIso } from "../temporal/dateMath.ts";
import type {
  CompiledCriterionRule,
  CompiledThreshold,
  CriterionAssessment,
  Freshness,
  MatchStatus,
  NormalizedCriterion,
  PatientClinicalRecord,
  PatientEvidenceBundle,
  PatientEvidenceItem,
  TemporalConstraint,
  ImportedTrialProjection,
  UncertaintyReason,
} from "../../types/index.ts";

type ThresholdComparator = CompiledThreshold["comparator"];
type EvaluationMode = "deterministic" | "needs_ai_fallback" | "manual_review";

interface ScreeningPreparationOptions {
  customRecordText?: string | null;
  screeningDate?: string;
}

interface ScreeningPreparation {
  screeningDate: string;
  patientEvidenceBundle: PatientEvidenceBundle;
  criteria: NormalizedCriterion[];
  aiEvidence: EvaluationEvidence[];
  /** Dynamic corpus built from the patient evidence bundle for hybrid retrieval. */
  dynamicCorpus?: import("../retrieval/evidenceCorpus.ts").EvidenceNote[];
}

interface DeterministicCriterionResult {
  mode: EvaluationMode;
  status: MatchStatus;
  freshness: Freshness;
  reasoning: string;
  reviewRequired: boolean;
  evidenceIds: string[];
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
  uncertaintyReason?: UncertaintyReason;
}

export interface TrialAutomationReadiness {
  label: "Screenable" | "Partial automation" | "Manual-review heavy";
  detail: string;
  deterministicCount: number;
  hybridCount: number;
  manualCount: number;
  compiledCount: number;
  totalCount: number;
}

const DIAGNOSIS_ALIAS_LIBRARY: string[][] = [
  ["non-small cell lung", "nsclc", "pulmonary adenocarcinoma", "lung adenocarcinoma"],
  ["cholangiocarcinoma", "biliary", "bile duct"],
  ["triple-negative", "tnbc", "er 0%", "pr 0%", "her2 0"],
  ["endometrial", "endometrioid"],
  ["melanoma", "cutaneous melanoma"],
  ["bladder cancer", "urothelial"],
  ["multiple myeloma", "myeloma"],
  ["metastatic", "stage iv", "recurrent", "unresectable", "advanced"],
];

const BIOMARKER_ALIAS_LIBRARY: string[][] = [
  ["egfr exon 20", "egfr exon20", "egfr ex20ins", "egfr exon20 insertion"],
  ["fgfr2", "fgfr2 fusion", "fgfr2-bicc1"],
  ["msi-high", "msi high", "microsatellite instability-high"],
  ["mmr-deficient", "mismatch repair deficient", "mlh1 loss", "pms2 loss"],
  ["pd-l1", "pdl1", "pd-l1 cps", "pd-l1 tps"],
  ["her2", "her-2"],
  ["braf", "braf v600e"],
  ["alk"],
  ["ros1"],
  ["ntrk"],
  ["brca1", "brca2", "brca"],
];

const THERAPY_ALIAS_LIBRARY: string[][] = [
  ["platinum", "carboplatin", "cisplatin"],
  ["pemetrexed"],
  ["pd-1", "pd-l1", "checkpoint inhibitor", "immunotherapy"],
  ["fgfr inhibitor", "fgfr-directed"],
  ["prior systemic therapy", "systemic therapy"],
  ["chemotherapy", "cytotoxic therapy"],
];

const EVENT_ALIAS_LIBRARY: string[][] = [
  ["myocardial infarction", "nstemi", "stemi", "mi"],
  ["congestive heart failure", "chf", "heart failure"],
  ["stroke", "cva", "cerebrovascular accident"],
  ["pulmonary embolism", "pe"],
];

const FIELD_ALIASES: Record<CompiledThreshold["field"], string[]> = {
  age: ["age", "years"],
  anc: ["anc", "absolute neutrophil count"],
  platelets: ["platelets", "plt", "platelet count"],
  hemoglobin: ["hemoglobin", "hgb"],
  bilirubin: ["bilirubin", "total bilirubin"],
  ast: ["ast"],
  alt: ["alt"],
  alp: ["alp", "alkaline phosphatase", "alk phos"],
  creatinine: ["creatinine", "creatinine clearance", "crcl"],
  ecog: ["ecog", "performance status"],
};

function normalizeText(value: string) {
  return value.toLowerCase();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDateLike(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return fallback;
}

function freshnessFromAge(ageDays: number) {
  if (ageDays <= 14) return "fresh" as Freshness;
  if (ageDays <= 45) return "aging" as Freshness;
  return "stale" as Freshness;
}

function inferAssertionStatus(text: string) {
  const lower = normalizeText(text);

  if (/family history|mother|father|sister|brother/.test(lower)) {
    return "family" as const;
  }

  if (/rule out|possible|possibly|indeterminate|cannot rule out|suspicious for|concern for/.test(lower)) {
    return "possible" as const;
  }

  if (/\bno\b|\bdenies\b|\bwithout\b|negative for|not consistent with|not identified|no evidence of/.test(lower)) {
    return "negated" as const;
  }

  if (/history of|status post|prior |recovered from|previously treated/.test(lower)) {
    return "historical" as const;
  }

  return "present" as const;
}

function inferExperiencer(text: string) {
  const status = inferAssertionStatus(text);
  if (status === "family") return "family" as const;
  if (status === "possible") return "possible" as const;
  return "patient" as const;
}

function findMatchedAliasGroups(
  text: string,
  library: string[][],
): string[][] {
  const lower = normalizeText(text);
  return library.filter((group) =>
    group.some((alias) => lower.includes(alias)),
  );
}

function containsAliasGroups(text: string, groups: string[][] = []) {
  const lower = normalizeText(text);
  return groups.every((group) =>
    group.some((alias) => lower.includes(alias)),
  );
}

function extractNormalizedConcepts(text: string) {
  const concepts = [
    ...findMatchedAliasGroups(text, DIAGNOSIS_ALIAS_LIBRARY).flat(),
    ...findMatchedAliasGroups(text, BIOMARKER_ALIAS_LIBRARY).flat(),
    ...findMatchedAliasGroups(text, THERAPY_ALIAS_LIBRARY).flat(),
    ...findMatchedAliasGroups(text, EVENT_ALIAS_LIBRARY).flat(),
  ];
  return Array.from(new Set(concepts.map((value) => value.toLowerCase())));
}

function latestNoteDate(record: PatientClinicalRecord | undefined, fallback: string) {
  if (!record || record.notes.length === 0) {
    return fallback;
  }

  return [...record.notes]
    .map((note) => normalizeDateLike(note.date, fallback))
    .sort()
    .at(-1) ?? fallback;
}

export function buildPatientEvidenceBundle(
  patientId: string,
  options: ScreeningPreparationOptions = {},
): PatientEvidenceBundle {
  const screeningDate = options.screeningDate ?? todayIso();
  const patient = getPatient(patientId);
  const clinicalRecord = options.customRecordText
    ? undefined
    : getClinicalRecordByPatientId(patientId);

  const items: PatientEvidenceItem[] = [];

  if (options.customRecordText) {
    const excerpt = options.customRecordText.slice(0, 4000);
    items.push({
      id: `${patientId}-uploaded-record`,
      label: "Uploaded patient record",
      sourceType: "uploaded_record",
      sourceDate: screeningDate,
      freshness: "fresh",
      linkedCriterionIds: [],
      sourceSystem: "Manual upload",
      excerpt,
      domain: "uploaded_record",
      normalizedConcepts: extractNormalizedConcepts(excerpt),
      assertionStatus: inferAssertionStatus(excerpt),
      experiencer: inferExperiencer(excerpt),
      temporalDate: screeningDate,
    });
  } else if (clinicalRecord) {
    if (clinicalRecord.demographics.age != null) {
      items.push({
        id: `${patientId}-age`,
        label: "Patient age",
        sourceType: "demographics_age",
        sourceDate: screeningDate,
        freshness: "fresh",
        linkedCriterionIds: [],
        sourceSystem: "Patient summary",
        excerpt: `${clinicalRecord.demographics.age} years old`,
        domain: "demographics",
        normalizedConcepts: ["age"],
        assertionStatus: "present",
        experiencer: "patient",
        temporalDate: screeningDate,
        numericValue: clinicalRecord.demographics.age,
        unit: "years",
      });
    }

    items.push({
      id: `${patientId}-sex`,
      label: "Patient sex",
      sourceType: "demographics_sex",
      sourceDate: screeningDate,
      freshness: "fresh",
      linkedCriterionIds: [],
      sourceSystem: "Patient summary",
      excerpt: clinicalRecord.demographics.sex,
      domain: "demographics",
      normalizedConcepts: [normalizeText(clinicalRecord.demographics.sex)],
      assertionStatus: "present",
      experiencer: "patient",
      temporalDate: screeningDate,
    });

    items.push({
      id: `${patientId}-diagnosis-summary`,
      label: "Diagnosis summary",
      sourceType: "diagnosis_summary",
      sourceDate: screeningDate,
      freshness: "fresh",
      linkedCriterionIds: [],
      sourceSystem: "Patient summary",
      excerpt: normalizeWhitespace(
        [
          patient?.diagnosis,
          patient?.stage,
          patient?.diseaseArea,
          patient?.biomarkers.join(", "),
        ]
          .filter(Boolean)
          .join(" | "),
      ),
      domain: "diagnosis",
      normalizedConcepts: extractNormalizedConcepts(
        [
          patient?.diagnosis,
          patient?.stage,
          patient?.diseaseArea,
          patient?.biomarkers.join(" "),
        ]
          .filter(Boolean)
          .join(" "),
      ),
      assertionStatus: "present",
      experiencer: "patient",
      temporalDate: screeningDate,
    });

    if (clinicalRecord.ecogPerformanceStatus != null) {
      const latestEcogDate = latestNoteDate(clinicalRecord, screeningDate);
      items.push({
        id: `${patientId}-ecog`,
        label: "ECOG performance status",
        sourceType: "ecog_summary",
        sourceDate: latestEcogDate,
        freshness: freshnessFromAge(
          daysBetween(screeningDate, latestEcogDate),
        ),
        linkedCriterionIds: [],
        sourceSystem: "Patient summary",
        excerpt: `ECOG ${clinicalRecord.ecogPerformanceStatus}`,
        domain: "performance_status",
        normalizedConcepts: ["ecog", "performance status"],
        assertionStatus: "present",
        experiencer: "patient",
        temporalDate: latestEcogDate,
        numericValue: clinicalRecord.ecogPerformanceStatus,
        unit: "score",
      });
    }

    clinicalRecord.problemList.forEach((problem, index) => {
      const sourceDate = normalizeDateLike(problem.onset, screeningDate);
      items.push({
        id: `${patientId}-problem-${index + 1}`,
        label: problem.description,
        sourceType: "problem_list",
        sourceDate,
        freshness: freshnessFromAge(daysBetween(screeningDate, sourceDate)),
        linkedCriterionIds: [],
        sourceSystem: "Problem list",
        excerpt: `${problem.code}: ${problem.description}`,
        domain: "problem_list",
        normalizedConcepts: extractNormalizedConcepts(problem.description),
        assertionStatus: inferAssertionStatus(problem.description),
        experiencer: inferExperiencer(problem.description),
        temporalDate: sourceDate,
      });
    });

    clinicalRecord.labs.forEach((lab, index) => {
      const sourceDate = normalizeDateLike(lab.date, screeningDate);
      const numericValue = Number.parseFloat(
        lab.value.replace(/,/g, "").replace(/</g, ""),
      );

      items.push({
        id: `${patientId}-lab-${index + 1}`,
        label: lab.test,
        sourceType: "lab",
        sourceDate,
        freshness: freshnessFromAge(daysBetween(screeningDate, sourceDate)),
        linkedCriterionIds: [],
        sourceSystem: "Laboratory results",
        excerpt: `${lab.test}: ${lab.value} ${lab.unit} (ref ${lab.referenceRange})`,
        domain: "labs",
        normalizedConcepts: [normalizeText(lab.test)],
        assertionStatus: "present",
        experiencer: "patient",
        temporalDate: sourceDate,
        numericValue: Number.isNaN(numericValue) ? undefined : numericValue,
        unit: lab.unit,
        referenceRange: lab.referenceRange,
      });
    });

    clinicalRecord.medications.forEach((medication, index) => {
      const sourceDate = normalizeDateLike(
        medication.endDate ?? medication.startDate,
        screeningDate,
      );
      const excerpt = `${medication.name} (${medication.route}, ${medication.status}) ${medication.startDate}${medication.endDate ? ` to ${medication.endDate}` : ""} ${medication.indication ?? ""}`;
      items.push({
        id: `${patientId}-med-${index + 1}`,
        label: medication.name,
        sourceType: "medication_history",
        sourceDate,
        freshness: freshnessFromAge(daysBetween(screeningDate, sourceDate)),
        linkedCriterionIds: [],
        sourceSystem: "Medication history",
        excerpt,
        domain: "medications",
        normalizedConcepts: extractNormalizedConcepts(excerpt),
        assertionStatus: inferAssertionStatus(excerpt),
        experiencer: "patient",
        temporalDate: sourceDate,
      });
    });

    clinicalRecord.notes.forEach((note, index) => {
      const sourceDate = normalizeDateLike(note.date, screeningDate);
      items.push({
        id: `${patientId}-note-${index + 1}`,
        label: note.title,
        sourceType: note.type,
        sourceDate,
        freshness: freshnessFromAge(daysBetween(screeningDate, sourceDate)),
        linkedCriterionIds: [],
        sourceSystem: note.author,
        excerpt: note.text,
        domain: note.type,
        normalizedConcepts: extractNormalizedConcepts(note.text),
        assertionStatus: inferAssertionStatus(note.text),
        experiencer: inferExperiencer(note.text),
        temporalDate: sourceDate,
      });
    });
  }

  const coverageMap = items.reduce<
    Record<string, { itemCount: number; freshness: Freshness }>
  >((acc, item) => {
    const domain = item.domain ?? item.sourceType;
    if (!acc[domain]) {
      acc[domain] = { itemCount: 0, freshness: item.freshness };
    }
    acc[domain].itemCount += 1;
    if (item.freshness === "missing") acc[domain].freshness = "missing";
    else if (
      item.freshness === "stale" &&
      acc[domain].freshness !== "missing"
    ) {
      acc[domain].freshness = "stale";
    } else if (
      item.freshness === "aging" &&
      acc[domain].freshness === "fresh"
    ) {
      acc[domain].freshness = "aging";
    }
    return acc;
  }, {});

  const coverageByDomain = Object.entries(coverageMap).map(([domain, value]) => ({
    domain,
    freshness: value.freshness,
    itemCount: value.itemCount,
  }));

  const missingDomains =
    items.length === 0
      ? ["clinical_record"]
      : coverageByDomain
          .filter((item) => item.freshness === "missing")
          .map((item) => item.domain);

  const freshnessSummary = coverageByDomain.length
    ? coverageByDomain
        .map((item) => `${item.domain}: ${item.freshness}`)
        .join(" | ")
    : "No evidence bundle generated.";

  return {
    id: `bundle-${patientId}`,
    patientId,
    coverageSummary: `${items.length} evidence items normalized across ${coverageByDomain.length} domains.`,
    missingDomains,
    freshnessSummary,
    items,
    coverageByDomain,
    generatedAt: new Date().toISOString(),
  };
}

export function toEvaluationEvidence(
  bundle: PatientEvidenceBundle,
): EvaluationEvidence[] {
  return bundle.items.slice(0, 24).map((item) => ({
    evidenceId: item.id,
    source: `${item.sourceType} — ${item.label}`,
    sourceDate: item.sourceDate,
    excerpt: item.excerpt ?? item.label,
  }));
}

function parseComparator(raw: string | undefined): ThresholdComparator {
  const value = raw?.trim().toLowerCase() ?? "";
  if (value === ">" || value === "greater than" || value === "more than") {
    return ">";
  }
  if (
    value === "<" ||
    value === "less than" ||
    value === "under" ||
    value === "below"
  ) {
    return "<";
  }
  if (
    value === "<=" ||
    value === "≤" ||
    value === "less than or equal to" ||
    value === "no more than"
  ) {
    return "<=";
  }
  return ">=";
}

function parseTemporalConstraint(
  text: string,
  kind: CompiledCriterionRule["kind"],
): TemporalConstraint | undefined {
  const lower = normalizeText(text);
  const match = lower.match(
    /within\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)|(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+before/,
  );

  if (kind === "prior_therapy_progression") {
    return {
      anchor: "prior_therapy",
      comparisonType: "after_progression",
    };
  }

  if (!match) {
    return undefined;
  }

  const count = Number.parseInt(match[1] ?? match[3] ?? "0", 10);
  const unit = match[2] ?? match[4] ?? "days";
  const multiplier =
    unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30 : unit.startsWith("year") ? 365 : 1;
  const totalDays = count * multiplier;

  if (kind === "event_lookback_exclusion") {
    return {
      anchor: "screening_date",
      comparisonType: "lookback_exclusion",
      lookbackDays: totalDays,
    };
  }

  if (kind === "lab_threshold" || kind === "ecog_max") {
    return {
      anchor: kind === "ecog_max" ? "ecog_assessment" : "latest_lab",
      comparisonType: "freshness_window",
      freshnessDays: totalDays,
    };
  }

  return {
    anchor: "screening_date",
    comparisonType: "none",
  };
}

function normalizeThresholdUnit(unit: string | undefined) {
  return normalizeText(unit ?? "")
    .replace(/\s+/g, "")
    .replace(/μ/g, "u");
}

function maybeNormalizeThresholdValue(
  field: CompiledThreshold["field"],
  value: number,
  unit: string | undefined,
) {
  const normalizedUnit = normalizeThresholdUnit(unit);
  if (field === "anc" && normalizedUnit.includes("/mm3") && value >= 100) {
    return value / 1000;
  }
  if (field === "platelets" && normalizedUnit.includes("/mm3") && value >= 1000) {
    return value / 1000;
  }
  return value;
}

function extractNumericThresholds(text: string) {
  const lower = normalizeText(text);
  const thresholds: CompiledThreshold[] = [];

  const fieldEntries = (
    Object.entries(FIELD_ALIASES) as Array<
      [CompiledThreshold["field"], string[]]
    >
  ).filter(([field]) => !["age", "ecog"].includes(field));

  fieldEntries.forEach(([field, aliases]) => {
    const aliasPattern = aliases
      .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const regex = new RegExp(
      `(?:${aliasPattern})[^.;\\n]{0,40}?(>=|<=|>|<|≥|≤|at least|less than or equal to|greater than or equal to|less than|greater than|no more than)?\\s*(\\d+(?:\\.\\d+)?)\\s*(x\\s*uln|xuln|mg\\/dl|g\\/dl|k\\/[uµ]l|\\/[uµ]l|\\/mm3|ml\\/min)?`,
      "i",
    );
    const match = regex.exec(lower);
    if (!match) {
      return;
    }

    const comparator = parseComparator(match[1]);
    const rawValue = Number.parseFloat(match[2]);
    if (Number.isNaN(rawValue)) {
      return;
    }
    const unit = match[3]?.replace(/\s+/g, " ").trim();

    thresholds.push({
      field,
      comparator,
      value: maybeNormalizeThresholdValue(field, rawValue, unit),
      unit,
    });
  });

  return thresholds;
}

function extractAgeBounds(text: string) {
  const lower = normalizeText(text);
  const minimumMatch =
    /minimum age[^0-9]{0,10}(\d+)/i.exec(lower) ??
    /age[^0-9]{0,10}(>=|at least|greater than or equal to)\s*(\d+)/i.exec(lower);
  const maximumMatch =
    /maximum age[^0-9]{0,10}(\d+)/i.exec(lower) ??
    /age[^0-9]{0,10}(<=|no more than|less than or equal to)\s*(\d+)/i.exec(lower);

  return {
    minimumAgeYears: minimumMatch
      ? Number.parseInt(minimumMatch[2] ?? minimumMatch[1], 10)
      : undefined,
    maximumAgeYears: maximumMatch
      ? Number.parseInt(maximumMatch[2] ?? maximumMatch[1], 10)
      : undefined,
  };
}

function extractEcogMax(text: string) {
  const rangeMatch = /ecog[^0-9]{0,10}(\d)\s*[-–]\s*(\d)/i.exec(text);
  if (rangeMatch) {
    return Math.max(Number.parseInt(rangeMatch[1], 10), Number.parseInt(rangeMatch[2], 10));
  }

  const comparatorMatch =
    /ecog[^0-9]{0,10}(<=|<|≤|at most|no more than)?\s*(\d)/i.exec(text) ??
    /performance status[^0-9]{0,10}(<=|<|≤|at most|no more than)?\s*(\d)/i.exec(text);

  return comparatorMatch ? Number.parseInt(comparatorMatch[2], 10) : undefined;
}

function extractSex(text: string) {
  const lower = normalizeText(text);
  if (/eligible sex:\s*female|female only|women only/.test(lower)) {
    return "female";
  }
  if (/eligible sex:\s*male|male only|men only/.test(lower)) {
    return "male";
  }
  return undefined;
}

function inferCompiledRule(
  criterion: NormalizedCriterion,
): CompiledCriterionRule {
  if (criterion.compiledRule) {
    return criterion.compiledRule;
  }

  const sourceText = normalizeWhitespace(
    `${criterion.label} ${criterion.threshold} ${criterion.note}`,
  );
  const lower = normalizeText(sourceText);
  const diagnosisAliases = findMatchedAliasGroups(sourceText, DIAGNOSIS_ALIAS_LIBRARY);
  const biomarkerAliases = findMatchedAliasGroups(sourceText, BIOMARKER_ALIAS_LIBRARY);
  const therapyAliases = findMatchedAliasGroups(sourceText, THERAPY_ALIAS_LIBRARY);
  const eventAliases = findMatchedAliasGroups(sourceText, EVENT_ALIAS_LIBRARY).flat();
  const ageBounds = extractAgeBounds(sourceText);
  const ecogMax = extractEcogMax(sourceText);
  const thresholds = extractNumericThresholds(sourceText);

  if (ageBounds.minimumAgeYears != null || ageBounds.maximumAgeYears != null) {
    return {
      kind: "age_range",
      minimumAgeYears: ageBounds.minimumAgeYears,
      maximumAgeYears: ageBounds.maximumAgeYears,
    };
  }

  const sex = extractSex(sourceText);
  if (sex) {
    return {
      kind: "sex_match",
      sex,
    };
  }

  if (
    eventAliases.length > 0 &&
    /within|before|lookback|history/i.test(sourceText)
  ) {
    return {
      kind: "event_lookback_exclusion",
      eventAliases,
      temporalConstraint: parseTemporalConstraint(
        sourceText,
        "event_lookback_exclusion",
      ),
    };
  }

  if (thresholds.length > 0) {
    return {
      kind: "lab_threshold",
      thresholds,
      temporalConstraint: parseTemporalConstraint(sourceText, "lab_threshold"),
    };
  }

  if (ecogMax != null) {
    return {
      kind: "ecog_max",
      ecogMax,
      temporalConstraint: parseTemporalConstraint(sourceText, "ecog_max"),
    };
  }

  if (
    /must not have received|no prior|prior exposure not allowed|naive to|no previous/i.test(
      lower,
    ) &&
    therapyAliases.length > 0
  ) {
    return {
      kind: "no_prior_exposure",
      therapyAliases,
    };
  }

  if (
    /progression|progressed|failed/i.test(lower) &&
    therapyAliases.length > 0
  ) {
    return {
      kind: "prior_therapy_progression",
      therapyAliases,
      temporalConstraint: parseTemporalConstraint(
        sourceText,
        "prior_therapy_progression",
      ),
    };
  }

  if (biomarkerAliases.length > 0) {
    return {
      kind: "biomarker_presence",
      biomarkerAliases,
    };
  }

  if (diagnosisAliases.length > 0) {
    return {
      kind: "diagnosis_match",
      diagnosisAliases,
    };
  }

  return {
    kind: "manual_review",
    temporalConstraint: parseTemporalConstraint(sourceText, "manual_review"),
  };
}

function inferNormalizationConfidence(
  criterion: NormalizedCriterion,
  rule: CompiledCriterionRule,
): "high" | "medium" | "low" {
  if (
    ["age_range", "sex_match", "lab_threshold", "ecog_max", "event_lookback_exclusion"].includes(
      rule.kind,
    )
  ) {
    return "high";
  }
  if (
    ["diagnosis_match", "biomarker_presence", "prior_therapy_progression", "no_prior_exposure"].includes(
      rule.kind,
    )
  ) {
    return criterion.computability === "manual_only" ? "low" : "medium";
  }
  return "low";
}

function inferAssertionSensitive(rule: CompiledCriterionRule) {
  return [
    "diagnosis_match",
    "event_lookback_exclusion",
    "no_prior_exposure",
    "prior_therapy_progression",
    "biomarker_presence",
  ].includes(rule.kind);
}

function hasUsableCompiledRule(criterion: NormalizedCriterion) {
  const rule = criterion.compiledRule;
  if (!rule || !criterion.ruleKind || !criterion.normalizationConfidence) {
    return false;
  }

  const hasSpecificAliases = (groups?: string[][]) =>
    Boolean(
      groups?.some((group) =>
        group.some(
          (alias) =>
            ![
              "disease",
              "therapy",
              "lab",
              "temporal",
              "biomarker",
              "manual_review",
              "performance_status",
              "therapy_history",
            ].includes(alias),
        ),
      ),
    );

  if (
    ["diagnosis_match", "biomarker_presence", "no_prior_exposure", "prior_therapy_progression"].includes(
      rule.kind,
    )
  ) {
    return Boolean(
      hasSpecificAliases(rule.diagnosisAliases) ||
        hasSpecificAliases(rule.biomarkerAliases) ||
        hasSpecificAliases(rule.therapyAliases),
    );
  }

  if (rule.kind === "event_lookback_exclusion") {
    return (rule.eventAliases?.length ?? 0) > 0;
  }

  if (rule.kind === "lab_threshold") {
    return (rule.thresholds?.length ?? 0) > 0;
  }

  return true;
}

export function compileCriterionForScreening(
  criterion: NormalizedCriterion,
): NormalizedCriterion {
  if (hasUsableCompiledRule(criterion)) {
    return criterion;
  }

  const compiledRule = inferCompiledRule(criterion);
  return {
    ...criterion,
    compiledRule,
    ruleKind: criterion.ruleKind ?? compiledRule.kind,
    assertionSensitive:
      criterion.assertionSensitive ?? inferAssertionSensitive(compiledRule),
    normalizationConfidence:
      criterion.normalizationConfidence ??
      inferNormalizationConfidence(criterion, compiledRule),
    temporalAnchor:
      criterion.temporalAnchor ??
      compiledRule.temporalConstraint?.anchor,
    temporalWindow:
      criterion.temporalWindow ??
      (compiledRule.temporalConstraint?.lookbackDays
        ? `${compiledRule.temporalConstraint.lookbackDays} days`
        : compiledRule.temporalConstraint?.freshnessDays
          ? `${compiledRule.temporalConstraint.freshnessDays} days`
          : undefined),
  };
}

export function summarizeTrialAutomationReadiness(
  criteria: NormalizedCriterion[],
  importedProjection?: Pick<
    ImportedTrialProjection,
    "screeningIntent" | "automationBlockerReason"
  > | null,
): TrialAutomationReadiness {
  const compiled = criteria.map(compileCriterionForScreening);
  const readinessCriteria = compiled.filter(
    (criterion) => criterion.countsTowardAutomationReadiness !== false,
  );
  const criteriaForScoring = readinessCriteria.length > 0 ? readinessCriteria : compiled;
  const deterministicCount = criteriaForScoring.filter(
    (criterion) =>
      criterion.computability === "deterministic" &&
      criterion.compiledRule?.kind !== "manual_review",
  ).length;
  const hybridCount = criteriaForScoring.filter(
    (criterion) =>
      criterion.computability === "hybrid" &&
      criterion.compiledRule?.kind !== "manual_review",
  ).length;
  const manualCount = criteriaForScoring.filter(
    (criterion) =>
      criterion.computability === "manual_only" ||
      criterion.compiledRule?.kind === "manual_review",
  ).length;
  const compiledCount = criteriaForScoring.filter(
    (criterion) => criterion.compiledRule?.kind !== "manual_review",
  ).length;

  let label: TrialAutomationReadiness["label"] = "Manual-review heavy";
  if (
    importedProjection?.screeningIntent === "retrospective_manual_only"
  ) {
    return {
      label,
      detail:
        importedProjection.automationBlockerReason ??
        "Retrospective observational cohort retained for onboarding only; it is not a normal automated prescreening candidate.",
      deterministicCount,
      hybridCount,
      manualCount,
      compiledCount,
      totalCount: criteriaForScoring.length,
    };
  }

  if (
    criteriaForScoring.length > 0 &&
    compiledCount / criteriaForScoring.length >= 0.75 &&
    manualCount <= 1
  ) {
    label = "Screenable";
  } else if (
    criteriaForScoring.length > 0 &&
    compiledCount / criteriaForScoring.length >= 0.35
  ) {
    label = "Partial automation";
  }

  const detail =
    readinessCriteria.length === 0
      ? "No clinically screenable registry criteria were compiled; remaining items are onboarding context or manual-review boundaries."
      : `${deterministicCount} deterministic | ${hybridCount} hybrid | ${manualCount} manual-review`;

  return {
    label,
    detail,
    deterministicCount,
    hybridCount,
    manualCount,
    compiledCount,
    totalCount: criteriaForScoring.length,
  };
}

export function prepareScreeningContext(
  patientId: string,
  trialId: string,
  options: ScreeningPreparationOptions = {},
): ScreeningPreparation {
  const screeningDate = options.screeningDate ?? todayIso();
  const patientEvidenceBundle = buildPatientEvidenceBundle(patientId, {
    ...options,
    screeningDate,
  });
  const criteria = getNormalizedCriteriaForTrial(trialId).map(
    compileCriterionForScreening,
  );

  // Item 9: build dynamic corpus from the evidence bundle so the hybrid
  // retrieval pipeline can search over uploaded patient data.
  let dynamicCorpus: import("../retrieval/evidenceCorpus.ts").EvidenceNote[] | undefined;
  try {
    // Lazy import to avoid circular dependency — bundleToEvidenceNotes is
    // a leaf function that only needs the bundle type.
    const { bundleToEvidenceNotes } = require("../retrieval/evidenceCorpus.ts");
    dynamicCorpus = bundleToEvidenceNotes(patientEvidenceBundle, patientId);
  } catch {
    // If import fails (e.g., SSR / test environment), omit dynamic corpus.
    dynamicCorpus = undefined;
  }

  return {
    screeningDate,
    patientEvidenceBundle,
    criteria,
    aiEvidence: toEvaluationEvidence(patientEvidenceBundle),
    dynamicCorpus,
  };
}

function applyComparator(
  value: number,
  comparator: ThresholdComparator,
  threshold: number,
  opts?: { field?: string; relativeToULN?: number },
) {
  // Item 7: resolve "× ULN" thresholds into absolute values before comparison.
  let effectiveThreshold = threshold;
  if (opts?.relativeToULN && opts.field) {
    const { resolveUlnThreshold } = require("../units/ulnTable.ts");
    const resolved = resolveUlnThreshold(opts.field, opts.relativeToULN);
    if (resolved) effectiveThreshold = resolved.absoluteValue;
  }
  if (comparator === ">=") return value >= effectiveThreshold;
  if (comparator === "<=") return value <= effectiveThreshold;
  if (comparator === "<") return value < effectiveThreshold;
  return value > effectiveThreshold;
}

function parseUpperBound(referenceRange: string | undefined) {
  if (!referenceRange) {
    return undefined;
  }

  const matches = referenceRange.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) {
    return undefined;
  }

  const upper = Number.parseFloat(matches[matches.length - 1]);
  return Number.isNaN(upper) ? undefined : upper;
}

function normalizeLabValueForThreshold(
  item: PatientEvidenceItem,
  threshold: CompiledThreshold,
) {
  if (item.numericValue == null) {
    return undefined;
  }

  const value = item.numericValue;
  const itemUnit = normalizeThresholdUnit(item.unit);
  const thresholdUnit = normalizeThresholdUnit(threshold.unit);

  if (threshold.field === "anc") {
    if (thresholdUnit.includes("k/ul") || thresholdUnit.includes("x10^9/l")) {
      return itemUnit.includes("/ul") ? value / 1000 : value;
    }
    if (thresholdUnit.includes("/mm3")) {
      return itemUnit.includes("k/ul") ? value * 1000 : value;
    }
    return value;
  }

  if (threshold.field === "platelets") {
    if (thresholdUnit.includes("k/ul")) {
      return itemUnit.includes("k/ul") ? value : value / 1000;
    }
    if (thresholdUnit.includes("/mm3")) {
      return itemUnit.includes("k/ul") ? value * 1000 : value;
    }
    return value;
  }

  if (
    ["bilirubin", "ast", "alt"].includes(threshold.field) &&
    thresholdUnit.includes("uln")
  ) {
    const upperBound = parseUpperBound(item.referenceRange);
    if (!upperBound || upperBound === 0) {
      return undefined;
    }
    return value / upperBound;
  }

  return value;
}

function pickItems(
  bundle: PatientEvidenceBundle,
  predicate: (item: PatientEvidenceItem) => boolean,
) {
  return bundle.items.filter(predicate);
}

function latestByDate(items: PatientEvidenceItem[]) {
  return [...items]
    .sort((left, right) => left.sourceDate.localeCompare(right.sourceDate))
    .at(-1);
}

function formatEvidenceCount(supportingCount: number, contradictingCount: number) {
  if (supportingCount > 0 && contradictingCount > 0) {
    return `${supportingCount} supporting and ${contradictingCount} contradicting evidence items.`;
  }
  if (supportingCount > 0) {
    return `${supportingCount} supporting evidence item${supportingCount === 1 ? "" : "s"}.`;
  }
  if (contradictingCount > 0) {
    return `${contradictingCount} contradicting evidence item${contradictingCount === 1 ? "" : "s"}.`;
  }
  return "No cited evidence items.";
}

function result(
  partial: Omit<DeterministicCriterionResult, "supportingEvidenceCount" | "contradictingEvidenceCount"> & {
    supportingEvidence?: PatientEvidenceItem[];
    contradictingEvidence?: PatientEvidenceItem[];
  },
): DeterministicCriterionResult {
  const supportingEvidenceCount = partial.supportingEvidence?.length ?? 0;
  const contradictingEvidenceCount = partial.contradictingEvidence?.length ?? 0;
  return {
    ...partial,
    supportingEvidenceCount,
    contradictingEvidenceCount,
  };
}

function evaluateAgeRange(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
): DeterministicCriterionResult {
  const ageEvidence = pickItems(bundle, (item) => item.sourceType === "demographics_age");
  const ageItem = ageEvidence[0];
  if (!ageItem || ageItem.numericValue == null) {
    return result({
      mode: "needs_ai_fallback",
      status: "uncertain",
      freshness: "missing",
      reasoning: "Age could not be resolved from the structured evidence bundle.",
      reviewRequired: true,
      evidenceIds: [],
      uncertaintyReason: "missing_domain",
    });
  }

  const age = ageItem.numericValue;
  const minPass = rule.minimumAgeYears == null || age >= rule.minimumAgeYears;
  const maxPass = rule.maximumAgeYears == null || age <= rule.maximumAgeYears;
  const passes = minPass && maxPass;

  return result({
    mode: "deterministic",
    status:
      criterion.type === "inclusion"
        ? passes
          ? "pass"
          : "fail"
        : passes
          ? "fail"
          : "pass",
    freshness: ageItem.freshness,
    reasoning: `Patient age ${age} years was compared against the criterion bounds.${rule.minimumAgeYears != null ? ` Minimum ${rule.minimumAgeYears}.` : ""}${rule.maximumAgeYears != null ? ` Maximum ${rule.maximumAgeYears}.` : ""}`,
    reviewRequired: !passes,
    evidenceIds: ageEvidence.map((item) => item.id),
    supportingEvidence: passes ? ageEvidence : [],
    contradictingEvidence: passes ? [] : ageEvidence,
  });
}

function evaluateSexMatch(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
): DeterministicCriterionResult {
  const sexEvidence = pickItems(bundle, (item) => item.sourceType === "demographics_sex");
  const sexItem = sexEvidence[0];
  if (!sexItem?.excerpt) {
    return result({
      mode: "needs_ai_fallback",
      status: "uncertain",
      freshness: "missing",
      reasoning: "Structured sex metadata is missing from the evidence bundle.",
      reviewRequired: true,
      evidenceIds: [],
      uncertaintyReason: "missing_domain",
    });
  }

  const actual = normalizeText(sexItem.excerpt);
  const expected = normalizeText(rule.sex ?? "");
  const matches = actual.includes(expected);

  return result({
    mode: "deterministic",
    status:
      criterion.type === "inclusion"
        ? matches
          ? "pass"
          : "fail"
        : matches
          ? "fail"
          : "pass",
    freshness: sexItem.freshness,
    reasoning: `Structured sex metadata resolved to ${sexItem.excerpt}; criterion expects ${rule.sex}.`,
    reviewRequired: !matches,
    evidenceIds: sexEvidence.map((item) => item.id),
    supportingEvidence: matches ? sexEvidence : [],
    contradictingEvidence: matches ? [] : sexEvidence,
  });
}

function evaluateDiagnosisMatch(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
): DeterministicCriterionResult {
  const diagnosisEvidence = pickItems(bundle, (item) =>
    ["diagnosis_summary", "problem_list", "pathology", "imaging", "progress", "uploaded_record"].includes(
      item.sourceType,
    ),
  );

  if (diagnosisEvidence.length === 0 || (rule.diagnosisAliases?.length ?? 0) === 0) {
    return result({
      mode: criterion.computability === "manual_only" ? "manual_review" : "needs_ai_fallback",
      status: criterion.computability === "manual_only" ? "manual_review" : "uncertain",
      freshness: diagnosisEvidence.length === 0 ? "missing" : "aging",
      reasoning: "Diagnosis-specific alias groups could not be resolved confidently from the criterion text.",
      reviewRequired: true,
      evidenceIds: diagnosisEvidence.map((item) => item.id),
      uncertaintyReason:
        diagnosisEvidence.length === 0 ? "missing_domain" : "protocol_ambiguity",
      supportingEvidence: diagnosisEvidence,
    });
  }

  const positiveEvidence = diagnosisEvidence.filter(
    (item) =>
      item.assertionStatus !== "negated" &&
      item.assertionStatus !== "family" &&
      item.assertionStatus !== "possible",
  );
  const contradictingEvidence = diagnosisEvidence.filter(
    (item) =>
      item.assertionStatus === "negated" ||
      item.assertionStatus === "possible" ||
      item.assertionStatus === "family",
  );
  const combinedPositiveText = positiveEvidence
    .map((item) => `${item.label} ${item.excerpt ?? ""}`)
    .join(" ");
  const matches = containsAliasGroups(combinedPositiveText, rule.diagnosisAliases);

  if (!matches && criterion.type === "exclusion" && contradictingEvidence.length > 0) {
    return result({
      mode: "deterministic",
      status: "pass",
      freshness: latestByDate(diagnosisEvidence)?.freshness ?? "fresh",
      reasoning: `No patient-positive diagnosis evidence matched the exclusion alias groups. ${formatEvidenceCount(0, contradictingEvidence.length)}`,
      reviewRequired: false,
      evidenceIds: diagnosisEvidence.map((item) => item.id),
      supportingEvidence: [],
      contradictingEvidence,
    });
  }

  return result({
    mode: "deterministic",
    status:
      criterion.type === "inclusion"
        ? matches
          ? "pass"
          : "fail"
        : matches
          ? "fail"
          : "pass",
    freshness: latestByDate(diagnosisEvidence)?.freshness ?? "fresh",
    reasoning: `Diagnosis and staging evidence was checked against the criterion alias groups. ${formatEvidenceCount(positiveEvidence.length, contradictingEvidence.length)}`,
    reviewRequired: !matches,
    evidenceIds: diagnosisEvidence.map((item) => item.id),
    supportingEvidence: matches ? positiveEvidence : [],
    contradictingEvidence: matches ? contradictingEvidence : diagnosisEvidence,
  });
}

function evaluateBiomarkerPresence(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
): DeterministicCriterionResult {
  const biomarkerEvidence = pickItems(bundle, (item) =>
    ["diagnosis_summary", "genomic", "pathology", "progress", "uploaded_record"].includes(
      item.sourceType,
    ),
  );

  if (biomarkerEvidence.length === 0 || (rule.biomarkerAliases?.length ?? 0) === 0) {
    return result({
      mode: criterion.computability === "manual_only" ? "manual_review" : "needs_ai_fallback",
      status: criterion.computability === "manual_only" ? "manual_review" : "uncertain",
      freshness: biomarkerEvidence.length === 0 ? "missing" : "aging",
      reasoning: "Biomarker alias groups could not be compiled with enough confidence for deterministic screening.",
      reviewRequired: true,
      evidenceIds: biomarkerEvidence.map((item) => item.id),
      uncertaintyReason:
        biomarkerEvidence.length === 0 ? "missing_domain" : "protocol_ambiguity",
      supportingEvidence: biomarkerEvidence,
    });
  }

  const positiveEvidence = biomarkerEvidence.filter(
    (item) =>
      item.assertionStatus !== "negated" &&
      item.assertionStatus !== "family" &&
      item.assertionStatus !== "possible",
  );
  const contradictingEvidence = biomarkerEvidence.filter(
    (item) => item.assertionStatus === "negated" || item.assertionStatus === "possible",
  );
  const combinedPositiveText = positiveEvidence
    .map((item) => `${item.label} ${item.excerpt ?? ""}`)
    .join(" ");
  const matches = containsAliasGroups(combinedPositiveText, rule.biomarkerAliases);

  return result({
    mode: "deterministic",
    status:
      criterion.type === "inclusion"
        ? matches
          ? "pass"
          : "fail"
        : matches
          ? "fail"
          : "pass",
    freshness: latestByDate(biomarkerEvidence)?.freshness ?? "fresh",
    reasoning: `Molecular and pathology evidence was checked for the requested biomarker pattern. ${formatEvidenceCount(positiveEvidence.length, contradictingEvidence.length)}`,
    reviewRequired: !matches,
    evidenceIds: biomarkerEvidence.map((item) => item.id),
    supportingEvidence: matches ? positiveEvidence : [],
    contradictingEvidence: matches ? contradictingEvidence : biomarkerEvidence,
  });
}

function evaluateEventLookbackExclusion(
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
  screeningDate: string,
): DeterministicCriterionResult {
  const eventEvidence = pickItems(bundle, (item) =>
    ["problem_list", "procedure", "progress", "imaging", "uploaded_record"].includes(
      item.sourceType,
    ) &&
    (rule.eventAliases ?? []).some((alias) =>
      normalizeText(`${item.label} ${item.excerpt ?? ""}`).includes(alias),
    ),
  );

  if (eventEvidence.length === 0) {
    return result({
      mode: bundle.items.some((item) => item.sourceType === "uploaded_record")
        ? "needs_ai_fallback"
        : "deterministic",
      status: bundle.items.some((item) => item.sourceType === "uploaded_record")
        ? "uncertain"
        : "pass",
      freshness: bundle.items.length === 0 ? "missing" : "fresh",
      reasoning: "No patient-positive cardiac event evidence matched the lookback exclusion aliases.",
      reviewRequired: bundle.items.some((item) => item.sourceType === "uploaded_record"),
      evidenceIds: [],
      uncertaintyReason: bundle.items.some((item) => item.sourceType === "uploaded_record")
        ? "missing_domain"
        : undefined,
    });
  }

  const positiveEvidence = eventEvidence.filter(
    (item) =>
      item.assertionStatus !== "negated" &&
      item.assertionStatus !== "family" &&
      item.assertionStatus !== "possible",
  );
  const possibleEvidence = eventEvidence.filter(
    (item) => item.assertionStatus === "possible",
  );

  if (possibleEvidence.length > 0 && positiveEvidence.length === 0) {
    return result({
      mode: "deterministic",
      status: "uncertain",
      freshness: latestByDate(eventEvidence)?.freshness ?? "aging",
      reasoning: "Possible or indeterminate event language was found, but the event was not confirmed as patient-positive.",
      reviewRequired: true,
      evidenceIds: eventEvidence.map((item) => item.id),
      uncertaintyReason: "conflicting_evidence",
      supportingEvidence: [],
      contradictingEvidence: possibleEvidence,
    });
  }

  const latestPositive = latestByDate(positiveEvidence);
  if (!latestPositive) {
    return result({
      mode: "deterministic",
      status: "pass",
      freshness: latestByDate(eventEvidence)?.freshness ?? "fresh",
      reasoning: "Only negated or family-history event mentions were found.",
      reviewRequired: false,
      evidenceIds: eventEvidence.map((item) => item.id),
      supportingEvidence: [],
      contradictingEvidence: eventEvidence,
    });
  }

  const eventDate = latestPositive.temporalDate ?? latestPositive.sourceDate;
  const lookbackDays = rule.temporalConstraint?.lookbackDays ?? 180;
  if (!eventDate) {
    return result({
      mode: "needs_ai_fallback",
      status: "uncertain",
      freshness: latestPositive.freshness,
      reasoning: "A patient-positive event was found, but the event date could not be resolved for interval arithmetic.",
      reviewRequired: true,
      evidenceIds: eventEvidence.map((item) => item.id),
      uncertaintyReason: "protocol_ambiguity",
      supportingEvidence: positiveEvidence,
      contradictingEvidence: possibleEvidence,
    });
  }

  const daysSinceEvent = daysBetween(screeningDate, eventDate);
  const withinWindow = daysSinceEvent <= lookbackDays;

  return result({
    mode: "deterministic",
    status: withinWindow ? "fail" : "pass",
    freshness: latestPositive.freshness,
    reasoning: `Patient-positive event evidence dated ${eventDate} was compared against a ${lookbackDays}-day lookback window. Days since event: ${daysSinceEvent}.`,
    reviewRequired: withinWindow,
    evidenceIds: eventEvidence.map((item) => item.id),
    supportingEvidence: withinWindow ? positiveEvidence : [],
    contradictingEvidence: withinWindow ? possibleEvidence : eventEvidence.filter((item) => item.assertionStatus === "negated"),
  });
}

function evaluateNoPriorExposure(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
): DeterministicCriterionResult {
  const therapyEvidence = pickItems(bundle, (item) =>
    ["medication_history", "progress", "uploaded_record"].includes(item.sourceType) &&
    (rule.therapyAliases ?? []).some((group) =>
      group.some((alias) =>
        normalizeText(`${item.label} ${item.excerpt ?? ""}`).includes(alias),
      ),
    ),
  );

  if (therapyEvidence.length === 0) {
    return result({
      mode: bundle.items.some((item) => item.sourceType === "uploaded_record")
        ? "needs_ai_fallback"
        : "deterministic",
      status: bundle.items.some((item) => item.sourceType === "uploaded_record")
        ? "uncertain"
        : "pass",
      freshness: bundle.items.length === 0 ? "missing" : "fresh",
      reasoning: "No prior exposure evidence matched the restricted therapy aliases.",
      reviewRequired: bundle.items.some((item) => item.sourceType === "uploaded_record"),
      evidenceIds: therapyEvidence.map((item) => item.id),
      uncertaintyReason: bundle.items.some((item) => item.sourceType === "uploaded_record")
        ? "missing_domain"
        : undefined,
    });
  }

  const positiveExposure = therapyEvidence.filter(
    (item) =>
      item.assertionStatus !== "negated" &&
      item.assertionStatus !== "possible" &&
      item.assertionStatus !== "family",
  );
  const negativeExposure = therapyEvidence.filter(
    (item) => item.assertionStatus === "negated",
  );
  const exposureFound = positiveExposure.length > 0;

  return result({
    mode: "deterministic",
    status:
      criterion.type === "inclusion"
        ? exposureFound
          ? "fail"
          : "pass"
        : exposureFound
          ? "pass"
          : "fail",
    freshness: latestByDate(therapyEvidence)?.freshness ?? "fresh",
    reasoning: `Medication and oncology history were checked for prior exposure to the restricted therapy family. ${formatEvidenceCount(positiveExposure.length, negativeExposure.length)}`,
    reviewRequired: exposureFound,
    evidenceIds: therapyEvidence.map((item) => item.id),
    supportingEvidence: exposureFound ? positiveExposure : negativeExposure,
    contradictingEvidence: exposureFound ? negativeExposure : [],
  });
}

function evaluatePriorTherapyProgression(
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
): DeterministicCriterionResult {
  const relevantEvidence = pickItems(bundle, (item) =>
    ["medication_history", "progress", "imaging", "uploaded_record"].includes(
      item.sourceType,
    ),
  );

  const therapyFound = relevantEvidence.some((item) =>
    (rule.therapyAliases ?? []).some((group) =>
      group.some((alias) =>
        normalizeText(`${item.label} ${item.excerpt ?? ""}`).includes(alias),
      ),
    ),
  );
  const progressionEvidence = relevantEvidence.filter((item) =>
    /progression|progressed|failed|disease progression|progressive disease/i.test(
      `${item.label} ${item.excerpt ?? ""}`,
    ),
  );

  if (!therapyFound || progressionEvidence.length === 0) {
    return result({
      mode: therapyFound ? "needs_ai_fallback" : "deterministic",
      status: therapyFound ? "uncertain" : "fail",
      freshness: latestByDate(relevantEvidence)?.freshness ?? "aging",
      reasoning: therapyFound
        ? "Prior therapy exposure was found, but progression after that therapy was not deterministically resolved."
        : "Required prior therapy exposure was not found in the evidence bundle.",
      reviewRequired: true,
      evidenceIds: relevantEvidence.map((item) => item.id),
      uncertaintyReason: therapyFound ? "protocol_ambiguity" : undefined,
      supportingEvidence: therapyFound ? relevantEvidence : [],
      contradictingEvidence: therapyFound ? [] : relevantEvidence,
    });
  }

  return result({
    mode: "deterministic",
    status: "pass",
    freshness: latestByDate(progressionEvidence)?.freshness ?? "fresh",
    reasoning: "Prior therapy exposure and progression language were both found in the patient record.",
    reviewRequired: false,
    evidenceIds: relevantEvidence.map((item) => item.id),
    supportingEvidence: progressionEvidence,
    contradictingEvidence: [],
  });
}

function evaluateEcogMax(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
  screeningDate: string,
): DeterministicCriterionResult {
  const ecogEvidence = pickItems(bundle, (item) => item.sourceType === "ecog_summary");
  const ecogItem = latestByDate(ecogEvidence);

  if (!ecogItem || ecogItem.numericValue == null || rule.ecogMax == null) {
    return result({
      mode: "needs_ai_fallback",
      status: "uncertain",
      freshness: ecogItem?.freshness ?? "missing",
      reasoning: "ECOG performance status could not be deterministically resolved.",
      reviewRequired: true,
      evidenceIds: ecogEvidence.map((item) => item.id),
      uncertaintyReason: "missing_domain",
      supportingEvidence: ecogEvidence,
    });
  }

  const freshnessDays = rule.temporalConstraint?.freshnessDays;
  const daysOld = daysBetween(screeningDate, ecogItem.sourceDate);
  if (freshnessDays != null && daysOld > freshnessDays) {
    return result({
      mode: "deterministic",
      status: "uncertain",
      freshness: "stale",
      reasoning: `ECOG ${ecogItem.numericValue} was found, but the assessment is ${daysOld} days old and outside the ${freshnessDays}-day window.`,
      reviewRequired: true,
      evidenceIds: ecogEvidence.map((item) => item.id),
      uncertaintyReason: "stale_data",
      supportingEvidence: ecogEvidence,
    });
  }

  const passes = ecogItem.numericValue <= rule.ecogMax;
  return result({
    mode: "deterministic",
    status:
      criterion.type === "inclusion"
        ? passes
          ? "pass"
          : "fail"
        : passes
          ? "fail"
          : "pass",
    freshness: ecogItem.freshness,
    reasoning: `ECOG ${ecogItem.numericValue} was compared against a maximum allowed ECOG of ${rule.ecogMax}.`,
    reviewRequired: !passes,
    evidenceIds: ecogEvidence.map((item) => item.id),
    supportingEvidence: passes ? ecogEvidence : [],
    contradictingEvidence: passes ? [] : ecogEvidence,
  });
}

function evaluateLabThreshold(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  rule: CompiledCriterionRule,
  screeningDate: string,
): DeterministicCriterionResult {
  const thresholds = rule.thresholds ?? [];
  if (thresholds.length === 0) {
    return result({
      mode: criterion.computability === "manual_only" ? "manual_review" : "needs_ai_fallback",
      status: criterion.computability === "manual_only" ? "manual_review" : "uncertain",
      freshness: "missing",
      reasoning: "No explicit numeric thresholds were compiled for this criterion.",
      reviewRequired: true,
      evidenceIds: [],
      uncertaintyReason: "protocol_ambiguity",
    });
  }

  const relevantEvidence = pickItems(bundle, (item) => item.sourceType === "lab");
  const usedEvidence: PatientEvidenceItem[] = [];
  const staleEvidence: PatientEvidenceItem[] = [];

  for (const threshold of thresholds) {
    const aliases = FIELD_ALIASES[threshold.field];
    const matchingLabs = relevantEvidence.filter((item) =>
      aliases.some((alias) =>
        normalizeText(item.label).includes(alias) ||
        normalizeText(item.excerpt ?? "").includes(alias),
      ),
    );
    const latestLab = latestByDate(matchingLabs);

    if (!latestLab) {
      return result({
        mode: "deterministic",
        status: "uncertain",
        freshness: "missing",
        reasoning: `No structured lab value was found for ${threshold.field}.`,
        reviewRequired: true,
        evidenceIds: usedEvidence.map((item) => item.id),
        uncertaintyReason: "missing_domain",
        supportingEvidence: usedEvidence,
      });
    }

    usedEvidence.push(latestLab);
    const freshnessDays = rule.temporalConstraint?.freshnessDays;
    if (
      freshnessDays != null &&
      daysBetween(screeningDate, latestLab.sourceDate) > freshnessDays
    ) {
      staleEvidence.push(latestLab);
      continue;
    }

    const comparableValue = normalizeLabValueForThreshold(latestLab, threshold);
    if (comparableValue == null) {
      return result({
        mode: "needs_ai_fallback",
        status: "uncertain",
        freshness: latestLab.freshness,
        reasoning: `Lab ${latestLab.label} was found, but the value could not be normalized into the threshold unit ${threshold.unit ?? "required by protocol"}.`,
        reviewRequired: true,
        evidenceIds: usedEvidence.map((item) => item.id),
        uncertaintyReason: "protocol_ambiguity",
        supportingEvidence: usedEvidence,
      });
    }

    if (!applyComparator(comparableValue, threshold.comparator, threshold.value)) {
      return result({
        mode: "deterministic",
        status:
          criterion.type === "inclusion"
            ? "fail"
            : "pass",
        freshness: latestLab.freshness,
        reasoning: `${threshold.field} resolved to ${comparableValue} and did not satisfy ${threshold.comparator} ${threshold.value}${threshold.unit ? ` ${threshold.unit}` : ""}.`,
        reviewRequired: true,
        evidenceIds: usedEvidence.map((item) => item.id),
        supportingEvidence: [],
        contradictingEvidence: usedEvidence,
      });
    }
  }

  if (staleEvidence.length > 0) {
    return result({
      mode: "deterministic",
      status: "uncertain",
      freshness: "stale",
      reasoning: `Required lab evidence exists, but ${staleEvidence.length} lab item${staleEvidence.length === 1 ? "" : "s"} fall outside the protocol freshness window.`,
      reviewRequired: true,
      evidenceIds: usedEvidence.map((item) => item.id),
      uncertaintyReason: "stale_data",
      supportingEvidence: usedEvidence,
      contradictingEvidence: staleEvidence,
    });
  }

  return result({
    mode: "deterministic",
    status:
      criterion.type === "inclusion"
        ? "pass"
        : "fail",
    freshness: latestByDate(usedEvidence)?.freshness ?? "fresh",
    reasoning: "All explicit lab thresholds were satisfied on the freshest structured lab set.",
    reviewRequired: criterion.type === "exclusion",
    evidenceIds: usedEvidence.map((item) => item.id),
    supportingEvidence: usedEvidence,
    contradictingEvidence: [],
  });
}

function evaluateManualReview(
  criterion: NormalizedCriterion,
): DeterministicCriterionResult {
  return result({
    mode: "manual_review",
    status: "manual_review",
    freshness: "aging",
    reasoning:
      criterion.normalizationConfidence === "low"
        ? "The criterion could not be compiled into a safe deterministic rule from registry text and remains a human-review boundary."
        : "This criterion stays in human review because it requires investigator judgment or local protocol QA.",
    reviewRequired: true,
    evidenceIds: [],
    uncertaintyReason:
      criterion.computability === "manual_only"
        ? "manual_only"
        : "protocol_ambiguity",
  });
}

export function evaluateCriterionAgainstBundle(
  criterion: NormalizedCriterion,
  bundle: PatientEvidenceBundle,
  screeningDate: string,
): DeterministicCriterionResult {
  const compiled = compileCriterionForScreening(criterion);
  const rule = compiled.compiledRule;

  if (!rule) {
    return result({
      mode: "needs_ai_fallback",
      status: "uncertain",
      freshness: "missing",
      reasoning: "The criterion has no compiled rule and needs AI-assisted review.",
      reviewRequired: true,
      evidenceIds: [],
      uncertaintyReason: "protocol_ambiguity",
    });
  }

  switch (rule.kind) {
    case "age_range":
      return evaluateAgeRange(compiled, bundle, rule);
    case "sex_match":
      return evaluateSexMatch(compiled, bundle, rule);
    case "diagnosis_match":
      return evaluateDiagnosisMatch(compiled, bundle, rule);
    case "biomarker_presence":
      return evaluateBiomarkerPresence(compiled, bundle, rule);
    case "lab_threshold":
      return evaluateLabThreshold(compiled, bundle, rule, screeningDate);
    case "event_lookback_exclusion":
      return evaluateEventLookbackExclusion(bundle, rule, screeningDate);
    case "prior_therapy_progression":
      return evaluatePriorTherapyProgression(bundle, rule);
    case "no_prior_exposure":
      return evaluateNoPriorExposure(compiled, bundle, rule);
    case "ecog_max":
      return evaluateEcogMax(compiled, bundle, rule, screeningDate);
    case "manual_review":
      return evaluateManualReview(compiled);
    default:
      return evaluateManualReview(compiled);
  }
}

export function buildCriterionAssessment(
  criterion: NormalizedCriterion,
  evaluation: DeterministicCriterionResult,
): CriterionAssessment {
  return {
    id: criterion.id,
    label: criterion.label,
    bucket:
      criterion.type === "inclusion" ? "Inclusion fit" : "Exclusion pressure",
    status: evaluation.status,
    confidenceLabel:
      evaluation.mode === "manual_review"
        ? "Clinical review"
        : evaluation.status === "pass"
          ? "Deterministic pass"
          : evaluation.status === "fail"
            ? "Deterministic fail"
            : "Needs review",
    computability: criterion.computability,
    summary: evaluation.reasoning,
    reviewRequired: evaluation.reviewRequired,
    freshness: evaluation.freshness,
    reasoning: evaluation.reasoning,
    uncertaintyReason: evaluation.uncertaintyReason,
    evidenceIds: evaluation.evidenceIds,
    thresholdLabel: criterion.threshold,
    lastEvaluatedAt: new Date().toISOString(),
    supportingEvidenceCount: evaluation.supportingEvidenceCount,
    contradictingEvidenceCount: evaluation.contradictingEvidenceCount,
  };
}

export function screenPatientAgainstTrial(
  patientId: string,
  trialId: string,
  options: ScreeningPreparationOptions = {},
) {
  const context = prepareScreeningContext(patientId, trialId, options);
  const importedProjection = getImportedTrialByTrialId(trialId);
  const assessments = context.criteria.map((criterion) =>
    buildCriterionAssessment(
      criterion,
      evaluateCriterionAgainstBundle(
        criterion,
        context.patientEvidenceBundle,
        context.screeningDate,
      ),
    ),
  );

  return {
    ...context,
    assessments,
    readiness: summarizeTrialAutomationReadiness(
      context.criteria,
      importedProjection,
    ),
  };
}
