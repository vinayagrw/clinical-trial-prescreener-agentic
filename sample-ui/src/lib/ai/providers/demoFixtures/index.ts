/*
 * Demo fixture registry — wiring for the `demoProvider.generate()` path.
 *
 * Each feature has a single `resolve` function here that takes a
 * `featureKey` + arbitrary `input` (whatever the prompt includes in its
 * user message) and returns a fixture that satisfies the schema the
 * caller asked for. If nothing matches, we return a permissive fallback.
 */

import type { GenerateParams } from "../types.ts";
import {
  F1_DEMO_DECOMPOSITION,
} from "./f1Decomposition.ts";
import { F3_DEMO_EVALUATIONS, F3_DEMO_FALLBACK } from "./f3Evaluation.ts";
import { F5_DEMO_DEFAULT, pickF5Fixture } from "./f5Agent.ts";
import { pickF6Fixture } from "./f6Assessment.ts";

/**
 * Returns a demo fixture for the given feature, or `undefined` if there
 * is no fixture registered. `undefined` means the demoProvider should
 * surface a clear error instead of silently returning empty output.
 */
export function resolveDemoFixture<T>(
  params: GenerateParams<T>,
): T | undefined {
  switch (params.featureKey) {
    case "f1.decomposeProtocol":
      return F1_DEMO_DECOMPOSITION as unknown as T;
    case "f3.evaluateCriterion": {
      // The user prompt has `id: dc-XXX`; pull that out and look it up.
      const match = /id:\s*(dc-\d+)/.exec(params.user);
      const key = match?.[1];
      if (key && key in F3_DEMO_EVALUATIONS) {
        return F3_DEMO_EVALUATIONS[key] as unknown as T;
      }
      return F3_DEMO_FALLBACK as unknown as T;
    }
    case "f5.askAgent": {
      // Pull the coordinator's question line; last "Coordinator's question:" block.
      const match = /Coordinator's question:\s*([\s\S]*?)(\n\n|$)/.exec(params.user);
      const question = match?.[1]?.trim() ?? params.user;
      return pickF5Fixture(question) as unknown as T;
    }
    case "f6.assessEligibility": {
      return pickF6Fixture(params.user) as unknown as T;
    }
    case "f2.rerankEvidence":
      // Rerank is optional — demo mode just returns an empty rerank, caller keeps deterministic order.
      return { ranked: [] } as unknown as T;
    default:
      return F5_DEMO_DEFAULT as unknown as T;
  }
}

/** Feature keys the demo registry knows about — exposed for tests / diagnostics. */
export const DEMO_FIXTURE_KEYS = [
  "f1.decomposeProtocol",
  "f2.rerankEvidence",
  "f3.evaluateCriterion",
  "f5.askAgent",
  "f6.assessEligibility",
] as const;
export type DemoFixtureKey = (typeof DEMO_FIXTURE_KEYS)[number];
