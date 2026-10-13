/*
 * F3 evaluation safety guard — composes every check that applies to a
 * single criterion `Verdict` into a single SafetyGuard instance the F3 store
 * calls after the orchestrator returns.
 *
 * Order matters — most aggressive rewrites go last so upstream warnings
 * don't get lost behind a downgrade:
 *   1. schemaValidator       — audit pass
 *   2. citationEnforcer      — demote 0-citation pass/fail to manual_review
 *   3. biasToUncertain       — demote uncited-reasoning to uncertain
 *   4. contradictionDetector — demote numeric contradiction to uncertain
 *   5. negationDetector      — demote polarity mismatch to uncertain
 *   6. contraindicationCheck — block contraindicated pass verdicts
 *   7. modelRegression       — compare signature to last-known-good
 */

/*
 * F3 evaluation safety guard — composes every check that applies to a
 * single criterion `Verdict` into a single SafetyGuard instance the F3 store
 * calls after the orchestrator returns.
 *
 * Order matters — most aggressive rewrites go last so upstream warnings
 * don't get lost behind a downgrade:
 *   1. schemaValidator           — audit pass
 *   2. citationEnforcer          — demote 0-citation pass/fail to manual_review
 *   3. citationContentEnforcer   — verify citation excerpts are grounded (Item 15)
 *   4. biasToUncertain           — demote uncited-reasoning to uncertain
 *   5. contradictionDetector     — demote numeric contradiction to uncertain
 *   6. negationDetector          — demote polarity mismatch to uncertain
 *   7. contraindicationCheck     — block contraindicated pass verdicts
 *   8. modelRegression           — compare signature to last-known-good
 */

import { SafetyGuard } from "../safetyGuard";
import { createSchemaValidator } from "../schemaValidator";
import {
  citationEnforcerForVerdict,
  citationContentEnforcerForVerdict,
} from "../citationEnforcer";
import { biasToUncertainForVerdict } from "../biasToUncertain";
import { contradictionDetectorForVerdict } from "../contradictionDetector";
import { negationDetectorForVerdict } from "../negationDetector";
import { contraindicationCheckForVerdict } from "../contraindicationCheck";
import { modelRegressionCheckForVerdict } from "../modelRegressionCheck";
import type { Verdict } from "../../ai/schemas";

let cached: SafetyGuard<Verdict> | null = null;

export function getEvaluationGuard(): SafetyGuard<Verdict> {
  if (cached) return cached;
  const guard = new SafetyGuard<Verdict>();
  guard.register(createSchemaValidator<Verdict>());
  guard.register(citationEnforcerForVerdict());
  guard.register(citationContentEnforcerForVerdict()); // Item 15
  guard.register(biasToUncertainForVerdict());
  guard.register(contradictionDetectorForVerdict());
  guard.register(negationDetectorForVerdict());
  guard.register(contraindicationCheckForVerdict());
  guard.register(modelRegressionCheckForVerdict());
  cached = guard;
  return guard;
}
