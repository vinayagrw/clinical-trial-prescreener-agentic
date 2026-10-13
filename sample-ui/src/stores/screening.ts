/*
 * screening store â€” deterministic-first patient-vs-trial screening pipeline.
 *
 * Imported and native trials both flow through the same preparation step:
 * build a patient evidence bundle, compile criteria, evaluate deterministic
 * rules first, and use the AI criterion evaluator only when a criterion still
 * needs fallback reasoning.
 */

import { create } from "zustand";
import type {
  CriterionAssessment,
  MatchStatus,
  NormalizedCriterion,
  ScreeningRunResponse,
} from "../types";
import type {
  DecomposedCriterionAI,
  EligibilityAssessment,
  Verdict,
} from "../lib/ai/schemas";
import { EligibilityAssessmentSchema, VerdictSchema } from "../lib/ai/schemas";
import {
  ASSESS_ELIGIBILITY_FEATURE_KEY,
  ASSESS_ELIGIBILITY_SYSTEM,
  buildAssessEligibilityUserPrompt,
} from "../lib/ai/prompts/assessEligibility";
import {
  EVALUATE_CRITERION_FEATURE_KEY,
  EVALUATE_CRITERION_SYSTEM,
  buildEvaluateCriterionUserPrompt,
} from "../lib/ai/prompts/evaluateCriterion";
import {
  buildCriterionAssessment,
  evaluateCriterionAgainstBundle,
  prepareScreeningContext,
} from "../lib/screening/patientTrialEvaluator";
import {
  applySensitivity,
  DEFAULT_SENSITIVITY,
} from "../lib/screening/sensitivityConfig";
import {
  buildConstraintGraph,
  checkTemporalConsistency,
} from "../lib/temporal/constraintGraph";
import {
  getOrchestrator,
  SchemaValidationError,
  type ProviderName,
} from "../lib/ai/providers";
import { getRuntimeMetadata } from "../lib/runtimeMetadata";
import { getEligibilityAssessmentGuard } from "../lib/safety/guards/eligibilityAssessment";
import { getEvaluationGuard } from "../lib/safety/guards/evaluation";
import { useSafetyEventsStore } from "../lib/safety/safetyEvents";
import { SafetyBlockError } from "../lib/safety/safetyGuard";
import {
  type ScreeningDiagnosticErrorCategory,
  type ScreeningDiagnosticOutcome,
  type ScreeningFallbackPath,
  type ScreeningDiagnosticRun,
  type ScreeningProviderAttempt,
  type ScreeningRuntimeMode,
  useScreeningDiagnosticsStore,
} from "./screeningDiagnostics";
import { getClinicalRecordByPatientId } from "./patientCatalog";
import { screeningApi } from "../lib/api";
import { useAiProvidersStore } from "./aiProviders";

interface ScreeningAssessment extends CriterionAssessment {
  provider?: string;
  model?: string;
  wallTimeMs?: number;
}

interface ScreeningLlmRuntimeState {
  diagnosticRunId: string | null;
  runtimeMode: ScreeningRuntimeMode | null;
  selectedProvider: ProviderName | null;
  attemptedProviders: ProviderName[];
  finalProvider: ProviderName | null;
  fallbackPath: ScreeningFallbackPath;
  fallbackReason: string | null;
  outcome: ScreeningDiagnosticOutcome | null;
  summary: string | null;
}

interface ScreeningState {
  patientId: string;
  trialId: string;
  status: "idle" | "running" | "done" | "error";
  assessments: Record<string, ScreeningAssessment>;
  currentCriterionId: string | null;
  overallEligibility: "eligible" | "not_eligible" | "requires_review" | null;
  error: string | null;
  runStartedAt: string | null;
  runCompletedAt: string | null;
  screeningMode: "deterministic_first" | "full_record_llm";
  llmRuntime: ScreeningLlmRuntimeState;
}

interface ScreeningActions {
  setPatient(id: string): void;
  setTrial(id: string): void;
  setScreeningMode(mode: "deterministic_first" | "full_record_llm"): void;
  runScreening(): Promise<void>;
  reset(): void;
}

export type ScreeningStore = ScreeningState & ScreeningActions;

interface PreparedF6Assessment {
  patientId: string;
  trialId: string;
  record: NonNullable<ReturnType<typeof getClinicalRecordByPatientId>>;
  criteria: NormalizedCriterion[];
  screeningDate: string;
  prompt: string;
  rawRecordChars: number;
  promptChars: number;
  runtimeMode: ScreeningRuntimeMode;
  providerOrder: ProviderName[];
  selectedProvider: ProviderName | null;
}

interface F6AssessmentSuccess {
  assessments: Record<string, ScreeningAssessment>;
  overallEligibility: ScreeningState["overallEligibility"];
  provider: ProviderName;
  model: string;
  wallTimeMs: number;
}

const EMPTY_LLM_RUNTIME: ScreeningLlmRuntimeState = {
  diagnosticRunId: null,
  runtimeMode: null,
  selectedProvider: null,
  attemptedProviders: [],
  finalProvider: null,
  fallbackPath: "none",
  fallbackReason: null,
  outcome: null,
  summary: null,
};

function toAiCriterion(criterion: NormalizedCriterion): DecomposedCriterionAI {
  return {
    id: criterion.id,
    label: criterion.label,
    type: criterion.type,
    computability: criterion.computability,
    threshold: criterion.threshold,
    confidence: "high",
    source: {
      pageRef: "Protocol §Eligibility",
      originalText: criterion.threshold,
    },
    normalizedConcepts: criterion.conceptTags ?? [],
  };
}

function buildErrorAssessment(
  criterion: NormalizedCriterion,
  message: string,
): ScreeningAssessment {
  return {
    id: criterion.id,
    label: criterion.label,
    bucket:
      criterion.type === "inclusion" ? "Inclusion fit" : "Exclusion pressure",
    status: "manual_review",
    confidenceLabel: "Error",
    computability: criterion.computability,
    summary: `Evaluation failed: ${message}`,
    reviewRequired: true,
    freshness: "missing",
    reasoning: `Evaluation failed: ${message}`,
    uncertaintyReason: "missing_domain",
    evidenceIds: [],
    thresholdLabel: criterion.threshold,
    lastEvaluatedAt: new Date().toISOString(),
    supportingEvidenceCount: 0,
    contradictingEvidenceCount: 0,
  };
}

function deriveOverallEligibility(
  assessments: Record<string, ScreeningAssessment>,
): ScreeningState["overallEligibility"] {
  const statuses = Object.values(assessments).map(
    (assessment) => assessment.status,
  );
  if (statuses.some((status) => status === "fail")) {
    return "not_eligible";
  }
  if (
    statuses.some(
      (status) => status === "uncertain" || status === "manual_review",
    )
  ) {
    return "requires_review";
  }
  return statuses.length > 0 ? "eligible" : null;
}

function sanitizeDiagnosticMessage(message: string | null | undefined): string {
  if (!message) return "";
  return message.replace(/\s+/g, " ").trim().slice(0, 260);
}

function sanitizeOptionalDiagnosticMessage(
  message: string | null | undefined,
): string | undefined {
  const sanitized = sanitizeDiagnosticMessage(message);
  return sanitized || undefined;
}

function classifyDiagnosticError(
  message: string | null | undefined,
  errorName?: string | null,
): ScreeningDiagnosticErrorCategory {
  const normalized = sanitizeDiagnosticMessage(message).toLowerCase();
  const normalizedName = (errorName ?? "").toLowerCase();

  if (
    normalized.includes("quota") ||
    normalized.includes("429") ||
    normalized.includes("too many requests")
  ) {
    return "quota";
  }
  if (
    normalizedName.includes("schema") ||
    normalized.includes("schema validation")
  ) {
    return "schema";
  }
  if (
    normalizedName.includes("safety") ||
    normalized.includes("safety block")
  ) {
    return "safety";
  }
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econnrefused") ||
    normalized.includes("timeout") ||
    normalized.includes("http ")
  ) {
    return "network";
  }
  if (
    normalized.includes("api key") ||
    normalized.includes("not configured") ||
    normalized.includes("missing key")
  ) {
    return "configuration";
  }
  if (normalized.includes("fallback")) {
    return "fallback";
  }
  return "unknown";
}

function formatProviderName(provider: ProviderName | null): string {
  switch (provider) {
    case "ollama":
      return "Ollama";
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Gemini";
    case "groq":
      return "Groq";
    case "anthropic":
      return "Anthropic";
    case "demo":
      return "Demo fixture";
    default:
      return "provider";
  }
}

function toProviderName(value: string | null | undefined): ProviderName | null {
  if (
    value === "ollama" ||
    value === "openai" ||
    value === "gemini" ||
    value === "groq" ||
    value === "anthropic" ||
    value === "demo"
  ) {
    return value;
  }

  return null;
}

function deriveDiagnosticOutcome(
  response: ScreeningRunResponse,
): ScreeningDiagnosticOutcome | null {
  if (response.screeningMode !== "full_record_llm") {
    return null;
  }

  if (response.fallbackPath === "demo_fixture") {
    return "live_failed_demo_fallback";
  }
  if (response.fallbackPath === "deterministic_first") {
    return "f6_failed_deterministic_fallback";
  }
  return "f6_success";
}

function buildServerDiagnosticRun(
  response: ScreeningRunResponse,
  runtimeMetadata: ReturnType<typeof getRuntimeMetadata>,
): ScreeningDiagnosticRun {
  const providerAttempts = response.providerAttempts.map(
    (attempt): ScreeningProviderAttempt => ({
      provider: toProviderName(attempt.provider) ?? "demo",
      status: attempt.status,
      runtimeMode: response.runtimeMode,
      attemptedAt: attempt.attemptedAt,
      completedAt: attempt.completedAt,
      model: attempt.model,
      wallTimeMs: attempt.wallTimeMs,
      reason: sanitizeOptionalDiagnosticMessage(attempt.reason),
      errorName: attempt.errorName,
      errorCategory: attempt.errorCategory,
      schemaPath: sanitizeOptionalDiagnosticMessage(attempt.schemaPath),
      schemaMessage: sanitizeOptionalDiagnosticMessage(attempt.schemaMessage),
      schemaSummary: sanitizeOptionalDiagnosticMessage(attempt.schemaSummary),
      schemaRawSummary: sanitizeOptionalDiagnosticMessage(attempt.schemaRawSummary),
    }),
  );
  const firstSchemaAttempt = providerAttempts.find(
    (attempt) =>
      !!attempt.schemaSummary || !!attempt.schemaPath || !!attempt.schemaMessage,
  );

  return {
    id: response.modelRunId ?? `screening-diag-${Date.now()}`,
    startedAt: response.runStartedAt,
    completedAt: response.runCompletedAt,
    patientId: response.patientId,
    trialId: response.trialId,
    screeningMode: response.screeningMode,
    runtimeMode: response.runtimeMode,
    providerOrder: response.providerOrder
      .map((provider) => toProviderName(provider))
      .filter((provider): provider is ProviderName => provider != null),
    criteriaCount: response.assessments.length,
    rawRecordChars: response.rawRecordChars,
    promptChars: response.promptChars,
    providerAttempts,
    fallbackPath: response.fallbackPath,
    fallbackReason: response.fallbackReason,
    finalProvider: toProviderName(response.finalProvider),
    finalModel: response.finalModel,
    outcome: deriveDiagnosticOutcome(response) ?? "fatal",
    summary: response.summary,
    errorMessage: response.fallbackPath === "deterministic_first" ? response.fallbackReason : null,
    schemaPath: firstSchemaAttempt?.schemaPath ?? null,
    schemaMessage: firstSchemaAttempt?.schemaMessage ?? null,
    schemaSummary:
      firstSchemaAttempt?.schemaSummary ??
      buildSchemaDetail(firstSchemaAttempt?.schemaPath, firstSchemaAttempt?.schemaMessage),
    schemaRawSummary: firstSchemaAttempt?.schemaRawSummary ?? null,
    safetyMessages: [],
    buildMode: runtimeMetadata.buildMode,
    buildStamp: runtimeMetadata.buildStamp,
    appVersion: runtimeMetadata.appVersion,
    clientPort: runtimeMetadata.clientPort,
  };
}

function toAssessmentIndex(
  assessments: CriterionAssessment[],
): Record<string, ScreeningAssessment> {
  return Object.fromEntries(
    assessments.map((assessment) => [assessment.id, assessment as ScreeningAssessment]),
  );
}

function getAttemptedProviders(runId: string): ProviderName[] {
  const run = useScreeningDiagnosticsStore
    .getState()
    .runs.find((candidate) => candidate.id === runId);
  const seen = new Set<ProviderName>();
  const ordered: ProviderName[] = [];

  for (const attempt of run?.providerAttempts ?? []) {
    if (!seen.has(attempt.provider)) {
      seen.add(attempt.provider);
      ordered.push(attempt.provider);
    }
  }

  return ordered;
}

function getPrimaryLiveProvider(
  runId: string,
  providerOrder: ProviderName[],
): ProviderName | null {
  const run = useScreeningDiagnosticsStore
    .getState()
    .runs.find((candidate) => candidate.id === runId);
  const attemptedLive = run?.providerAttempts.find(
    (attempt) => attempt.provider !== "demo",
  );

  if (attemptedLive) {
    return attemptedLive.provider;
  }

  return providerOrder.find((provider) => provider !== "demo") ?? null;
}

function getFirstSchemaFailure(runId: string): ScreeningProviderAttempt | undefined {
  return useScreeningDiagnosticsStore
    .getState()
    .runs.find((candidate) => candidate.id === runId)
    ?.providerAttempts.find(
      (attempt) =>
        !!attempt.schemaSummary || !!attempt.schemaPath || !!attempt.schemaMessage,
    );
}

function buildSchemaDetail(
  schemaPath: string | null | undefined,
  schemaMessage: string | null | undefined,
): string | null {
  const normalizedPath = sanitizeOptionalDiagnosticMessage(schemaPath);
  const normalizedMessage = sanitizeOptionalDiagnosticMessage(schemaMessage);

  if (normalizedPath && normalizedMessage) {
    return `${normalizedPath}: ${normalizedMessage}`;
  }
  return normalizedPath ?? normalizedMessage ?? null;
}

function readSchemaDiagnostics(
  error: unknown,
  runId?: string | null,
): {
  schemaPath: string | null;
  schemaMessage: string | null;
  schemaSummary: string | null;
  schemaRawSummary: string | null;
} {
  const attempt = runId ? getFirstSchemaFailure(runId) : undefined;

  const schemaPath =
    sanitizeOptionalDiagnosticMessage(
      error instanceof SchemaValidationError ? error.schemaPath : attempt?.schemaPath,
    ) ?? null;
  const schemaMessage =
    sanitizeOptionalDiagnosticMessage(
      error instanceof SchemaValidationError
        ? error.schemaMessage
        : attempt?.schemaMessage,
    ) ?? null;
  const schemaSummary =
    sanitizeOptionalDiagnosticMessage(
      error instanceof SchemaValidationError
        ? error.schemaSummary
        : attempt?.schemaSummary ?? buildSchemaDetail(schemaPath, schemaMessage),
    ) ??
    buildSchemaDetail(schemaPath, schemaMessage);
  const schemaRawSummary =
    sanitizeOptionalDiagnosticMessage(
      error instanceof SchemaValidationError
        ? error.schemaRawSummary
        : attempt?.schemaRawSummary,
    ) ?? null;

  return {
    schemaPath,
    schemaMessage,
    schemaSummary,
    schemaRawSummary,
  };
}

function captureNewSafetyMessages(initialSafetyEventIds: Set<string>): string[] {
  return useSafetyEventsStore
    .getState()
    .events.filter(
      (event) => event.feature === "F6" && !initialSafetyEventIds.has(event.id),
    )
    .map((event) => `[${event.severity}] ${event.message}`);
}

function buildQuotaFallbackSummary(
  provider: ProviderName | null,
  destination: "demo_fixture" | "deterministic_first",
): string {
  const providerLabel = formatProviderName(provider);
  const fallbackTarget =
    destination === "demo_fixture" ? "demo fixture" : "deterministic-first";

  return `Live ${providerLabel} unavailable: quota exceeded. Fell back to ${fallbackTarget}.`;
}

function buildGenericFallbackSummary(
  provider: ProviderName | null,
  destination: "demo_fixture" | "deterministic_first",
  message: string,
): string {
  const providerLabel = formatProviderName(provider);
  const fallbackTarget =
    destination === "demo_fixture" ? "demo fixture" : "deterministic-first";
  const detail = sanitizeDiagnosticMessage(message);

  if (!provider) {
    return `Full-record LLM unavailable. Fell back to ${fallbackTarget}.`;
  }

  return `Live ${providerLabel} unavailable${detail ? `: ${detail}` : ""}. Fell back to ${fallbackTarget}.`;
}

function prepareF6Assessment(
  patientId: string,
  trialId: string,
): PreparedF6Assessment {
  const record = getClinicalRecordByPatientId(patientId);
  if (!record) throw new Error(`No clinical record for patient "${patientId}"`);

  const screeningContext = prepareScreeningContext(patientId, trialId);
  const { criteria } = screeningContext;
  if (criteria.length === 0) {
    throw new Error(`No criteria for trial "${trialId}"`);
  }

  const screeningDate = new Date().toISOString().slice(0, 10);
  const prompt = buildAssessEligibilityUserPrompt(
    record,
    trialId,
    criteria,
    screeningDate,
    patientId,
  );
  const orchestrator = getOrchestrator();
  const runtimeMode: ScreeningRuntimeMode = orchestrator.isDemoMode()
    ? "demo"
    : "live";
  const providerOrder =
    runtimeMode === "demo" ? (["demo"] as ProviderName[]) : orchestrator.getOrder();

  return {
    patientId,
    trialId,
    record,
    criteria,
    screeningDate,
    prompt,
    rawRecordChars: record.fullRecordText.length,
    promptChars: prompt.length,
    runtimeMode,
    providerOrder,
    selectedProvider: providerOrder[0] ?? null,
  };
}

async function runF6Assessment(
  prepared: PreparedF6Assessment,
  diagnosticRunId: string,
): Promise<F6AssessmentSuccess> {
  const diagnostics = useScreeningDiagnosticsStore.getState();
  const orchestrator = getOrchestrator();

  const result = await orchestrator.generate<EligibilityAssessment>({
    featureKey: ASSESS_ELIGIBILITY_FEATURE_KEY,
    system: ASSESS_ELIGIBILITY_SYSTEM,
    user: prepared.prompt,
    schema: EligibilityAssessmentSchema,
    temperature: 0.1,
    maxTokens: 4096,
    failoverOnSchemaError: true,
    onAttempt: (attempt) => {
      const timestamp = new Date().toISOString();
      const errorCategory =
        attempt.status === "failed"
          ? classifyDiagnosticError(attempt.reason, attempt.errorName)
          : undefined;

      diagnostics.addProviderAttempt(diagnosticRunId, {
        provider: attempt.provider,
        status: attempt.status,
        runtimeMode: prepared.runtimeMode,
        attemptedAt: timestamp,
        completedAt: attempt.status === "started" ? undefined : timestamp,
        model: attempt.model,
        wallTimeMs: attempt.wallTimeMs,
        reason: sanitizeDiagnosticMessage(attempt.reason),
        errorName: attempt.errorName,
        errorCategory,
        schemaPath: sanitizeOptionalDiagnosticMessage(attempt.schemaPath),
        schemaMessage: sanitizeOptionalDiagnosticMessage(attempt.schemaMessage),
        schemaSummary: sanitizeOptionalDiagnosticMessage(attempt.schemaSummary),
        schemaRawSummary: sanitizeOptionalDiagnosticMessage(attempt.schemaRawSummary),
      });

      console.info("[screening:f6:attempt]", {
        provider: attempt.provider,
        status: attempt.status,
        errorCategory,
        wallTimeMs: attempt.wallTimeMs,
        schemaPath: attempt.schemaPath,
        schemaMessage: attempt.schemaMessage,
        schemaSummary: attempt.schemaSummary,
      });
    },
  });

  const safeAssessment = getEligibilityAssessmentGuard().run(result.value, {
    feature: "F6",
    featureKey: ASSESS_ELIGIBILITY_FEATURE_KEY,
    provider: result.provider,
    model: result.model,
  });

  const assessments: Record<string, ScreeningAssessment> = {};
  for (const criterionAssessment of safeAssessment.criterionAssessments) {
    assessments[criterionAssessment.criterionId] = {
      id: criterionAssessment.criterionId,
      label: criterionAssessment.label,
      bucket:
        criterionAssessment.type === "inclusion"
          ? "Inclusion fit"
          : "Exclusion pressure",
      status: criterionAssessment.status as MatchStatus,
      confidenceLabel:
        criterionAssessment.status === "pass"
          ? "High confidence"
          : criterionAssessment.status === "fail"
            ? "Clear violation"
            : "Review needed",
      computability: "hybrid",
      summary: criterionAssessment.reasoning,
      reviewRequired:
        criterionAssessment.status === "uncertain" ||
        criterionAssessment.status === "manual_review",
      freshness: "fresh",
      reasoning: criterionAssessment.reasoning,
      uncertaintyReason: criterionAssessment.uncertaintyReason as
        | ScreeningAssessment["uncertaintyReason"]
        | undefined,
      evidenceIds: criterionAssessment.citations.map(
        (citation) => citation.evidenceId,
      ),
      thresholdLabel: criterionAssessment.fuzzyResolution?.resolvedThreshold,
      lastEvaluatedAt: new Date().toISOString(),
      supportingEvidenceCount: criterionAssessment.citations.length,
      contradictingEvidenceCount: 0,
      provider: result.provider,
      model: result.model,
      wallTimeMs: result.wallTimeMs,
    };
  }

  const overallEligibility =
    safeAssessment.overallRecommendation === "eligible"
      ? "eligible"
      : safeAssessment.overallRecommendation === "not_eligible"
        ? "not_eligible"
        : "requires_review";

  return {
    assessments,
    overallEligibility,
    provider: result.provider,
    model: result.model,
    wallTimeMs: result.wallTimeMs,
  };
}

export const useScreeningStore = create<ScreeningStore>()((set, get) => ({
  patientId: "",
  trialId: "",
  status: "idle",
  assessments: {},
  currentCriterionId: null,
  overallEligibility: null,
  error: null,
  runStartedAt: null,
  runCompletedAt: null,
  screeningMode: "deterministic_first",
  llmRuntime: EMPTY_LLM_RUNTIME,

  setPatient: (id) => set({ patientId: id }),
  setTrial: (id) => set({ trialId: id }),
  setScreeningMode: (mode) => set({ screeningMode: mode }),

  runScreening: async () => {
    const { patientId, trialId } = get();

    if (!trialId) {
      set({
        status: "error",
        error: "Please select a trial before running screening.",
      });
      return;
    }

    if (!patientId) {
      set({
        status: "error",
        error: "Please select a patient before running screening.",
      });
      return;
    }

    set({
      status: "running",
      assessments: {},
      currentCriterionId: null,
      overallEligibility: null,
      error: null,
      runStartedAt: new Date().toISOString(),
      runCompletedAt: null,
      llmRuntime: EMPTY_LLM_RUNTIME,
    });

    try {
      const screeningMode = get().screeningMode;
      const runtimeMetadata = getRuntimeMetadata();
      const runtimeMode = useAiProvidersStore.getState().demoMode ? "demo" : "live";
      const response = await screeningApi.runPatientTrialScreening({
        patientId,
        trialId,
        screeningMode,
        runtimeMode,
      });
      const diagnosticRun = buildServerDiagnosticRun(response, runtimeMetadata);

      useScreeningDiagnosticsStore.getState().recordRun(diagnosticRun);

      console.groupCollapsed(
        `[screening:${response.screeningMode}] ${patientId} × ${trialId} (${response.runtimeMode})`,
      );
      console.info("[screening:server:result]", {
        screeningMode: response.screeningMode,
        overallEligibility: response.overallEligibility,
        runtimeMode: response.runtimeMode,
        providerOrder: response.providerOrder,
        finalProvider: response.finalProvider,
        fallbackPath: response.fallbackPath,
        summary: response.summary,
        criteriaVersionId: response.criteriaVersionId,
      });
      console.groupEnd();

      set({
        status: "done",
        assessments: toAssessmentIndex(response.assessments),
        currentCriterionId: null,
        overallEligibility: response.overallEligibility,
        error: null,
        runCompletedAt: response.runCompletedAt,
        llmRuntime: {
          diagnosticRunId:
            response.screeningMode === "full_record_llm" ? diagnosticRun.id : null,
          runtimeMode: response.runtimeMode,
          selectedProvider: toProviderName(response.providerOrder[0]),
          attemptedProviders: response.attemptedProviders
            .map((provider) => toProviderName(provider))
            .filter((provider): provider is ProviderName => provider != null),
          finalProvider: toProviderName(response.finalProvider),
          fallbackPath: response.fallbackPath,
          fallbackReason: response.fallbackReason,
          outcome: deriveDiagnosticOutcome(response),
          summary: response.summary,
        },
      });
    } catch (error) {
      set({
        status: "error",
        currentCriterionId: null,
        error: (error as Error).message,
      });
    }
  },

  reset: () => {
    const { patientId, trialId, screeningMode } = get();
    set({
      patientId,
      trialId,
      status: "idle",
      assessments: {},
      currentCriterionId: null,
      overallEligibility: null,
      error: null,
      runStartedAt: null,
      runCompletedAt: null,
      screeningMode,
      llmRuntime: EMPTY_LLM_RUNTIME,
    });
  },
}));
