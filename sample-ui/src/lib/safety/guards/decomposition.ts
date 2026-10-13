/*
 * F1 decomposition safety guard — composes every check that applies to a
 * `DecompositionResponse` into a single SafetyGuard instance the F1 store
 * calls after the orchestrator returns.
 *
 * Order matters:
 *   1. schemaValidator   — audit pass (everything after here is schema-valid)
 *   2. biomarkerOntology — normalize aliases → canonical (may rewrite)
 *   3. modelRegression   — compare signature to last-known-good
 */

import { SafetyGuard } from "../safetyGuard";
import { createSchemaValidator } from "../schemaValidator";
import { biomarkerOntologyForDecomposition } from "../biomarkerOntology";
import { modelRegressionCheckForDecomposition } from "../modelRegressionCheck";
import type { DecompositionResponse } from "../../ai/schemas";

let cached: SafetyGuard<DecompositionResponse> | null = null;

export function getDecompositionGuard(): SafetyGuard<DecompositionResponse> {
  if (cached) return cached;
  const guard = new SafetyGuard<DecompositionResponse>();
  guard.register(createSchemaValidator<DecompositionResponse>());
  guard.register(biomarkerOntologyForDecomposition());
  guard.register(modelRegressionCheckForDecomposition());
  cached = guard;
  return guard;
}
