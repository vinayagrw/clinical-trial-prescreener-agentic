import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ASSESS_ELIGIBILITY_FEATURE_KEY,
  ASSESS_ELIGIBILITY_SYSTEM,
  buildAssessEligibilityUserPrompt,
} from "../../src/lib/ai/prompts/assessEligibility.ts";
import {
  EVALUATE_CRITERION_FEATURE_KEY,
  EVALUATE_CRITERION_SYSTEM,
  buildEvaluateCriterionUserPrompt,
  type EvaluationEvidence,
} from "../../src/lib/ai/prompts/evaluateCriterion.ts";
import {
  EligibilityAssessmentSchema,
  VerdictSchema,
  type CriterionEligibility,
} from "../../src/lib/ai/schemas.ts";
import {
  buildCriterionAssessment,
  buildPatientEvidenceBundle,
  evaluateCriterionAgainstBundle,
  summarizeTrialAutomationReadiness,
  toEvaluationEvidence,
} from "../../src/lib/screening/patientTrialEvaluator.ts";
import { usePatientCatalogStore } from "../../src/stores/patientCatalog.ts";
import type {
  CriterionAdjudication,
  CriterionAssessment,
  LlmSuggestion,
  MatchStatus,
  NormalizedCriterion,
  PatientClinicalRecord,
  ReviewGate,
  ScreeningRunResponse,
} from "../../src/types/clinical.ts";
import { getPatientCatalogRuntimeStore } from "./patientCatalog.ts";
import {
  getInstitutionalCriteriaVersion,
} from "./institutionalTrials.ts";
import { getServerLlmGateway, type ServerProviderAttempt } from "./llmGateway.ts";
import {
  resolveCanonicalInstitutionalTrialReference,
  TrialCatalogWorkflowError,
} from "./trialCatalogManagement.ts";

interface ScreeningRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
  url: URL;
  readBody: (request: IncomingMessage) => Promise<unknown>;
}

interface ScreenRequestBody {
  screeningMode?: "deterministic_first" | "full_record_llm";
  runtimeMode?: "demo" | "live";
}

interface AdjudicateRequestBody {
  patientId?: string;
  trialId?: string;
  runtimeMode?: "demo" | "live";
}

const F3_PROMPT_VERSION = "f3.server.adjudicate.v1";
const F6_PROMPT_VERSION = "f6.server.assess.v1";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function makeAdjudicationId(
  patientId: string,
  trialId: string,
  criterionId: string,
): string {
  return `adjudication-${patientId}-${trialId}-${criterionId}-${Date.now()}`;
}

function reviewGateForCriterion(
  criterion: NormalizedCriterion,
  status: MatchStatus,
): ReviewGate {
  if (criterion.computability === "manual_only") {
    return "policy_locked_manual_only";
  }
  if (status === "uncertain" || status === "manual_review") {
    return "human_required";
  }
  return "human_optional";
}

function toAiCriterion(criterion: NormalizedCriterion) {
  return {
    id: criterion.id,
    label: criterion.label,
    type: criterion.type,
    computability: criterion.computability,
    threshold: criterion.threshold,
    confidence: criterion.normalizationConfidence ?? "medium",
    source: {
      pageRef: criterion.protocolSource ?? criterion.sourceLocation ?? "Institutional protocol",
      originalText: criterion.sourceText ?? criterion.threshold,
    },
    normalizedConcepts: criterion.conceptTags ?? [],
  } as const;
}

function toLlmSuggestion(
  criterionResult: CriterionEligibility,
  provider: string,
  model: string,
  promptVersion: string,
  modelRunId: string,
): LlmSuggestion {
  return {
    suggestedStatus: criterionResult.status,
    reasoning: criterionResult.reasoning,
    citations: criterionResult.citations,
    uncertaintyReason: criterionResult.uncertaintyReason,
    temporalAnalysis: criterionResult.temporalAnalysis,
    negationAnalysis: criterionResult.negationAnalysis,
    fuzzyResolution: criterionResult.fuzzyResolution,
    confidence:
      criterionResult.status === "pass" || criterionResult.status === "fail"
        ? "high"
        : "medium",
    provider,
    model,
    promptVersion,
    modelRunId,
    completedAt: new Date().toISOString(),
  };
}

function toAdjudicationSuggestion(
  verdict: {
    status: MatchStatus;
    reasoning: string;
    citations: Array<{
      evidenceId: string;
      source: string;
      sourceDate: string;
      excerpt: string;
    }>;
    uncertaintyReason?: CriterionAssessment["uncertaintyReason"];
  },
  provider: string,
  model: string,
  promptVersion: string,
  modelRunId: string,
): LlmSuggestion {
  return {
    suggestedStatus: verdict.status,
    reasoning: verdict.reasoning,
    citations: verdict.citations,
    uncertaintyReason: verdict.uncertaintyReason,
    confidence:
      verdict.status === "pass" || verdict.status === "fail" ? "high" : "medium",
    provider,
    model,
    promptVersion,
    modelRunId,
    completedAt: new Date().toISOString(),
  };
}

function hydratePatientStore(): Promise<void> {
  return getPatientCatalogRuntimeStore().then((payload) => {
    usePatientCatalogStore.getState().hydrate(payload);
  });
}

function buildDeterministicOutcome(
  evaluation: ReturnType<typeof evaluateCriterionAgainstBundle>,
) {
  return {
    mode: evaluation.mode,
    status: evaluation.status,
    reasoning: evaluation.reasoning,
    freshness: evaluation.freshness,
    evidenceIds: evaluation.evidenceIds,
    uncertaintyReason: evaluation.uncertaintyReason,
  };
}

function shouldAdjudicate(
  criterion: NormalizedCriterion,
  assessment: CriterionAssessment,
): boolean {
  return (
    criterion.computability === "manual_only" ||
    assessment.status === "uncertain" ||
    assessment.status === "manual_review" ||
    assessment.reviewRequired
  );
}

function mapEligibilityAssessmentToCriterion(
  criterion: NormalizedCriterion,
  criterionResult: CriterionEligibility,
  provider: string,
  model: string,
  promptVersion: string,
  modelRunId: string,
): CriterionAssessment {
  const reviewGate =
    criterion.computability === "manual_only"
      ? "policy_locked_manual_only"
      : reviewGateForCriterion(criterion, criterionResult.status);
  const operationalStatus =
    criterion.computability === "manual_only"
      ? "manual_review"
      : criterionResult.status;

  return {
    id: criterion.id,
    label: criterion.label,
    bucket:
      criterion.type === "inclusion" ? "Inclusion fit" : "Exclusion pressure",
    status: operationalStatus,
    confidenceLabel: provider === "demo" ? "Demo fixture" : "LLM adjudicated",
    computability: criterion.computability,
    summary: criterionResult.reasoning,
    reviewRequired:
      reviewGate !== "human_optional" ||
      operationalStatus === "uncertain" ||
      operationalStatus === "manual_review",
    freshness:
      criterionResult.uncertaintyReason === "stale_data" ? "stale" : "fresh",
    reasoning: criterionResult.reasoning,
    uncertaintyReason: criterionResult.uncertaintyReason,
    evidenceIds: criterionResult.citations.map((citation) => citation.evidenceId),
    thresholdLabel: criterion.threshold,
    lastEvaluatedAt: new Date().toISOString(),
    supportingEvidenceCount: criterionResult.citations.length,
    contradictingEvidenceCount: 0,
    llmSuggestion: toLlmSuggestion(
      criterionResult,
      provider,
      model,
      promptVersion,
      modelRunId,
    ),
    reviewGate,
    normalizationSource: criterion.normalizationSource,
    promptVersion,
    modelRunId,
  };
}

async function adjudicateCriterion(
  patientId: string,
  trialId: string,
  criterion: NormalizedCriterion,
  _record: PatientClinicalRecord,
  aiEvidence: EvaluationEvidence[],
  runtimeMode: "demo" | "live" | undefined,
): Promise<CriterionAdjudication> {
  const attempts: ServerProviderAttempt[] = [];
  const result = await getServerLlmGateway().generate({
    featureKey: EVALUATE_CRITERION_FEATURE_KEY,
    promptVersion: F3_PROMPT_VERSION,
    runtimeMode,
    system: EVALUATE_CRITERION_SYSTEM,
    user: buildEvaluateCriterionUserPrompt(
      toAiCriterion(criterion),
      aiEvidence.length > 0 ? aiEvidence : toEvaluationEvidence(buildPatientEvidenceBundle(patientId)),
    ),
    schema: VerdictSchema,
    temperature: 0,
    maxTokens: 1600,
    onAttempt: (attempt) => attempts.push(attempt),
  });

  const llmSuggestion = toAdjudicationSuggestion(
    result.value,
    result.provider,
    result.model,
    result.promptVersion,
    result.modelRunId,
  );
  const operationalStatus =
    criterion.computability === "manual_only"
      ? "manual_review"
      : result.value.status;
  const reviewGate = reviewGateForCriterion(criterion, operationalStatus);

  return {
    id: makeAdjudicationId(patientId, trialId, criterion.id),
    criterionId: criterion.id,
    patientId,
    trialId,
    operationalStatus,
    reviewGate,
    llmSuggestion,
    finalReasoning: result.value.reasoning,
    finalCitationIds: result.value.citations.map((citation) => citation.evidenceId),
    promptVersion: result.promptVersion,
    modelRunId: result.modelRunId,
    createdAt: new Date().toISOString(),
  };
}

export async function screenPatientAgainstInstitutionalTrial(input: {
  patientId: string;
  trialId: string;
  screeningMode: "deterministic_first" | "full_record_llm";
  runtimeMode?: "demo" | "live";
}): Promise<ScreeningRunResponse> {
  await hydratePatientStore();

  const startedAt = new Date().toISOString();
  const resolvedTrial = await resolveCanonicalInstitutionalTrialReference(input.trialId);

  const criteriaVersion = await getInstitutionalCriteriaVersion(
    resolvedTrial.canonicalTrialId,
  );
  if (!criteriaVersion) {
    throw new TrialCatalogWorkflowError(
      409,
      `Trial ${resolvedTrial.canonicalTrialId} does not have an approved criteria version yet. Finish Trial Admin review before screening.`,
    );
  }

  const record = usePatientCatalogStore.getState().items.find(
    (item) => item.patient.id === input.patientId,
  )?.clinicalRecord;
  if (!record) {
    throw new Error(`Patient ${input.patientId} does not have a clinical record.`);
  }

  const screeningDate = new Date().toISOString().slice(0, 10);
  const providerAttempts: ServerProviderAttempt[] = [];
  const promptChars = buildAssessEligibilityUserPrompt(
    record,
    resolvedTrial.canonicalTrialId,
    criteriaVersion.criteria,
    screeningDate,
    input.patientId,
  ).length;
  const rawRecordChars = record.fullRecordText.length;
  const readiness = summarizeTrialAutomationReadiness(criteriaVersion.criteria);
  const runtimeMode = input.runtimeMode ?? getServerLlmGateway().getRuntimeMode();
  const providerOrder = getServerLlmGateway().getOrder(runtimeMode);

  if (input.screeningMode === "full_record_llm") {
    try {
      const result = await getServerLlmGateway().generate({
        featureKey: ASSESS_ELIGIBILITY_FEATURE_KEY,
        promptVersion: F6_PROMPT_VERSION,
        runtimeMode,
        system: ASSESS_ELIGIBILITY_SYSTEM,
        user: buildAssessEligibilityUserPrompt(
          record,
          resolvedTrial.canonicalTrialId,
          criteriaVersion.criteria,
          screeningDate,
          input.patientId,
        ),
        schema: EligibilityAssessmentSchema,
        temperature: 0,
        maxTokens: 3200,
        failoverOnSchemaError: true,
        onAttempt: (attempt) => providerAttempts.push(attempt),
      });

      const assessments = criteriaVersion.criteria.map((criterion) => {
        const criterionResult =
          result.value.criterionAssessments.find(
            (candidate) => candidate.criterionId === criterion.id,
          ) ??
          ({
            criterionId: criterion.id,
            label: criterion.label,
            type: criterion.type,
            status: "manual_review",
            reasoning: "The LLM response did not include this criterion.",
            citations: [],
            uncertaintyReason: "missing_domain",
          } satisfies CriterionEligibility);

        return mapEligibilityAssessmentToCriterion(
          criterion,
          criterionResult,
          result.provider,
          result.model,
          result.promptVersion,
          result.modelRunId,
        );
      });

      return {
        patientId: input.patientId,
        trialId: resolvedTrial.canonicalTrialId,
        screeningMode: input.screeningMode,
        overallEligibility: result.value.overallRecommendation,
        assessments,
        criteriaVersionId: criteriaVersion.id,
        readinessLabel: readiness.label,
        readinessDetail: readiness.detail,
        runtimeMode: result.runtimeMode,
        providerOrder,
        attemptedProviders: providerAttempts.map((attempt) => attempt.provider),
        finalProvider: result.provider,
        finalModel: result.model,
        fallbackPath: "none",
        fallbackReason: null,
        summary:
          result.runtimeMode === "demo"
            ? "Demo fixture completed the server-side Full-record assessment."
            : `Live ${result.provider} completed the server-side Full-record assessment.`,
        promptVersion: result.promptVersion,
        modelRunId: result.modelRunId,
        runStartedAt: startedAt,
        runCompletedAt: new Date().toISOString(),
        rawRecordChars,
        promptChars,
        providerAttempts,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Full-record LLM failed on the server.";
      const fallback = await screenPatientAgainstInstitutionalTrial({
        ...input,
        screeningMode: "deterministic_first",
      });
      return {
        ...fallback,
        screeningMode: "full_record_llm",
        runtimeMode,
        providerOrder,
        providerAttempts,
        attemptedProviders: providerAttempts.map((attempt) => attempt.provider),
        fallbackPath: "deterministic_first",
        fallbackReason: message,
        summary: `Full-record LLM unavailable. Fell back to deterministic-first: ${message}`,
        runStartedAt: startedAt,
        runCompletedAt: new Date().toISOString(),
        rawRecordChars,
        promptChars,
      };
    }
  }

  const patientEvidenceBundle = buildPatientEvidenceBundle(input.patientId, {
    screeningDate,
  });
  const aiEvidence = toEvaluationEvidence(patientEvidenceBundle);

  const assessments: CriterionAssessment[] = [];
  for (const criterion of criteriaVersion.criteria) {
    const deterministicEvaluation = evaluateCriterionAgainstBundle(
      criterion,
      patientEvidenceBundle,
      screeningDate,
    );
    const deterministicAssessment = buildCriterionAssessment(
      criterion,
      deterministicEvaluation,
    );

    if (!shouldAdjudicate(criterion, deterministicAssessment)) {
      assessments.push({
        ...deterministicAssessment,
        deterministicOutcome: buildDeterministicOutcome(deterministicEvaluation),
        reviewGate: reviewGateForCriterion(criterion, deterministicAssessment.status),
        normalizationSource: criterion.normalizationSource,
      });
      continue;
    }

    try {
      const adjudication = await adjudicateCriterion(
        input.patientId,
        resolvedTrial.canonicalTrialId,
        criterion,
        record,
        aiEvidence,
        runtimeMode,
      );

      assessments.push({
        ...deterministicAssessment,
        status: adjudication.operationalStatus,
        summary: adjudication.finalReasoning,
        reasoning: adjudication.finalReasoning,
        evidenceIds: adjudication.finalCitationIds,
        reviewRequired:
          adjudication.reviewGate !== "human_optional" ||
          adjudication.operationalStatus === "manual_review" ||
          adjudication.operationalStatus === "uncertain",
        uncertaintyReason:
          adjudication.llmSuggestion?.uncertaintyReason ??
          deterministicAssessment.uncertaintyReason,
        supportingEvidenceCount:
          adjudication.llmSuggestion?.citations.length ??
          deterministicAssessment.supportingEvidenceCount,
        deterministicOutcome: buildDeterministicOutcome(deterministicEvaluation),
        llmSuggestion: adjudication.llmSuggestion,
        reviewGate: adjudication.reviewGate,
        normalizationSource: criterion.normalizationSource,
        promptVersion: adjudication.promptVersion,
        modelRunId: adjudication.modelRunId,
      } satisfies CriterionAssessment);
    } catch {
      assessments.push({
        ...deterministicAssessment,
        deterministicOutcome: buildDeterministicOutcome(deterministicEvaluation),
        reviewGate: reviewGateForCriterion(criterion, deterministicAssessment.status),
        normalizationSource: criterion.normalizationSource,
      });
    }
  }

  const overallEligibility = assessments.some((assessment) => assessment.status === "fail")
    ? "not_eligible"
    : assessments.some(
          (assessment) =>
            assessment.status === "uncertain" ||
            assessment.status === "manual_review",
        )
      ? "requires_review"
      : "eligible";

  return {
    patientId: input.patientId,
    trialId: resolvedTrial.canonicalTrialId,
    screeningMode: input.screeningMode,
    overallEligibility,
    assessments,
    criteriaVersionId: criteriaVersion.id,
    readinessLabel: readiness.label,
    readinessDetail: readiness.detail,
    runtimeMode,
    providerOrder,
    attemptedProviders: [],
    finalProvider: null,
    finalModel: null,
    fallbackPath: "none",
    fallbackReason: null,
    summary:
      "Deterministic-first screening completed on the server. Unresolved and manual-only criteria received LLM suggestions when available.",
    runStartedAt: startedAt,
    runCompletedAt: new Date().toISOString(),
    rawRecordChars,
    promptChars: 0,
    providerAttempts: [],
  };
}

export async function handleScreeningApiRequest({
  request,
  response,
  path,
  readBody,
}: ScreeningRequestContext): Promise<boolean> {
  const screeningMatch = path.match(/^\/patients\/([^/]+)\/screen\/([^/]+)$/);
  if (request.method === "POST" && screeningMatch) {
    try {
      const body = ((await readBody(request)) ?? {}) as ScreenRequestBody;
      const result = await screenPatientAgainstInstitutionalTrial({
        patientId: screeningMatch[1],
        trialId: screeningMatch[2],
        screeningMode: body.screeningMode ?? "deterministic_first",
        runtimeMode:
          body.runtimeMode === "demo" || body.runtimeMode === "live"
            ? body.runtimeMode
            : undefined,
      });
      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof TrialCatalogWorkflowError) {
        sendJson(response, error.statusCode, { error: error.message });
        return true;
      }
      throw error;
    }
    return true;
  }

  const adjudicateMatch = path.match(/^\/criteria\/([^/]+)\/adjudicate$/);
  if (request.method === "POST" && adjudicateMatch) {
    const body = ((await readBody(request)) ?? {}) as AdjudicateRequestBody;
    if (!body.patientId || !body.trialId) {
      sendJson(response, 400, {
        error: "patientId and trialId are required to adjudicate a criterion.",
      });
      return true;
    }

    try {
      await hydratePatientStore();
      const resolvedTrial = await resolveCanonicalInstitutionalTrialReference(body.trialId);
      const criteriaVersion = await getInstitutionalCriteriaVersion(
        resolvedTrial.canonicalTrialId,
      );
      const criterion = criteriaVersion?.criteria.find(
        (candidate) => candidate.id === adjudicateMatch[1],
      );
      const record = usePatientCatalogStore.getState().items.find(
        (item) => item.patient.id === body.patientId,
      )?.clinicalRecord;

      if (!criterion || !record) {
        sendJson(response, 404, {
          error: "Criterion or patient record not found for adjudication.",
        });
        return true;
      }

      const aiEvidence = toEvaluationEvidence(
        buildPatientEvidenceBundle(body.patientId, {
          screeningDate: new Date().toISOString().slice(0, 10),
        }),
      );
      const adjudication = await adjudicateCriterion(
        body.patientId,
        resolvedTrial.canonicalTrialId,
        criterion,
        record,
        aiEvidence,
        body.runtimeMode === "demo" || body.runtimeMode === "live"
          ? body.runtimeMode
          : undefined,
      );
      sendJson(response, 200, adjudication);
    } catch (error) {
      if (error instanceof TrialCatalogWorkflowError) {
        sendJson(response, error.statusCode, { error: error.message });
        return true;
      }
      throw error;
    }
    return true;
  }

  return false;
}
