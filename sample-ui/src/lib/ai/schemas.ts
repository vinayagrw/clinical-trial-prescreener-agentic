/*
 * Base Zod schemas shared across AI features.
 *
 * Every structured LLM output is validated against one of these shapes
 * before it reaches the store or the UI. The safety layer (P4) layers
 * additional semantic checks on top of schema validation.
 *
 * Feature-specific schemas live next to each feature; this file holds
 * the shapes shared across F1 / F3 / F5.
 */

import { z } from "zod";

/**
 * Minimal citation referenced from an LLM answer. All AI-returned claims
 * must carry at least one of these; the safety layer's citationEnforcer
 * auto-demotes verdicts with zero citations to `manual_review`.
 */
export const CitationSchema = z.object({
  evidenceId: z.string().min(1),
  source: z.string().min(1),
  sourceDate: z.string().min(1),
  excerpt: z.string().min(1),
});
export type Citation = z.infer<typeof CitationSchema>;

/** Uncertainty reason enum — mirrors 04-data-readiness-and-evaluation-pack.md §4. */
export const UncertaintyReasonSchema = z.enum([
  "missing_domain",
  "conflicting_evidence",
  "protocol_ambiguity",
  "stale_data",
  "manual_only",
]);
export type UncertaintyReason = z.infer<typeof UncertaintyReasonSchema>;

/** Shared verdict shape for F3 criterion evaluation. */
export const VerdictSchema = z.object({
  status: z.enum(["pass", "fail", "uncertain", "manual_review"]),
  reasoning: z.string().min(10),
  citations: z.array(CitationSchema),
  uncertaintyReason: UncertaintyReasonSchema.optional(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/** Shared decomposed-criterion shape for F1. */
export const DecomposedCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["inclusion", "exclusion"]),
  computability: z.enum(["deterministic", "hybrid", "manual_only"]),
  threshold: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.object({
    pageRef: z.string().min(1),
    originalText: z.string().min(1),
  }),
  normalizedConcepts: z.array(z.string()),
  reviewNote: z.string().optional(),
});
export type DecomposedCriterionAI = z.infer<typeof DecomposedCriterionSchema>;

/** Full F1 response envelope. */
export const DecompositionResponseSchema = z.object({
  criteria: z.array(DecomposedCriterionSchema).min(1),
});
export type DecompositionResponse = z.infer<typeof DecompositionResponseSchema>;

/** Full F5 Ask Agent response envelope. */
export const AgentResponseSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(CitationSchema).min(1),
  groundingStatus: z.enum(["grounded", "partial", "ungrounded"]),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// --- F6: Full-Record Eligibility Assessment ---

export const TemporalAnalysisSchema = z.object({
  relevantDate: z.string().min(1),
  referenceDate: z.string().min(1),
  intervalDays: z.number().int(),
  windowDays: z.number().int(),
  withinWindow: z.boolean(),
  arithmetic: z.string().min(1),
});

export const NegationAnalysisSchema = z.object({
  assertionStatus: z.enum(["present", "negated", "possible", "historical", "family"]),
  rawPhrase: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});

export const FuzzyResolutionSchema = z.object({
  originalText: z.string().min(1),
  resolvedThreshold: z.string().min(1),
  labValuesUsed: z.array(z.object({
    name: z.string(),
    value: z.number(),
    unit: z.string(),
    meetsThreshold: z.boolean(),
  })),
});

export const CriterionEligibilitySchema = z.object({
  criterionId: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["inclusion", "exclusion"]),
  status: z.enum(["pass", "fail", "uncertain", "manual_review"]),
  reasoning: z.string().min(10),
  citations: z.array(CitationSchema),
  uncertaintyReason: UncertaintyReasonSchema.optional(),
  temporalAnalysis: TemporalAnalysisSchema.optional(),
  negationAnalysis: NegationAnalysisSchema.optional(),
  fuzzyResolution: FuzzyResolutionSchema.optional(),
});

export const EligibilityAssessmentSchema = z.object({
  patientSummary: z.string().min(10),
  trialId: z.string().min(1),
  overallRecommendation: z.enum(["eligible", "not_eligible", "requires_review"]),
  fitScore: z.number().min(0).max(100),
  blockers: z.array(z.string()),
  criterionAssessments: z.array(CriterionEligibilitySchema).min(1),
  rationale: z.string().min(10),
});

export type TemporalAnalysis = z.infer<typeof TemporalAnalysisSchema>;
export type NegationAnalysis = z.infer<typeof NegationAnalysisSchema>;
export type FuzzyResolution = z.infer<typeof FuzzyResolutionSchema>;
export type CriterionEligibility = z.infer<typeof CriterionEligibilitySchema>;
export type EligibilityAssessment = z.infer<typeof EligibilityAssessmentSchema>;
