/*
 * F5 Ask Agent safety guard — composes every check that applies to an
 * `AgentResponse` into a single SafetyGuard instance the F5 widget calls
 * after the orchestrator returns.
 *
 * Order:
 *   1. schemaValidator       — audit pass
 *   2. citationEnforcer      — 0-citation answer → ungrounded fallback
 *   3. contraindicationCheck — warn if the answer mentions a contraindication
 */

import { SafetyGuard } from "../safetyGuard";
import { createSchemaValidator } from "../schemaValidator";
import { citationEnforcerForAgent } from "../citationEnforcer";
import { contraindicationCheckForAgent } from "../contraindicationCheck";
import type { AgentResponse } from "../../ai/schemas";

let cached: SafetyGuard<AgentResponse> | null = null;

export function getAgentGuard(): SafetyGuard<AgentResponse> {
  if (cached) return cached;
  const guard = new SafetyGuard<AgentResponse>();
  guard.register(createSchemaValidator<AgentResponse>());
  guard.register(citationEnforcerForAgent());
  guard.register(contraindicationCheckForAgent());
  cached = guard;
  return guard;
}
