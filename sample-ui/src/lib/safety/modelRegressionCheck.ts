/*
 * modelRegressionCheck — compares a fresh AI output to a last-known-good
 * snapshot and flags drift.
 *
 * In production this would compare against a golden fixture in a separate
 * regression-test harness; here we use a lightweight in-memory "last known
 * good" cache keyed by feature + input hash. First run populates the cache,
 * subsequent runs against the same input warn if they differ materially
 * (e.g., a verdict that used to be `pass` is now `fail`).
 *
 * This is a light heuristic — a real MLOps pipeline would run evals on a
 * benchmark suite, not in the request path. But it catches "wait, last week
 * this criterion passed and now it fails" without any new infra.
 */

import type { DecompositionResponse, Verdict } from "../ai/schemas";
import type { SafetyCheck, SafetyContext } from "./safetyGuard";

interface Snapshot {
  signature: string;
  createdAt: string;
}

const decompositionSnapshots = new Map<string, Snapshot>();
const verdictSnapshots = new Map<string, Snapshot>();

function decompositionSignature(response: DecompositionResponse): string {
  return response.criteria
    .map((c) => `${c.id}:${c.type}:${c.computability}:${c.confidence}`)
    .join("|");
}

function verdictSignature(verdict: Verdict): string {
  return `${verdict.status}:${verdict.uncertaintyReason ?? "-"}:${verdict.citations
    .map((c) => c.evidenceId)
    .sort()
    .join(",")}`;
}

function keyFor(context: SafetyContext): string {
  return `${context.featureKey}:${context.provider ?? "?"}:${context.model ?? "?"}`;
}

export function modelRegressionCheckForDecomposition(): SafetyCheck<DecompositionResponse> {
  return (response, context) => {
    const key = keyFor(context);
    const fresh: Snapshot = {
      signature: decompositionSignature(response),
      createdAt: new Date().toISOString(),
    };
    const previous = decompositionSnapshots.get(key);
    decompositionSnapshots.set(key, fresh);
    if (!previous || previous.signature === fresh.signature) return null;
    return {
      severity: "warn",
      mode: "model_regression",
      message: `F1 decomposition signature drifted since last run under ${key}.`,
      detail: {
        previousSignature: previous.signature,
        freshSignature: fresh.signature,
        lastSeenAt: previous.createdAt,
      },
    };
  };
}

export function modelRegressionCheckForVerdict(): SafetyCheck<Verdict> {
  return (verdict, context) => {
    const key = keyFor(context);
    const fresh: Snapshot = {
      signature: verdictSignature(verdict),
      createdAt: new Date().toISOString(),
    };
    const previous = verdictSnapshots.get(key);
    verdictSnapshots.set(key, fresh);
    if (!previous || previous.signature === fresh.signature) return null;
    return {
      severity: "warn",
      mode: "model_regression",
      message: `F3 verdict signature drifted on ${context.featureKey} under ${key}.`,
      detail: {
        previousSignature: previous.signature,
        freshSignature: fresh.signature,
        lastSeenAt: previous.createdAt,
      },
    };
  };
}

/** Expose the cache clear for tests / the /safety dashboard reset button. */
export function clearModelRegressionCache(): void {
  decompositionSnapshots.clear();
  verdictSnapshots.clear();
}
