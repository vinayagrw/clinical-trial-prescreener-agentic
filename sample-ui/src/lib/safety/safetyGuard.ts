/*
 * SafetyGuard — pluggable pipeline of safety checks that every AI output
 * passes through before it reaches the store or the UI.
 *
 * A `SafetyCheck` inspects the input, optionally rewrites it, and returns
 * a SafetyCheckResult with a severity:
 *   - "info"  → log and continue
 *   - "warn"  → log and continue (optionally rewriting the value)
 *   - "block" → log, then throw SafetyBlockError (pipeline halts)
 *
 * P4 will register the 10 concrete checks from
 * 21-ai-safety-and-success-model.md §3. P1 ships the orchestrator only.
 */

import { logSafetyEvent } from "./safetyEvents";
import type { SafetyFeature, SafetyMode, SafetySeverity } from "./safetyEvents";

export interface SafetyContext {
  feature: SafetyFeature;
  featureKey: string;
  provider?: string;
  model?: string;
}

export interface SafetyCheckResult<T> {
  severity: SafetySeverity;
  mode: SafetyMode;
  message: string;
  /** If set, the safety check rewrote the output (typically on warn). */
  rewritten?: T;
  /** Additional structured context for the audit log. */
  detail?: Record<string, unknown>;
}

export type SafetyCheck<T> = (
  input: T,
  context: SafetyContext,
) => SafetyCheckResult<T> | null;

/**
 * SafetyGuard — runs a sequence of SafetyCheck functions and enforces
 * severity semantics. Thread-safe (each call creates its own local state).
 */
export class SafetyGuard<T> {
  private checks: SafetyCheck<T>[] = [];

  register(check: SafetyCheck<T>): this {
    this.checks.push(check);
    return this;
  }

  /** Returns the registered checks — exposed for tests/dashboards. */
  getChecks(): readonly SafetyCheck<T>[] {
    return this.checks;
  }

  /**
   * Run all registered checks in order. Any `block` result halts the
   * pipeline by throwing SafetyBlockError. Rewrites are carried forward.
   */
  run(input: T, context: SafetyContext): T {
    let current = input;
    for (const check of this.checks) {
      const result = check(current, context);
      if (!result) continue;
      logSafetyEvent({
        feature: context.feature,
        mode: result.mode,
        severity: result.severity,
        message: result.message,
        detail: result.detail,
        mutation:
          result.rewritten !== undefined
            ? {
                before: safeStringify(current),
                after: safeStringify(result.rewritten),
              }
            : undefined,
      });
      if (result.severity === "block") {
        throw new SafetyBlockError(result.mode, result.message);
      }
      if (result.rewritten !== undefined) {
        current = result.rewritten;
      }
    }
    return current;
  }
}

export class SafetyBlockError extends Error {
  constructor(
    public mode: SafetyMode,
    message: string,
  ) {
    super(`SAFETY BLOCK [${mode}]: ${message}`);
    this.name = "SafetyBlockError";
  }
}

function safeStringify(value: unknown): string {
  try {
    const str = JSON.stringify(value);
    return str.length > 500 ? `${str.slice(0, 500)}…` : str;
  } catch {
    return String(value);
  }
}
