/*
 * F6 eligibility-assessment safety guard — composes every check that applies
 * to a full-record `EligibilityAssessment` into a single SafetyGuard instance
 * the F6 store calls after the orchestrator returns.
 *
 * Order matters — most aggressive rewrites go last so upstream warnings
 * don't get lost behind a downgrade:
 *   1. schemaAuditPass               — audit pass (info only)
 *   2. perCriterionCitationEnforcer   — demote 0-citation pass/fail to manual_review
 *   3. perCriterionNegationCheck      — flag negation polarity mismatches
 *   4. temporalArithmeticCheck        — verify LLM interval arithmetic
 *   5. crossCriterionConsistencyCheck — flag shared-evidence date conflicts
 *   6. overallRecommendationCheck     — enforce recommendation/status consistency
 *   7. fitScoreConsistencyCheck       — note fitScore drift from expected
 */

import { SafetyGuard } from "../safetyGuard";
import type { SafetyCheck } from "../safetyGuard";
import type {
  EligibilityAssessment,
  CriterionEligibility,
} from "../../ai/schemas";

// ---------------------------------------------------------------------------
// Check 1: schemaAuditPass
// ---------------------------------------------------------------------------

const schemaAuditPass: SafetyCheck<EligibilityAssessment> = (_value, _ctx) => {
  // Schema validation already passed (Zod). Log an info event and continue.
  return {
    severity: "info",
    mode: "schema_validation",
    message:
      "F6 EligibilityAssessment schema validation passed — all required fields present.",
  };
};

// ---------------------------------------------------------------------------
// Check 2: perCriterionCitationEnforcer
// ---------------------------------------------------------------------------

const perCriterionCitationEnforcer: SafetyCheck<EligibilityAssessment> = (
  value,
) => {
  const rewrittenCriteria: CriterionEligibility[] = [];
  let anyRewritten = false;

  for (const criterion of value.criterionAssessments) {
    if (
      (criterion.status === "pass" || criterion.status === "fail") &&
      criterion.citations.length === 0
    ) {
      rewrittenCriteria.push({
        ...criterion,
        status: "manual_review",
        uncertaintyReason: "missing_domain",
        reasoning:
          criterion.reasoning +
          " [safety] Demoted to manual_review — no supporting citations provided.",
      });
      anyRewritten = true;
    } else {
      rewrittenCriteria.push(criterion);
    }
  }

  if (!anyRewritten) return null;

  const rewritten: EligibilityAssessment = {
    ...value,
    criterionAssessments: rewrittenCriteria,
  };

  const demotedIds = rewrittenCriteria
    .filter((c) => c.status === "manual_review" && c.citations.length === 0)
    .map((c) => c.criterionId);

  return {
    severity: "warn",
    mode: "citation_missing",
    message: `${demotedIds.length} criterion assessment(s) had 0 citations and were demoted to manual_review: ${demotedIds.join(", ")}.`,
    rewritten,
    detail: { demotedIds },
  };
};

// ---------------------------------------------------------------------------
// Check 3: perCriterionNegationCheck
// ---------------------------------------------------------------------------

const perCriterionNegationCheck: SafetyCheck<EligibilityAssessment> = (
  value,
) => {
  const rewrittenCriteria: CriterionEligibility[] = [];
  const flagged: string[] = [];
  let anyFlagged = false;

  for (const criterion of value.criterionAssessments) {
    if (!criterion.negationAnalysis) {
      rewrittenCriteria.push(criterion);
      continue;
    }

    const { assertionStatus } = criterion.negationAnalysis;
    let incoherent = false;

    // "negated" means the condition is NOT present in the patient.
    // For an exclusion criterion: negated should -> pass (condition absent, good).
    //   If status is "fail" for an exclusion with negated assertion -> incoherent.
    // For an inclusion criterion: negated should -> fail (condition absent, bad).
    //   If status is "pass" with negated assertion -> incoherent.
    if (assertionStatus === "negated") {
      if (criterion.type === "exclusion" && criterion.status === "fail") {
        incoherent = true;
      } else if (criterion.type === "inclusion" && criterion.status === "pass") {
        incoherent = true;
      }
    }

    // "present" means the condition IS present in the patient.
    // For an exclusion criterion: present should -> fail (condition present, bad).
    //   If status is "pass" for an exclusion with present assertion -> incoherent.
    if (assertionStatus === "present") {
      if (criterion.type === "exclusion" && criterion.status === "pass") {
        incoherent = true;
      }
    }

    if (incoherent) {
      flagged.push(criterion.criterionId);
      anyFlagged = true;
      rewrittenCriteria.push({
        ...criterion,
        reasoning:
          criterion.reasoning +
          ` [safety] Negation incoherence: assertionStatus="${assertionStatus}" conflicts with status="${criterion.status}" for ${criterion.type} criterion.`,
      });
    } else {
      rewrittenCriteria.push(criterion);
    }
  }

  if (!anyFlagged) return null;

  const rewritten: EligibilityAssessment = {
    ...value,
    criterionAssessments: rewrittenCriteria,
  };

  return {
    severity: "warn",
    mode: "negation",
    message: `Negation incoherence detected in ${flagged.length} criterion(s): ${flagged.join(", ")}.`,
    rewritten,
    detail: { flaggedCriteria: flagged },
  };
};

// ---------------------------------------------------------------------------
// Check 4: temporalArithmeticCheck
// ---------------------------------------------------------------------------

const temporalArithmeticCheck: SafetyCheck<EligibilityAssessment> = (
  value,
) => {
  const rewrittenCriteria: CriterionEligibility[] = [];
  const drifted: { id: string; expected: number; reported: number }[] = [];
  let anyDrifted = false;

  for (const criterion of value.criterionAssessments) {
    if (!criterion.temporalAnalysis) {
      rewrittenCriteria.push(criterion);
      continue;
    }

    const { referenceDate, relevantDate, intervalDays } =
      criterion.temporalAnalysis;

    // Compute expected interval inline (avoid importing daysBetween to
    // prevent circular dependencies).
    const expected = Math.ceil(
      (new Date(referenceDate).getTime() - new Date(relevantDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (Math.abs(intervalDays - expected) > 3) {
      drifted.push({
        id: criterion.criterionId,
        expected,
        reported: intervalDays,
      });
      anyDrifted = true;
      rewrittenCriteria.push({
        ...criterion,
        reasoning:
          criterion.reasoning +
          ` [temporal] Reported interval (${intervalDays}d) differs from computed interval (${expected}d).`,
      });
    } else {
      rewrittenCriteria.push(criterion);
    }
  }

  if (!anyDrifted) return null;

  const rewritten: EligibilityAssessment = {
    ...value,
    criterionAssessments: rewrittenCriteria,
  };

  return {
    severity: "warn",
    mode: "temporal_arithmetic",
    message: `Temporal interval drift in ${drifted.length} criterion(s): ${drifted.map((d) => `${d.id} (reported=${d.reported}d, expected=${d.expected}d)`).join("; ")}.`,
    rewritten,
    detail: { drifted },
  };
};

// ---------------------------------------------------------------------------
// Check 5: crossCriterionConsistencyCheck
// ---------------------------------------------------------------------------

const crossCriterionConsistencyCheck: SafetyCheck<EligibilityAssessment> = (
  value,
) => {
  // Build a map: evidenceId -> Set<sourceDate> seen across criteria.
  const evidenceDateMap = new Map<string, Map<string, string[]>>();

  for (const criterion of value.criterionAssessments) {
    for (const cite of criterion.citations) {
      if (!evidenceDateMap.has(cite.evidenceId)) {
        evidenceDateMap.set(cite.evidenceId, new Map());
      }
      const dateMap = evidenceDateMap.get(cite.evidenceId)!;
      if (!dateMap.has(cite.sourceDate)) {
        dateMap.set(cite.sourceDate, []);
      }
      dateMap.get(cite.sourceDate)!.push(criterion.criterionId);
    }
  }

  // Find evidence IDs cited with more than one distinct sourceDate.
  const conflicts: { evidenceId: string; dates: string[] }[] = [];

  for (const [evidenceId, dateMap] of evidenceDateMap) {
    if (dateMap.size > 1) {
      conflicts.push({
        evidenceId,
        dates: [...dateMap.keys()],
      });
    }
  }

  if (conflicts.length === 0) return null;

  return {
    severity: "warn",
    mode: "cross_criterion_consistency",
    message: `${conflicts.length} evidence source(s) cited with conflicting dates: ${conflicts.map((c) => `${c.evidenceId} (${c.dates.join(" vs ")})`).join("; ")}.`,
    detail: { conflicts },
  };
};

// ---------------------------------------------------------------------------
// Check 6: overallRecommendationCheck
// ---------------------------------------------------------------------------

const overallRecommendationCheck: SafetyCheck<EligibilityAssessment> = (
  value,
) => {
  const statuses = value.criterionAssessments.map((c) => c.status);
  const hasFail = statuses.includes("fail");
  const allPass = statuses.every((s) => s === "pass");

  // If any criterion failed but overall says eligible -> rewrite to not_eligible.
  if (hasFail && value.overallRecommendation === "eligible") {
    const rewritten: EligibilityAssessment = {
      ...value,
      overallRecommendation: "not_eligible",
      rationale:
        value.rationale +
        " [safety] Recommendation rewritten from 'eligible' to 'not_eligible' — one or more criteria have status 'fail'.",
    };
    return {
      severity: "warn",
      mode: "recommendation_consistency",
      message:
        "overallRecommendation was 'eligible' but at least one criterion has status 'fail'; rewritten to 'not_eligible'.",
      rewritten,
      detail: {
        originalRecommendation: "eligible",
        rewrittenTo: "not_eligible",
        failedCriteria: value.criterionAssessments
          .filter((c) => c.status === "fail")
          .map((c) => c.criterionId),
      },
    };
  }

  // If all criteria pass but overall says not_eligible -> rewrite to eligible.
  if (allPass && value.overallRecommendation === "not_eligible") {
    const rewritten: EligibilityAssessment = {
      ...value,
      overallRecommendation: "eligible",
      rationale:
        value.rationale +
        " [safety] Recommendation rewritten from 'not_eligible' to 'eligible' — all criteria have status 'pass'.",
    };
    return {
      severity: "warn",
      mode: "recommendation_consistency",
      message:
        "overallRecommendation was 'not_eligible' but all criteria have status 'pass'; rewritten to 'eligible'.",
      rewritten,
      detail: {
        originalRecommendation: "not_eligible",
        rewrittenTo: "eligible",
      },
    };
  }

  return null;
};

// ---------------------------------------------------------------------------
// Check 7: fitScoreConsistencyCheck
// ---------------------------------------------------------------------------

const STATUS_SCORE: Record<CriterionEligibility["status"], number> = {
  pass: 1,
  uncertain: 0.5,
  manual_review: 0,
  fail: 0,
};

const fitScoreConsistencyCheck: SafetyCheck<EligibilityAssessment> = (
  value,
) => {
  const total = value.criterionAssessments.length;
  if (total === 0) return null;

  const sum = value.criterionAssessments.reduce(
    (acc, c) => acc + STATUS_SCORE[c.status],
    0,
  );
  const expected = Math.round((sum / total) * 100);

  if (Math.abs(value.fitScore - expected) <= 15) return null;

  // Info-level only — don't rewrite, just note the drift.
  return {
    severity: "info",
    mode: "fitscore_consistency",
    message: `fitScore (${value.fitScore}) differs from expected (${expected}) by more than 15 points.`,
    detail: {
      actualFitScore: value.fitScore,
      expectedFitScore: expected,
      delta: value.fitScore - expected,
    },
  };
};

// ---------------------------------------------------------------------------
// Guard factory (singleton)
// ---------------------------------------------------------------------------

let guard: SafetyGuard<EligibilityAssessment> | null = null;

export function getEligibilityAssessmentGuard(): SafetyGuard<EligibilityAssessment> {
  if (guard) return guard;
  guard = new SafetyGuard<EligibilityAssessment>();
  guard.register(schemaAuditPass);
  guard.register(perCriterionCitationEnforcer);
  guard.register(perCriterionNegationCheck);
  guard.register(temporalArithmeticCheck);
  guard.register(crossCriterionConsistencyCheck);
  guard.register(overallRecommendationCheck);
  guard.register(fitScoreConsistencyCheck);
  return guard;
}
