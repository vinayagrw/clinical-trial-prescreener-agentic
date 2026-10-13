import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DECOMPOSE_PROTOCOL_FEATURE_KEY,
  DECOMPOSE_PROTOCOL_SYSTEM,
  buildDecomposeProtocolUserPrompt,
} from "../../src/lib/ai/prompts/decomposeProtocol.ts";
import {
  DecompositionResponseSchema,
  type DecompositionResponse,
} from "../../src/lib/ai/schemas.ts";
import { compileCriterionForScreening } from "../../src/lib/screening/patientTrialEvaluator.ts";
import type {
  ImportedTrialNormalizationReviewState,
  ReviewGate,
  NormalizationJob,
  NormalizationJobStatus,
  NormalizedCriterion,
} from "../../src/types/clinical.ts";
import { getServerLlmGateway } from "./llmGateway.ts";
import { readJsonFile, writeJsonFile } from "./storage.ts";

type Computability = "deterministic" | "hybrid" | "manual_only";
type ImportStatus = "ready" | "error";
type ImportedTrialScreeningIntent =
  | "prospective_prescreening"
  | "retrospective_manual_only";
type ImportedCriterionCategory =
  | "clinical"
  | "administrative"
  | "tautology"
  | "cohort_membership";
type AssertionStatus =
  | "present"
  | "negated"
  | "possible"
  | "historical"
  | "family";
type TemporalComparisonType =
  | "none"
  | "lookback_exclusion"
  | "freshness_window"
  | "after_progression";
type TemporalAnchor =
  | "screening_date"
  | "event_date"
  | "latest_lab"
  | "prior_therapy"
  | "ecog_assessment";
type CompiledCriterionRuleKind =
  | "age_range"
  | "sex_match"
  | "diagnosis_match"
  | "biomarker_presence"
  | "lab_threshold"
  | "event_lookback_exclusion"
  | "prior_therapy_progression"
  | "no_prior_exposure"
  | "ecog_max"
  | "manual_review";

interface TemporalConstraint {
  anchor: TemporalAnchor;
  comparisonType: TemporalComparisonType;
  lookbackDays?: number;
  freshnessDays?: number;
}

interface CompiledThreshold {
  field:
    | "age"
    | "anc"
    | "platelets"
    | "hemoglobin"
    | "bilirubin"
    | "ast"
    | "alt"
    | "creatinine"
    | "ecog";
  comparator: ">=" | "<=" | "<" | ">";
  value: number;
  unit?: string;
}

interface CompiledCriterionRule {
  kind: CompiledCriterionRuleKind;
  diagnosisAliases?: string[][];
  biomarkerAliases?: string[][];
  therapyAliases?: string[][];
  eventAliases?: string[];
  thresholds?: CompiledThreshold[];
  ecogMax?: number;
  minimumAgeYears?: number;
  maximumAgeYears?: number;
  sex?: string;
  temporalConstraint?: TemporalConstraint;
}

interface ImportedCriterionDraft {
  id: string;
  trialId: string;
  label: string;
  type: "inclusion" | "exclusion";
  computability: Computability;
  threshold: string;
  owner: string;
  note: string;
  conceptTags?: string[];
  temporalAnchor?: string;
  temporalWindow?: string;
  qaStatus?: "approved" | "needs_review" | "manual_only";
  protocolSource?: string;
  ruleKind?: CompiledCriterionRuleKind;
  assertionSensitive?: boolean;
  normalizationConfidence?: "high" | "medium" | "low";
  compiledRule?: CompiledCriterionRule;
  criterionCategory?: ImportedCriterionCategory;
  countsTowardAutomationReadiness?: boolean;
  sourceLocation?: string;
  deterministicParseOutput?: string;
  llmNormalizedOutput?: string;
  normalizationJobId?: string;
  normalizationSource?: "deterministic_seed" | "llm_assisted" | "reviewer_approved";
  source: "clinicaltrials_gov";
  sourceText: string;
  sectionLabel: string;
}

interface ImportedTrialVersionDraft {
  id: string;
  trialId: string;
  version: string;
  releasedAt: string;
  summary: string;
  status: string;
  source: "clinicaltrials_gov";
}

interface ImportedTrialProjection {
  id: string;
  shortCode: string;
  title: string;
  diseaseArea: string;
  phase: string;
  localStatus: "review";
  activationState: string;
  protocolVersion: string;
  pi: string;
  screeningWindow: string;
  releaseState: string;
  nctId: string;
  source: "clinicaltrials_gov";
  importedAt: string;
  sourceUrl: string;
  sponsorName?: string;
  registryOverallStatus?: string;
  conditions: string[];
  eligibilityRawText: string;
  criteriaCount: number;
  onboardingState: "draft_import";
  screeningWindowSource?: string;
  screeningIntent: ImportedTrialScreeningIntent;
  automationBlockerReason?: string;
  linkedInstitutionalTrialId?: string;
  promotionState?: "not_promoted" | "linked";
  promotedAt?: string;
}

interface ImportedTrialRecord {
  nctId: string;
  fetchedAt: string;
  sourceUrl: string;
  importStatus: ImportStatus;
  latestNormalizationJobId?: string;
  normalizationStatus: NormalizationJobStatus;
  normalizationReviewState: ImportedTrialNormalizationReviewState;
  projection: ImportedTrialProjection;
  criteria: ImportedCriterionDraft[];
  versions: ImportedTrialVersionDraft[];
  normalizationJobs: NormalizationJob[];
  rawStudy: unknown;
}

interface ImportedTrialListItem
  extends Omit<ImportedTrialRecord, "rawStudy"> {}

interface ImportedTrialsRuntimePayload {
  updatedAt: string | null;
  items: ImportedTrialRecord[];
}

interface TrialImportRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
  url: URL;
  readBody: (request: IncomingMessage) => Promise<unknown>;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const runtimeFile = join(currentDir, "..", ".runtime", "clinicaltrials-trials.json");
const NORMALIZATION_PROMPT_VERSION = "f1.normalizeImportedTrial.v1";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function toListItem(record: ImportedTrialRecord): ImportedTrialListItem {
  const { rawStudy: _rawStudy, ...listItem } = record;
  return listItem;
}

function arrayify<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function asText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function sanitizeNctId(value: unknown): string {
  return asText(value).toUpperCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isTruthyEligibilityFlag(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = asText(value).toLowerCase();
  return ["yes", "true", "allowed", "accepts"].includes(normalized);
}

function classifyCriterionCategory(text: string): ImportedCriterionCategory {
  const lower = text.toLowerCase();

  if (
    /(screen failure|does not meet the eligibility criteria|cannot be included|not meet the eligibility criteria)/i.test(
      lower,
    )
  ) {
    return "tautology";
  }

  if (
    /(informed consent|written informed consent|legal guardian|irb|hipaa|waiver of consent|agree(?:s|d)? to its provisions|informed of the nature of the study)/i.test(
      lower,
    )
  ) {
    return "administrative";
  }

  if (
    /(expanded access|treated with .* device|treated with an? .* device|attempted or successful|prior implant|prior device|prior procedure|previously collected during standard patient care)/i.test(
      lower,
    )
  ) {
    return "cohort_membership";
  }

  return "clinical";
}

function countsTowardAutomationReadiness(
  category: ImportedCriterionCategory,
): boolean {
  return category === "clinical";
}

function noteForCriterionCategory(
  category: ImportedCriterionCategory,
): string {
  switch (category) {
    case "administrative":
      return "Administrative registry requirement retained for onboarding context. Not used as automated screening logic.";
    case "cohort_membership":
      return "Retained as cohort-membership context from registry text. Manual review is required before any local use.";
    case "tautology":
      return "Tautological eligibility text omitted from structured screening logic.";
    default:
      return "Imported from ClinicalTrials.gov eligibility text. Needs local protocol QA before activation.";
  }
}

function assertValidNctId(nctId: string): void {
  if (!/^NCT\d{8}$/i.test(nctId)) {
    throw new Error("A valid NCT ID is required, for example NCT01234567.");
  }
}

function inferDiseaseArea(conditions: string[]): string {
  if (conditions.length === 0) {
    return "Imported registry trial";
  }

  const first = conditions[0].toLowerCase();
  if (first.includes("lung") || first.includes("thoracic")) {
    return "Thoracic Oncology";
  }
  if (first.includes("breast")) {
    return "Breast Oncology";
  }
  if (first.includes("ovarian") || first.includes("endometrial") || first.includes("gynec")) {
    return "Gynecologic Oncology";
  }
  if (first.includes("cholangio") || first.includes("biliary") || first.includes("pancrea")) {
    return "GI Oncology";
  }
  if (first.includes("melanoma")) {
    return "Melanoma";
  }

  return conditions[0];
}

function detectTimingMention(text: string): string | undefined {
  const match = text.match(
    /within\s+\d+\s+(day|days|week|weeks|month|months|year|years)|\d+\s+(day|days|week|weeks|month|months|year|years)\s+before/i,
  );

  return match?.[0]?.trim();
}

function inferComputability(text: string): Computability {
  const lower = text.toLowerCase();

  if (
    /(investigator|clinically significant|adequate|sufficient|acceptable|in the opinion|willing|able to comply)/i.test(
      lower,
    )
  ) {
    return "manual_only";
  }

  if (
    /(<=|>=|<|>|less than|greater than|at least|no more than|within\s+\d+|\d+\s+(day|days|week|weeks|month|months|year|years)|ecog\s*\d|platelet|hemoglobin|bilirubin|creatinine|anc|ast|alt)/i.test(
      lower,
    )
  ) {
    return "deterministic";
  }

  if (
    /(mutation|fusion|biomarker|histology|diagnosis|prior therapy|progression|metastatic|unresectable|disease|received|failed)/i.test(
      lower,
    )
  ) {
    return "hybrid";
  }

  return "manual_only";
}

function inferConceptTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();

  if (/(egfr|alk|fgfr|braf|msi|pdl1|pd-l1|her2|ros1|ntrk)/i.test(lower)) {
    tags.push("biomarker");
  }
  if (/(bilirubin|ast|alt|creatinine|anc|platelet|hemoglobin|lab)/i.test(lower)) {
    tags.push("lab");
  }
  if (/(stage|metastatic|histology|diagnosis|tumor)/i.test(lower)) {
    tags.push("disease");
  }
  if (/(therapy|treatment|chemotherapy|immunotherapy|radiation|surgery)/i.test(lower)) {
    tags.push("therapy");
  }
  if (/(within\s+\d+|\d+\s+(day|days|week|weeks|month|months|year|years))/i.test(lower)) {
    tags.push("temporal");
  }

  return tags;
}

function inferAssertionSensitivity(text: string) {
  return /(history of|prior|received|mi|myocardial infarction|mutation|fusion|no prior|without)/i.test(
    text,
  );
}

function parseComparator(raw: string | undefined): CompiledThreshold["comparator"] {
  const value = raw?.trim().toLowerCase() ?? "";
  if (value === ">" || value === "greater than") return ">";
  if (value === "<" || value === "less than") return "<";
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

function normalizeThresholdValue(
  field: CompiledThreshold["field"],
  value: number,
  unit: string | undefined,
) {
  const normalizedUnit = unit?.replace(/\s+/g, "").toLowerCase() ?? "";
  if (field === "anc" && normalizedUnit.includes("/mm3") && value >= 100) {
    return value / 1000;
  }
  if (field === "platelets" && normalizedUnit.includes("/mm3") && value >= 1000) {
    return value / 1000;
  }
  return value;
}

function extractNumericThresholds(text: string): CompiledThreshold[] {
  const fieldPatterns: Array<{
    field: CompiledThreshold["field"];
    pattern: string;
  }> = [
    { field: "anc", pattern: "anc|absolute neutrophil count" },
    { field: "platelets", pattern: "platelets|platelet count|plt" },
    { field: "hemoglobin", pattern: "hemoglobin|hgb" },
    { field: "bilirubin", pattern: "bilirubin|total bilirubin" },
    { field: "ast", pattern: "ast" },
    { field: "alt", pattern: "alt" },
    { field: "creatinine", pattern: "creatinine|creatinine clearance|crcl" },
  ];

  return fieldPatterns.flatMap(({ field, pattern }) => {
    const match = new RegExp(
      `(?:${pattern})[^.;\\n]{0,40}?(>=|<=|>|<|≥|≤|at least|less than or equal to|greater than or equal to|less than|greater than|no more than)?\\s*(\\d+(?:\\.\\d+)?)\\s*(x\\s*uln|xuln|mg\\/dl|g\\/dl|k\\/[uµ]l|\\/[uµ]l|\\/mm3|ml\\/min)?`,
      "i",
    ).exec(text);

    if (!match) {
      return [];
    }

    const value = Number.parseFloat(match[2]);
    if (Number.isNaN(value)) {
      return [];
    }

    const unit = match[3]?.replace(/\s+/g, " ").trim();
    return [
      {
        field,
        comparator: parseComparator(match[1]),
        value: normalizeThresholdValue(field, value, unit),
        unit,
      } satisfies CompiledThreshold,
    ];
  });
}

function parseTemporalConstraint(
  text: string,
  kind: CompiledCriterionRuleKind,
): TemporalConstraint | undefined {
  const lower = text.toLowerCase();
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

function detectRuleKind(text: string, computability: Computability): CompiledCriterionRuleKind {
  const lower = text.toLowerCase();
  if (/minimum age|maximum age|age\s*(>=|<=|at least|no more than)/i.test(lower)) {
    return "age_range";
  }
  if (/eligible sex|female only|male only|women only|men only/i.test(lower)) {
    return "sex_match";
  }
  if (
    /(myocardial infarction|nstemi|stemi|congestive heart failure|stroke|cva|pulmonary embolism)/i.test(
      lower,
    ) &&
    /(within|before|history)/i.test(lower)
  ) {
    return "event_lookback_exclusion";
  }
  if (extractNumericThresholds(text).length > 0) {
    return "lab_threshold";
  }
  if (/ecog|performance status/i.test(lower)) {
    return "ecog_max";
  }
  if (
    /must not have received|no prior|prior exposure not allowed|naive to|no previous/i.test(
      lower,
    )
  ) {
    return "no_prior_exposure";
  }
  if (/progression|progressed|failed/i.test(lower) && /therapy|treatment|platinum|chemo/i.test(lower)) {
    return "prior_therapy_progression";
  }
  if (/(egfr|fgfr2|msi|mmr|pd-l1|her2|braf|alk|ros1|ntrk|brca)/i.test(lower)) {
    return "biomarker_presence";
  }
  if (/(diagnosis|histology|adenocarcinoma|nsclc|cholangio|endometrial|melanoma|urothelial|myeloma|metastatic|recurrent|unresectable)/i.test(lower)) {
    return "diagnosis_match";
  }
  return computability === "manual_only" ? "manual_review" : "manual_review";
}

function compileRule(
  text: string,
  ruleKind: CompiledCriterionRuleKind,
): CompiledCriterionRule {
  const ageMatch =
    /minimum age[^0-9]{0,10}(\d+)/i.exec(text) ??
    /age[^0-9]{0,10}(>=|at least|greater than or equal to)\s*(\d+)/i.exec(text);
  const maxAgeMatch =
    /maximum age[^0-9]{0,10}(\d+)/i.exec(text) ??
    /age[^0-9]{0,10}(<=|no more than|less than or equal to)\s*(\d+)/i.exec(text);
  const ecogRange = /ecog[^0-9]{0,10}(\d)\s*[-–]\s*(\d)/i.exec(text);
  const ecogSingle =
    /ecog[^0-9]{0,10}(<=|<|≤|at most|no more than)?\s*(\d)/i.exec(text) ??
    /performance status[^0-9]{0,10}(<=|<|≤|at most|no more than)?\s*(\d)/i.exec(text);

  return {
    kind: ruleKind,
    diagnosisAliases:
      ruleKind === "diagnosis_match" ? [inferConceptTags(text)] : undefined,
    biomarkerAliases:
      ruleKind === "biomarker_presence" ? [inferConceptTags(text)] : undefined,
    therapyAliases:
      ruleKind === "no_prior_exposure" || ruleKind === "prior_therapy_progression"
        ? [inferConceptTags(text)]
        : undefined,
    eventAliases:
      ruleKind === "event_lookback_exclusion"
        ? [
            ...(text.toLowerCase().includes("myocardial infarction") || text.toLowerCase().includes("nstemi")
              ? ["myocardial infarction", "nstemi", "mi"]
              : []),
            ...(text.toLowerCase().includes("heart failure") || text.toLowerCase().includes("chf")
              ? ["congestive heart failure", "chf", "heart failure"]
              : []),
          ]
        : undefined,
    thresholds: ruleKind === "lab_threshold" ? extractNumericThresholds(text) : undefined,
    ecogMax:
      ruleKind === "ecog_max"
        ? ecogRange
          ? Math.max(Number.parseInt(ecogRange[1], 10), Number.parseInt(ecogRange[2], 10))
          : ecogSingle
            ? Number.parseInt(ecogSingle[2], 10)
            : undefined
        : undefined,
    minimumAgeYears:
      ruleKind === "age_range"
        ? ageMatch
          ? Number.parseInt(ageMatch[2] ?? ageMatch[1], 10)
          : undefined
        : undefined,
    maximumAgeYears:
      ruleKind === "age_range"
        ? maxAgeMatch
          ? Number.parseInt(maxAgeMatch[2] ?? maxAgeMatch[1], 10)
          : undefined
        : undefined,
    sex:
      ruleKind === "sex_match"
        ? /female|women/i.test(text)
          ? "female"
          : /male|men/i.test(text)
            ? "male"
            : undefined
        : undefined,
    temporalConstraint: parseTemporalConstraint(text, ruleKind),
  };
}

function inferNormalizationConfidence(
  ruleKind: CompiledCriterionRuleKind,
  computability: Computability,
) {
  if (
    ["age_range", "sex_match", "lab_threshold", "ecog_max", "event_lookback_exclusion"].includes(
      ruleKind,
    )
  ) {
    return "high" as const;
  }
  if (
    ["diagnosis_match", "biomarker_presence", "prior_therapy_progression", "no_prior_exposure"].includes(
      ruleKind,
    )
  ) {
    return computability === "manual_only" ? ("low" as const) : ("medium" as const);
  }
  return "low" as const;
}

function withCompiledMetadata(
  draft: ImportedCriterionDraft,
): ImportedCriterionDraft {
  const sourceText = `${draft.label} ${draft.threshold} ${draft.sourceText}`;
  const ruleKind = detectRuleKind(sourceText, draft.computability);
  const compiledRule = compileRule(sourceText, ruleKind);
  const temporalConstraint = compiledRule.temporalConstraint;
  const criterionCategory =
    draft.criterionCategory ?? classifyCriterionCategory(sourceText);

  return {
    ...draft,
    ruleKind,
    assertionSensitive: inferAssertionSensitivity(sourceText),
    normalizationConfidence: inferNormalizationConfidence(
      ruleKind,
      draft.computability,
    ),
    compiledRule,
    temporalAnchor: draft.temporalAnchor ?? temporalConstraint?.anchor,
    temporalWindow:
      draft.temporalWindow ??
      (temporalConstraint?.lookbackDays
        ? `${temporalConstraint.lookbackDays} days`
        : temporalConstraint?.freshnessDays
          ? `${temporalConstraint.freshnessDays} days`
          : undefined),
    criterionCategory,
    countsTowardAutomationReadiness:
      draft.countsTowardAutomationReadiness ??
      countsTowardAutomationReadiness(criterionCategory),
  };
}

function normalizeLine(value: string): string {
  return value
    .replace(/^[\-\u2022\u2023\u25E6*]+\s*/, "")
    .replace(/^\(?\d+[\).\]:-]?\s*/, "")
    .trim();
}

function linesToCriteria(lines: string[]): string[] {
  const criteria: string[] = [];

  lines.forEach((rawLine) => {
    const line = normalizeLine(rawLine);
    if (!line) {
      return;
    }

    const previous = criteria[criteria.length - 1];
    if (
      previous &&
      /^[a-z(]/.test(line) &&
      !/[.;:]$/.test(previous)
    ) {
      criteria[criteria.length - 1] = `${previous} ${line}`;
      return;
    }

    criteria.push(line);
  });

  return criteria;
}

function splitEligibilitySections(text: string): {
  inclusion: string[];
  exclusion: string[];
} {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return { inclusion: [], exclusion: [] };
  }

  const inclusionHeading = normalized.search(/inclusion criteria:?/i);
  const exclusionHeading = normalized.search(/exclusion criteria:?/i);

  if (inclusionHeading >= 0 || exclusionHeading >= 0) {
    const inclusionBlock =
      inclusionHeading >= 0
        ? normalized.slice(
            inclusionHeading,
            exclusionHeading > inclusionHeading ? exclusionHeading : normalized.length,
          )
        : "";
    const exclusionBlock =
      exclusionHeading >= 0 ? normalized.slice(exclusionHeading) : "";

    const cleanBlock = (block: string) =>
      block
        .replace(/inclusion criteria:?/i, "")
        .replace(/exclusion criteria:?/i, "")
        .trim();

    return {
      inclusion: linesToCriteria(cleanBlock(inclusionBlock).split(/\n+/)),
      exclusion: linesToCriteria(cleanBlock(exclusionBlock).split(/\n+/)),
    };
  }

  return {
    inclusion: linesToCriteria(normalized.split(/\n+/)),
    exclusion: [],
  };
}

function buildStructuredEligibilityCriteria(
  nctId: string,
  trialId: string,
  eligibilityModule: Record<string, unknown>,
): ImportedCriterionDraft[] {
  const drafts: ImportedCriterionDraft[] = [];
  const minimumAge = asText(eligibilityModule.minimumAge);
  const maximumAge = asText(eligibilityModule.maximumAge);
  const sex = asText(eligibilityModule.sex);
  const healthyVolunteers = eligibilityModule.healthyVolunteers;

  if (minimumAge) {
    drafts.push(withCompiledMetadata({
      id: `${trialId}-structured-min-age`,
      trialId,
      label: "Minimum age requirement",
      type: "inclusion",
      computability: "deterministic",
      threshold: `Minimum age ${minimumAge}`,
      owner: "Protocol review",
      note: "Derived from ClinicalTrials.gov eligibility module.",
      qaStatus: "needs_review",
      protocolSource: `ClinicalTrials.gov ${nctId}`,
      criterionCategory: "clinical",
      countsTowardAutomationReadiness: true,
      source: "clinicaltrials_gov",
      sourceText: minimumAge,
      sectionLabel: "Eligibility module",
    }));
  }

  if (maximumAge && maximumAge.toLowerCase() !== "n/a") {
    drafts.push(withCompiledMetadata({
      id: `${trialId}-structured-max-age`,
      trialId,
      label: "Maximum age requirement",
      type: "inclusion",
      computability: "deterministic",
      threshold: `Maximum age ${maximumAge}`,
      owner: "Protocol review",
      note: "Derived from ClinicalTrials.gov eligibility module.",
      qaStatus: "needs_review",
      protocolSource: `ClinicalTrials.gov ${nctId}`,
      criterionCategory: "clinical",
      countsTowardAutomationReadiness: true,
      source: "clinicaltrials_gov",
      sourceText: maximumAge,
      sectionLabel: "Eligibility module",
    }));
  }

  if (sex && sex.toLowerCase() !== "all") {
    drafts.push(withCompiledMetadata({
      id: `${trialId}-structured-sex`,
      trialId,
      label: "Sex eligibility",
      type: "inclusion",
      computability: "deterministic",
      threshold: `Eligible sex: ${sex}`,
      owner: "Protocol review",
      note: "Derived from ClinicalTrials.gov eligibility module.",
      qaStatus: "needs_review",
      protocolSource: `ClinicalTrials.gov ${nctId}`,
      criterionCategory: "clinical",
      countsTowardAutomationReadiness: true,
      source: "clinicaltrials_gov",
      sourceText: sex,
      sectionLabel: "Eligibility module",
    }));
  }

  if (isTruthyEligibilityFlag(healthyVolunteers)) {
    const healthyVolunteerText = asText(healthyVolunteers);
    drafts.push(withCompiledMetadata({
      id: `${trialId}-structured-healthy-volunteers`,
      trialId,
      label: "Healthy volunteer allowance",
      type: "inclusion",
      computability: "manual_only",
      threshold: `Healthy volunteers: ${healthyVolunteerText}`,
      owner: "Protocol review",
      note: "Derived from ClinicalTrials.gov eligibility module.",
      qaStatus: "needs_review",
      protocolSource: `ClinicalTrials.gov ${nctId}`,
      criterionCategory: "administrative",
      countsTowardAutomationReadiness: false,
      source: "clinicaltrials_gov",
      sourceText: healthyVolunteerText,
      sectionLabel: "Eligibility module",
    }));
  }

  return drafts;
}

function buildCriteriaDrafts(
  nctId: string,
  trialId: string,
  eligibilityText: string,
  eligibilityModule: Record<string, unknown>,
): ImportedCriterionDraft[] {
  const sections = splitEligibilitySections(eligibilityText);
  const sectionRows: Array<{ type: "inclusion" | "exclusion"; label: string; items: string[] }> = [
    { type: "inclusion", label: "Inclusion criteria", items: sections.inclusion },
    { type: "exclusion", label: "Exclusion criteria", items: sections.exclusion },
  ];

  const drafts = sectionRows.flatMap(({ type, label, items }) =>
    items.map((item, index) => {
      const computability = inferComputability(item);
      const temporalWindow = detectTimingMention(item);
      const conceptTags = inferConceptTags(item);
      const criterionCategory = classifyCriterionCategory(item);

      return withCompiledMetadata({
        id: `${trialId}-${type}-${String(index + 1).padStart(3, "0")}`,
        trialId,
        label: item.length > 92 ? `${item.slice(0, 89)}...` : item,
        type,
        computability,
        threshold: item,
        owner: "Protocol review",
        note: noteForCriterionCategory(criterionCategory),
        conceptTags: conceptTags.length > 0 ? conceptTags : undefined,
        temporalAnchor: temporalWindow ? "screening" : undefined,
        temporalWindow,
        qaStatus: computability === "manual_only" ? "manual_only" : "needs_review",
        protocolSource: `ClinicalTrials.gov ${nctId}`,
        criterionCategory,
        countsTowardAutomationReadiness:
          countsTowardAutomationReadiness(criterionCategory),
        source: "clinicaltrials_gov",
        sourceText: item,
        sectionLabel: label,
      } satisfies ImportedCriterionDraft);
    }),
  );

  return [
    ...buildStructuredEligibilityCriteria(nctId, trialId, eligibilityModule),
    ...drafts.filter((draft) => draft.criterionCategory !== "tautology"),
  ];
}

function inferScreeningIntent(
  protocolSection: Record<string, unknown>,
  eligibilityText: string,
  criteria: ImportedCriterionDraft[],
): Pick<
  ImportedTrialProjection,
  "screeningIntent" | "automationBlockerReason"
> {
  const designModule = asRecord(protocolSection.designModule) ?? {};
  const designInfo = asRecord(designModule.designInfo) ?? {};
  const descriptionModule = asRecord(protocolSection.descriptionModule) ?? {};
  const studyType = asText(designModule.studyType).toUpperCase();
  const timePerspective = asText(designInfo.timePerspective).toUpperCase();
  const observationalModel = asText(designInfo.observationalModel).toUpperCase();
  const descriptionText = normalizeWhitespace(
    [
      asText(descriptionModule.briefSummary),
      asText(descriptionModule.detailedDescription),
      eligibilityText,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const retrospectiveSignals =
    /(retrospective|existing clinical data|no new procedures|case series|expanded access|previously collected during standard patient care)/i.test(
      descriptionText,
    );
  const readinessCriteria = criteria.filter(
    (criterion) => criterion.countsTowardAutomationReadiness !== false,
  );
  const hasAutomatableClinicalCriteria = readinessCriteria.some(
    (criterion) =>
      criterion.computability !== "manual_only" &&
      criterion.ruleKind !== "manual_review",
  );
  const hasOnlyNonClinicalCriteria = readinessCriteria.length === 0;

  if (
    studyType === "OBSERVATIONAL" &&
    timePerspective === "RETROSPECTIVE" &&
    (observationalModel === "CASE_ONLY" || retrospectiveSignals) &&
    (hasOnlyNonClinicalCriteria || !hasAutomatableClinicalCriteria)
  ) {
    return {
      screeningIntent: "retrospective_manual_only",
      automationBlockerReason:
        "Retrospective observational cohort with administrative/manual eligibility; not suitable for automated prospective prescreening from registry text.",
    };
  }

  return {
    screeningIntent: "prospective_prescreening",
  };
}

function buildProjection(
  rawStudy: Record<string, unknown>,
  fetchedAt: string,
  previousRecord?: ImportedTrialRecord,
): ImportedTrialRecord {
  const protocolSection = (rawStudy.protocolSection as Record<string, unknown> | undefined) ?? {};
  const identificationModule =
    (protocolSection.identificationModule as Record<string, unknown> | undefined) ?? {};
  const conditionsModule =
    (protocolSection.conditionsModule as Record<string, unknown> | undefined) ?? {};
  const designModule =
    (protocolSection.designModule as Record<string, unknown> | undefined) ?? {};
  const contactsLocationsModule =
    (protocolSection.contactsLocationsModule as Record<string, unknown> | undefined) ?? {};
  const sponsorCollaboratorsModule =
    (protocolSection.sponsorCollaboratorsModule as Record<string, unknown> | undefined) ?? {};
  const eligibilityModule =
    (protocolSection.eligibilityModule as Record<string, unknown> | undefined) ?? {};
  const statusModule =
    (protocolSection.statusModule as Record<string, unknown> | undefined) ?? {};

  const nctId = sanitizeNctId(identificationModule.nctId);
  const trialId = `ctg-${nctId}`;
  const title =
    asText(identificationModule.officialTitle) ||
    asText(identificationModule.briefTitle) ||
    nctId;
  const conditions = arrayify(conditionsModule.conditions)
    .map((item) => asText(item))
    .filter(Boolean);
  const phases = arrayify(designModule.phases)
    .map((item) => asText(item))
    .filter(Boolean);
  const overallOfficials = arrayify(
    contactsLocationsModule.overallOfficials as Record<string, unknown>[] | undefined,
  );
  const centralContacts = arrayify(
    contactsLocationsModule.centralContacts as Record<string, unknown>[] | undefined,
  );
  const leadSponsor =
    (sponsorCollaboratorsModule.leadSponsor as Record<string, unknown> | undefined) ?? {};
  const sponsorName = asText(leadSponsor.name);
  const principalInvestigator =
    asText((overallOfficials[0] as Record<string, unknown> | undefined)?.name) ||
    asText((centralContacts[0] as Record<string, unknown> | undefined)?.name) ||
    sponsorName ||
    "Needs local owner";
  const overallStatus = asText(statusModule.overallStatus) || "Unknown";
  const lastUpdateDate =
    asText(
      (
        statusModule.lastUpdatePostDateStruct as Record<string, unknown> | undefined
      )?.date,
    ) ||
    asText(
      (
        statusModule.statusVerifiedDateStruct as Record<string, unknown> | undefined
      )?.date,
    ) ||
    fetchedAt.split("T")[0];
  const eligibilityText = asText(eligibilityModule.eligibilityCriteria);
  const timingMention = detectTimingMention(eligibilityText);
  const screeningWindowSource = timingMention
    ? `Registry eligibility mentions ${timingMention}`
    : undefined;
  const criteria = buildCriteriaDrafts(
    nctId,
    trialId,
    eligibilityText,
    eligibilityModule,
  );
  const { screeningIntent, automationBlockerReason } = inferScreeningIntent(
    protocolSection,
    eligibilityText,
    criteria,
  );
  const version = `Registry snapshot ${lastUpdateDate}`;

  const projection: ImportedTrialProjection = {
    id: trialId,
    shortCode: nctId,
    title,
    diseaseArea: inferDiseaseArea(conditions),
    phase: phases.length > 0 ? phases.join(", ") : "Not reported",
    localStatus: "review",
    activationState: "Imported from ClinicalTrials.gov; local activation unverified",
    protocolVersion: version,
    pi: principalInvestigator,
    screeningWindow: screeningWindowSource ?? "Needs protocol review",
    releaseState: "Draft import",
    nctId,
    source: "clinicaltrials_gov",
    importedAt: fetchedAt,
    sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
    sponsorName: sponsorName || undefined,
    registryOverallStatus: overallStatus,
    conditions,
    eligibilityRawText: eligibilityText,
    criteriaCount: criteria.length,
    onboardingState: "draft_import",
    screeningWindowSource,
    screeningIntent,
    automationBlockerReason,
    linkedInstitutionalTrialId: previousRecord?.projection.linkedInstitutionalTrialId,
    promotionState:
      previousRecord?.projection.linkedInstitutionalTrialId != null ? "linked" : "not_promoted",
    promotedAt: previousRecord?.projection.promotedAt,
  };

  const versions: ImportedTrialVersionDraft[] = [
    {
      id: `${trialId}-version-001`,
      trialId,
      version,
      releasedAt: lastUpdateDate,
      summary:
        "Draft onboarding snapshot imported from ClinicalTrials.gov. Local protocol packet and site activation still need verification.",
      status: "Draft import",
      source: "clinicaltrials_gov",
    },
  ];

  return {
    nctId,
    fetchedAt,
    sourceUrl: `https://clinicaltrials.gov/api/v2/studies/${nctId}`,
    importStatus: "ready",
    latestNormalizationJobId: previousRecord?.latestNormalizationJobId,
    normalizationStatus: previousRecord?.normalizationStatus ?? "draft",
    normalizationReviewState:
      previousRecord?.normalizationReviewState ?? "not_started",
    projection,
    criteria,
    versions,
    normalizationJobs: previousRecord?.normalizationJobs ?? [],
    rawStudy,
  };
}

function normalizeImportedTrialRecord(
  record: ImportedTrialRecord,
): ImportedTrialRecord {
  const rawStudy = asRecord(record.rawStudy);
  if (!rawStudy || record.importStatus !== "ready") {
    return record;
  }

  return buildProjection(rawStudy, record.fetchedAt, record);
}

async function persistImportedTrialsStore(
  payload: ImportedTrialsRuntimePayload,
): Promise<ImportedTrialsRuntimePayload> {
  await writeJsonFile(runtimeFile, payload);
  return payload;
}

export async function readImportedTrialsStore(): Promise<ImportedTrialsRuntimePayload> {
  const parsed = await readJsonFile<ImportedTrialsRuntimePayload>(runtimeFile);
  const payload = parsed ?? { updatedAt: null, items: [] };
  const normalizedItems = payload.items.map(normalizeImportedTrialRecord);

  if (JSON.stringify(normalizedItems) !== JSON.stringify(payload.items)) {
    return persistImportedTrialsStore({
      updatedAt: payload.updatedAt,
      items: normalizedItems,
    });
  }

  return {
    updatedAt: payload.updatedAt,
    items: normalizedItems,
  };
}

export async function writeImportedTrialsStore(
  items: ImportedTrialRecord[],
): Promise<ImportedTrialsRuntimePayload> {
  const payload: ImportedTrialsRuntimePayload = {
    updatedAt: new Date().toISOString(),
    items,
  };
  return persistImportedTrialsStore(payload);
}

export async function getImportedTrialRecordByTrialId(
  trialId: string,
): Promise<ImportedTrialRecord | null> {
  const payload = await readImportedTrialsStore();
  return (
    payload.items.find((item) => item.projection.id === trialId) ??
    payload.items.find((item) => item.nctId === sanitizeNctId(trialId)) ??
    null
  );
}

export async function getImportedTrialRecordByLinkedInstitutionalTrialId(
  institutionalTrialId: string,
): Promise<ImportedTrialRecord | null> {
  const payload = await readImportedTrialsStore();
  return (
    payload.items.find(
      (item) => item.projection.linkedInstitutionalTrialId === institutionalTrialId,
    ) ?? null
  );
}

export async function getImportedNormalizationJobById(
  jobId: string,
): Promise<{ record: ImportedTrialRecord; job: NormalizationJob } | null> {
  const payload = await readImportedTrialsStore();
  for (const record of payload.items) {
    const job = record.normalizationJobs.find((candidate) => candidate.id === jobId);
    if (job) {
      return { record, job };
    }
  }
  return null;
}

export async function updateImportedNormalizationJob(
  jobId: string,
  mutate: (record: ImportedTrialRecord, job: NormalizationJob) => ImportedTrialRecord,
): Promise<ImportedTrialRecord> {
  const payload = await readImportedTrialsStore();
  const record = payload.items.find((item) =>
    item.normalizationJobs.some((job) => job.id === jobId),
  );
  if (!record) {
    throw new Error(`Normalization job ${jobId} was not found on an imported trial.`);
  }

  const job = record.normalizationJobs.find((candidate) => candidate.id === jobId);
  if (!job) {
    throw new Error(`Normalization job ${jobId} was not found on an imported trial.`);
  }

  const nextRecord = mutate(record, job);
  await writeImportedTrialsStore(upsertImportedRecord(payload.items, nextRecord));
  return nextRecord;
}

export async function linkImportedTrialToInstitutionalDraft(
  trialId: string,
  institutionalTrialId: string,
): Promise<ImportedTrialRecord> {
  const payload = await readImportedTrialsStore();
  const record = payload.items.find((item) => item.projection.id === trialId);
  if (!record) {
    throw new Error(`Imported trial ${trialId} was not found.`);
  }

  const linkedRecord: ImportedTrialRecord = {
    ...record,
    normalizationStatus: "approved",
    normalizationReviewState: "promoted",
    projection: {
      ...record.projection,
      linkedInstitutionalTrialId: institutionalTrialId,
      promotionState: "linked",
      promotedAt: new Date().toISOString(),
    },
  };

  await writeImportedTrialsStore(
    payload.items.map((item) =>
      item.projection.id === trialId ? linkedRecord : item,
    ),
  );

  return linkedRecord;
}

function buildImportedDeterministicCriteria(
  record: ImportedTrialRecord,
  jobId: string,
): NormalizedCriterion[] {
  return record.criteria.map((criterion) =>
    compileCriterionForScreening({
      ...criterion,
      trialId: record.projection.id,
      normalizationJobId: jobId,
      normalizationSource: "deterministic_seed",
      sourceLocation: criterion.sourceLocation ?? record.projection.sourceUrl,
      deterministicParseOutput:
        criterion.deterministicParseOutput ?? criterion.sourceText ?? criterion.threshold,
    }),
  );
}

function mapImportedLlmCriteria(
  trialId: string,
  jobId: string,
  criteria: DecompositionResponse["criteria"],
): NormalizedCriterion[] {
  return criteria.map((criterion, index) =>
    compileCriterionForScreening({
      id: `norm-${trialId}-${String(index + 1).padStart(3, "0")}`,
      trialId,
      label: criterion.label,
      type: criterion.type,
      computability: criterion.computability,
      threshold: criterion.threshold,
      owner: "LLM normalization",
      note:
        criterion.reviewNote ??
        "LLM-assisted normalization candidate generated from imported registry text.",
      conceptTags: criterion.normalizedConcepts,
      temporalAnchor: undefined,
      temporalWindow: undefined,
      qaStatus:
        criterion.computability === "manual_only" ? "manual_only" : "needs_review",
      protocolSource: criterion.source.pageRef,
      normalizationConfidence: criterion.confidence,
      sourceText: criterion.source.originalText,
      sourceLocation: criterion.source.pageRef,
      llmNormalizedOutput: JSON.stringify(criterion),
      normalizationJobId: jobId,
      normalizationSource: "llm_assisted",
      countsTowardAutomationReadiness: true,
    }),
  );
}

function reviewGateForImportedCriteria(
  criteria: NormalizedCriterion[],
): ReviewGate {
  return criteria.some((criterion) => criterion.computability === "manual_only")
    ? "policy_locked_manual_only"
    : "human_required";
}

function upsertImportedRecord(
  items: ImportedTrialRecord[],
  record: ImportedTrialRecord,
): ImportedTrialRecord[] {
  return items.map((item) =>
    item.projection.id === record.projection.id ? record : item,
  );
}

export async function normalizeImportedTrial(
  trialId: string,
  runtimeMode: "demo" | "live" | undefined,
): Promise<{ importedRecord: ImportedTrialRecord; normalizationJob: NormalizationJob }> {
  const payload = await readImportedTrialsStore();
  const record = payload.items.find((item) => item.projection.id === trialId);
  if (!record) {
    throw new Error(`Imported trial ${trialId} was not found.`);
  }

  const startedAt = new Date().toISOString();
  const jobId = `normalization-job-${trialId}-${Date.now()}`;
  const deterministicCriteria = buildImportedDeterministicCriteria(record, jobId);

  let llmCriteria: NormalizedCriterion[] = [];
  let status: NormalizationJobStatus = "needs_review";
  let provider: string | undefined;
  let model: string | undefined;
  let modelRunId: string | undefined;
  let warnings: string[] = [];
  let errorMessage: string | undefined;

  try {
    const result = await getServerLlmGateway().generate({
      featureKey: DECOMPOSE_PROTOCOL_FEATURE_KEY,
      promptVersion: NORMALIZATION_PROMPT_VERSION,
      runtimeMode,
      system: DECOMPOSE_PROTOCOL_SYSTEM,
      user: buildDecomposeProtocolUserPrompt(record.projection.eligibilityRawText),
      schema: DecompositionResponseSchema,
      temperature: 0,
      maxTokens: 2400,
    });

    llmCriteria = mapImportedLlmCriteria(record.projection.id, jobId, result.value.criteria);
    provider = result.provider;
    model = result.model;
    modelRunId = result.modelRunId;
    warnings = [
      "Imported normalization produced a review draft. Human review and approval are required before promotion into the institutional catalog.",
    ];
  } catch (error) {
    status = "error";
    errorMessage = error instanceof Error ? error.message : "Normalization failed.";
    warnings = [
      "LLM-assisted normalization failed; the imported draft keeps its deterministic import criteria until a new draft is generated.",
    ];
  }

  const finalCriteria = llmCriteria.length > 0 ? llmCriteria : deterministicCriteria;
  const completedAt = new Date().toISOString();
  const normalizationJob: NormalizationJob = {
    id: jobId,
    trialId,
    status,
    normalizationSource: llmCriteria.length > 0 ? "llm_assisted" : "deterministic_seed",
    reviewGate: reviewGateForImportedCriteria(finalCriteria),
    sourceText: record.projection.eligibilityRawText,
    sourceLocation: record.projection.sourceUrl,
    deterministicCriteria,
    llmNormalizedCriteria: llmCriteria,
    finalCriteria,
    promptVersion: NORMALIZATION_PROMPT_VERSION,
    modelRunId,
    provider,
    model,
    warnings,
    errorMessage,
    startedAt,
    completedAt,
  };

  const nextRecord: ImportedTrialRecord = {
    ...record,
    latestNormalizationJobId: normalizationJob.id,
    normalizationStatus: normalizationJob.status,
    normalizationReviewState:
      normalizationJob.status === "error" ? record.normalizationReviewState : "needs_review",
    normalizationJobs: [...record.normalizationJobs, normalizationJob],
  };

  await writeImportedTrialsStore(upsertImportedRecord(payload.items, nextRecord));

  return {
    importedRecord: nextRecord,
    normalizationJob,
  };
}

async function fetchClinicalTrialStudy(nctId: string): Promise<Record<string, unknown>> {
  const response = await fetch(
    `https://clinicaltrials.gov/api/v2/studies/${encodeURIComponent(nctId)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "clinical-trial-pre-screener/1.0",
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No ClinicalTrials.gov study was found for ${nctId}.`);
    }

    throw new Error(
      `ClinicalTrials.gov request failed for ${nctId}: HTTP ${response.status}.`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

async function importClinicalTrialByNctId(
  nctId: string,
): Promise<ImportedTrialRecord> {
  const fetchedAt = new Date().toISOString();
  const rawStudy = await fetchClinicalTrialStudy(nctId);
  const store = await readImportedTrialsStore();
  const existingRecord = store.items.find((item) => item.nctId === sanitizeNctId(nctId));
  const imported = buildProjection(rawStudy, fetchedAt, existingRecord);
  const nextItems = [
    imported,
    ...store.items.filter((item) => item.nctId !== imported.nctId),
  ];
  await writeImportedTrialsStore(nextItems);
  return imported;
}

export async function handleTrialImportApiRequest({
  request,
  response,
  path,
  url,
  readBody,
}: TrialImportRequestContext): Promise<boolean> {
  if (!path.startsWith("/trials/imports")) {
    return false;
  }

  try {
    if (request.method === "GET" && path === "/trials/imports") {
      const payload = await readImportedTrialsStore();
      sendJson(response, 200, {
        updatedAt: payload.updatedAt,
        items: payload.items.map(toListItem),
      });
      return true;
    }

    if (request.method === "POST" && path === "/trials/imports/clinicaltrialsgov") {
      const body = ((await readBody(request)) ?? {}) as { nctId?: string };
      const nctId = sanitizeNctId(body.nctId);
      assertValidNctId(nctId);
      const record = await importClinicalTrialByNctId(nctId);
      sendJson(response, 200, record);
      return true;
    }

    const normalizeMatch = path.match(/^\/trials\/imports\/([^/]+)\/normalize$/);
    if (request.method === "POST" && normalizeMatch) {
      const runtimeMode = url.searchParams.get("runtimeMode");
      const importedTrialId = decodeURIComponent(normalizeMatch[1]);
      const normalized = await normalizeImportedTrial(
        importedTrialId,
        runtimeMode === "demo" || runtimeMode === "live" ? runtimeMode : undefined,
      );

      sendJson(response, 200, normalized);
      return true;
    }

    const deprecatedPromoteMatch = path.match(/^\/trials\/imports\/([^/]+)\/promote-and-normalize$/);
    if (request.method === "POST" && deprecatedPromoteMatch) {
      const importedTrialId = decodeURIComponent(deprecatedPromoteMatch[1]);
      const importedRecord = await getImportedTrialRecordByTrialId(importedTrialId);
      if (!importedRecord) {
        sendJson(response, 404, { error: "Imported trial not found." });
        return true;
      }

      sendJson(response, 409, {
        error:
          "Imported trials now require human review before promotion. Run /normalize first, review the draft in Trial Admin, then approve and promote it.",
      });
      return true;
    }

    const rawMatch = path.match(/^\/trials\/imports\/(NCT\d{8})\/raw$/i);
    if (request.method === "GET" && rawMatch) {
      const payload = await readImportedTrialsStore();
      const record = payload.items.find(
        (item) => item.nctId === sanitizeNctId(rawMatch[1]),
      );
      if (!record) {
        sendJson(response, 404, { error: "Imported trial not found." });
        return true;
      }

      sendJson(response, 200, record.rawStudy);
      return true;
    }

    const detailMatch = path.match(/^\/trials\/imports\/(NCT\d{8})$/i);
    if (request.method === "GET" && detailMatch) {
      const payload = await readImportedTrialsStore();
      const record = payload.items.find(
        (item) => item.nctId === sanitizeNctId(detailMatch[1]),
      );
      if (!record) {
        sendJson(response, 404, { error: "Imported trial not found." });
        return true;
      }

      sendJson(response, 200, record);
      return true;
    }
  } catch (error) {
    sendJson(response, 500, {
      error:
        error instanceof Error ? error.message : "Unknown trial import error",
      path,
      query: Object.fromEntries(url.searchParams.entries()),
    });
    return true;
  }

  return false;
}
