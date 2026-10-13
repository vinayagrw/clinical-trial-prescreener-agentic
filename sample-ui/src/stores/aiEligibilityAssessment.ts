/*
 * F6 AI Eligibility Assessment store — full-record patient-vs-trial
 * eligibility assessment powered by the LLM orchestrator.
 *
 * Unlike the per-criterion screening store, this store sends the entire
 * patient clinical record and all trial criteria in a single LLM call,
 * receiving back a holistic EligibilityAssessment with per-criterion
 * breakdowns, temporal/negation/fuzzy analysis, and an overall recommendation.
 *
 * The safety guard pipeline (7 checks) runs on every LLM response before
 * the result is surfaced to the UI.
 */

import { create } from "zustand";
import type {
  CriterionAssessment,
  MatchRecommendation,
  MatchStatus,
} from "../types";
import type { EligibilityAssessment } from "../lib/ai/schemas";
import { EligibilityAssessmentSchema } from "../lib/ai/schemas";
import {
  ASSESS_ELIGIBILITY_FEATURE_KEY,
  ASSESS_ELIGIBILITY_SYSTEM,
  buildAssessEligibilityUserPrompt,
} from "../lib/ai/prompts/assessEligibility";
import { getEligibilityAssessmentGuard } from "../lib/safety/guards/eligibilityAssessment";
import { getOrchestrator } from "../lib/ai/providers";
import { SafetyBlockError } from "../lib/safety/safetyGuard";
import { getClinicalRecordByPatientId } from "./patientCatalog";
import { getNormalizedCriteriaForTrial } from "../data/mockData";

// ---------------------------------------------------------------------------
// State & action interfaces
// ---------------------------------------------------------------------------

interface AiEligibilityState {
  status: "idle" | "running" | "done" | "error";
  assessment: EligibilityAssessment | null;
  criterionAssessments: CriterionAssessment[];
  matchRecommendation: MatchRecommendation | null;
  error: string | null;
  provider: string | null;
  model: string | null;
  wallTimeMs: number | null;
  runStartedAt: string | null;
  runCompletedAt: string | null;
}

interface AiEligibilityActions {
  runAssessment(patientId: string, trialId: string): Promise<void>;
  reset(): void;
}

export type AiEligibilityStore = AiEligibilityState & AiEligibilityActions;

// ---------------------------------------------------------------------------
// Converters: LLM schema types -> UI types
// ---------------------------------------------------------------------------

function toUICriterionAssessments(
  assessment: EligibilityAssessment,
): CriterionAssessment[] {
  return assessment.criterionAssessments.map((ca) => ({
    id: ca.criterionId,
    label: ca.label,
    bucket: ca.type === "inclusion" ? "Inclusion fit" : "Exclusion pressure",
    status: ca.status as MatchStatus,
    confidenceLabel:
      ca.status === "pass"
        ? "High confidence"
        : ca.status === "fail"
          ? "Clear violation"
          : "Review needed",
    computability: "hybrid" as const,
    summary: ca.reasoning,
    reviewRequired: ca.status === "uncertain" || ca.status === "manual_review",
    freshness: "fresh" as const,
    reasoning: ca.reasoning,
    uncertaintyReason: ca.uncertaintyReason as CriterionAssessment["uncertaintyReason"],
    evidenceIds: ca.citations.map((c) => c.evidenceId),
    thresholdLabel: ca.fuzzyResolution?.resolvedThreshold,
    lastEvaluatedAt: new Date().toISOString(),
    supportingEvidenceCount: ca.citations.length,
    contradictingEvidenceCount: 0,
  }));
}

function toUIMatchRecommendation(
  assessment: EligibilityAssessment,
  patientId: string,
  trialId: string,
): MatchRecommendation {
  const recommendation: MatchStatus =
    assessment.overallRecommendation === "eligible"
      ? "pass"
      : assessment.overallRecommendation === "not_eligible"
        ? "fail"
        : "uncertain";

  return {
    id: `f6-${patientId}-${trialId}`,
    patientId,
    trialId,
    recommendation,
    fitScore: assessment.fitScore,
    owner: "F6 AI Assessment",
    assignedQueue: "coordinator",
    nextStep:
      recommendation === "pass" ? "candidate_for_outreach" : "needs_pi_review",
    rationale: assessment.rationale,
    blockers: assessment.blockers,
    continuousTracking: "",
    criterionIds: assessment.criterionAssessments.map((c) => c.criterionId),
    auditIds: [],
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: AiEligibilityState = {
  status: "idle",
  assessment: null,
  criterionAssessments: [],
  matchRecommendation: null,
  error: null,
  provider: null,
  model: null,
  wallTimeMs: null,
  runStartedAt: null,
  runCompletedAt: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAiEligibilityStore = create<AiEligibilityStore>()(
  (set) => ({
    ...initialState,

    runAssessment: async (patientId: string, trialId: string) => {
      set({
        ...initialState,
        status: "running",
        runStartedAt: new Date().toISOString(),
      });

      // 1. Resolve patient clinical record
      const record = getClinicalRecordByPatientId(patientId);
      if (!record) {
        set({
          status: "error",
          error: `No clinical record found for patient "${patientId}".`,
        });
        return;
      }

      // 2. Resolve normalized criteria for the trial
      const criteria = getNormalizedCriteriaForTrial(trialId);
      if (!criteria || criteria.length === 0) {
        set({
          status: "error",
          error: `No normalized criteria found for trial "${trialId}".`,
        });
        return;
      }

      // 3. Screening date
      const screeningDate = new Date().toISOString().slice(0, 10);

      try {
        // 4. Call orchestrator
        const result = await getOrchestrator().generate<EligibilityAssessment>({
          featureKey: ASSESS_ELIGIBILITY_FEATURE_KEY,
          system: ASSESS_ELIGIBILITY_SYSTEM,
          user: buildAssessEligibilityUserPrompt(
            record,
            trialId,
            criteria,
            screeningDate,
            patientId,
          ),
          schema: EligibilityAssessmentSchema,
          temperature: 0.1,
          maxTokens: 4096,
        });

        // 5. Run safety guard pipeline
        const safeAssessment = getEligibilityAssessmentGuard().run(
          result.value,
          {
            feature: "F6",
            featureKey: ASSESS_ELIGIBILITY_FEATURE_KEY,
            provider: result.provider,
            model: result.model,
          },
        );

        // 6. Convert to UI types
        const criterionAssessments = toUICriterionAssessments(safeAssessment);
        const matchRecommendation = toUIMatchRecommendation(
          safeAssessment,
          patientId,
          trialId,
        );

        // 7. Done
        set({
          status: "done",
          assessment: safeAssessment,
          criterionAssessments,
          matchRecommendation,
          error: null,
          provider: result.provider,
          model: result.model,
          wallTimeMs: result.wallTimeMs,
          runCompletedAt: new Date().toISOString(),
        });
      } catch (error) {
        const message =
          error instanceof SafetyBlockError
            ? `Safety guard blocked F6 assessment: ${error.message}`
            : error instanceof Error
              ? error.message
              : "An unexpected error occurred during eligibility assessment.";

        set({
          status: "error",
          error: message,
          runCompletedAt: new Date().toISOString(),
        });
      }
    },

    reset: () => set({ ...initialState }),
  }),
);
