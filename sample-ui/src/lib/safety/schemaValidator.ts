/*
 * schemaValidator — audits that a structured AI output matches its Zod schema.
 *
 * Zod validation already happens inside each provider (geminiProvider, groqProvider,
 * etc.) before the orchestrator returns — any violation is thrown as a
 * `SchemaValidationError`. So by the time this check runs the output has already
 * been validated. Its only job is to emit an `info` safety event so the dashboard
 * can show "N schema validations passed" over time — the audit trail of a healthy
 * pipeline is as important as the audit trail of a broken one.
 *
 * This check never rewrites and never blocks; when `block` is needed the provider
 * or the orchestrator already threw before we reached this point.
 */

import type { SafetyCheck } from "./safetyGuard";

/** Generic schema-pass audit check — logs an info event on every output. */
export function createSchemaValidator<T>(): SafetyCheck<T> {
  return (input, context) => {
    const size = safeSize(input);
    return {
      severity: "info",
      mode: "schema_validation",
      message: `Schema-valid ${context.feature} output (${size} chars)`,
      detail: {
        featureKey: context.featureKey,
        provider: context.provider,
        model: context.model,
      },
    };
  };
}

function safeSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}
