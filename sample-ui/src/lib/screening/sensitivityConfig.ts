/*
 * sensitivityConfig — asymmetric sensitivity/specificity profiles for
 * clinical trial eligibility screening.
 *
 * The fundamental design principle: it is WORSE to incorrectly exclude an
 * eligible patient (false exclusion) than to send a borderline case to
 * manual review. Therefore:
 *
 * - Exclusion criteria default to `neverAutoFail: true` — when the engine
 *   is uncertain, it routes to manual_review rather than auto-failing.
 *   This biases the system toward NOT excluding eligible patients.
 *
 * - Inclusion criteria default to `uncertainBehavior: "uncertain"` —
 *   uncertain inclusion is surfaced transparently for reviewer decision.
 *
 * Individual criteria can override these defaults when the protocol or
 * institutional policy demands different behavior (e.g., a hard safety
 * exclusion like active pregnancy may have `neverAutoFail: false`).
 */

import type { MatchStatus } from "../../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SensitivityProfile {
  /** How to handle uncertain results for inclusion criteria. */
  inclusionDefault: {
    /** What status to assign when the evaluator returns "uncertain". */
    uncertainBehavior: "pass" | "uncertain" | "manual_review";
  };
  /** How to handle uncertain/fail results for exclusion criteria. */
  exclusionDefault: {
    /** What status to assign when the evaluator returns "uncertain". */
    uncertainBehavior: "uncertain" | "manual_review";
    /**
     * When true, a deterministic "fail" on an exclusion criterion is
     * upgraded to "manual_review" instead — the engine never auto-fails
     * exclusion without human review. This prevents false exclusions.
     */
    neverAutoFail: boolean;
  };
  /** Per-criterion overrides keyed by criterion ID. */
  overrides: Record<string, {
    uncertainBehavior?: MatchStatus;
    neverAutoFail?: boolean;
  }>;
}

export interface SensitivityAdjustment {
  /** The adjusted status. */
  status: MatchStatus;
  /** Whether the status was changed from its original value. */
  adjusted: boolean;
  /** Human-readable reason for the adjustment (if any). */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Default profile
// ---------------------------------------------------------------------------

/**
 * Default sensitivity profile — biased toward NOT excluding eligible patients.
 *
 * - Inclusion uncertain → stays "uncertain" (transparent to reviewer)
 * - Exclusion uncertain → upgrades to "manual_review"
 * - Exclusion auto-fail → blocked, routes to "manual_review" instead
 */
export const DEFAULT_SENSITIVITY: SensitivityProfile = {
  inclusionDefault: {
    uncertainBehavior: "uncertain",
  },
  exclusionDefault: {
    uncertainBehavior: "manual_review",
    neverAutoFail: true,
  },
  overrides: {},
};

// ---------------------------------------------------------------------------
// Application logic
// ---------------------------------------------------------------------------

/**
 * Apply the sensitivity profile to a criterion's evaluation result.
 *
 * This is called after the deterministic evaluator but before the result
 * is stored — it adjusts the status based on the criterion type and the
 * active sensitivity profile.
 *
 * @param status        The original evaluation status.
 * @param criterionType Whether this is an inclusion or exclusion criterion.
 * @param criterionId   The criterion ID (for per-criterion overrides).
 * @param profile       The active sensitivity profile.
 * @returns             The adjusted status and metadata.
 */
export function applySensitivity(
  status: MatchStatus,
  criterionType: "inclusion" | "exclusion",
  criterionId: string,
  profile: SensitivityProfile = DEFAULT_SENSITIVITY,
): SensitivityAdjustment {
  // 1. Check per-criterion override first.
  const override = profile.overrides[criterionId];

  // 2. Handle uncertain status.
  if (status === "uncertain") {
    if (override?.uncertainBehavior) {
      return {
        status: override.uncertainBehavior,
        adjusted: override.uncertainBehavior !== status,
        reason: `Per-criterion override: uncertain → ${override.uncertainBehavior}`,
      };
    }
    if (criterionType === "exclusion") {
      const behavior = profile.exclusionDefault.uncertainBehavior;
      return {
        status: behavior,
        adjusted: behavior !== status,
        reason: behavior !== status
          ? `Exclusion sensitivity: uncertain → ${behavior} (bias toward not excluding)`
          : undefined,
      };
    }
    const behavior = profile.inclusionDefault.uncertainBehavior;
    return {
      status: behavior,
      adjusted: behavior !== status,
      reason: behavior !== status
        ? `Inclusion sensitivity: uncertain → ${behavior}`
        : undefined,
    };
  }

  // 3. Handle auto-fail on exclusion criteria (neverAutoFail guard).
  if (status === "fail" && criterionType === "exclusion") {
    const neverAutoFail = override?.neverAutoFail ?? profile.exclusionDefault.neverAutoFail;
    if (neverAutoFail) {
      return {
        status: "manual_review",
        adjusted: true,
        reason: "Exclusion sensitivity: auto-fail blocked → manual_review (neverAutoFail)",
      };
    }
  }

  // 4. No adjustment needed.
  return { status, adjusted: false };
}
