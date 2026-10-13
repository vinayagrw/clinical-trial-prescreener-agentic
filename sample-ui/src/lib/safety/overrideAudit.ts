/*
 * overrideAudit — logs every coordinator override of an AI decision.
 *
 * Not a SafetyCheck in the pipeline sense — this is called explicitly from
 * UI code when a user clicks "Override" on a verdict / match / enrollment.
 * The event captures the before/after states so the /safety dashboard can
 * show a running override audit trail. P7 (Review Workbench) wires this in.
 *
 * Exposed as a single helper so any future surface can call it the same way.
 */

import { logSafetyEvent } from "./safetyEvents";
import type { SafetyFeature } from "./safetyEvents";

export interface OverrideAuditPayload {
  feature: SafetyFeature;
  /** What the AI said. */
  beforeValue: unknown;
  /** What the coordinator set it to. */
  afterValue: unknown;
  /** e.g. "criterion:dc-007", "match:match-001" */
  subjectId: string;
  /** User-provided reason for the override. */
  reason: string;
  /** Optional coordinator id for audit trail. */
  actor?: string;
}

export function recordOverride(payload: OverrideAuditPayload): void {
  logSafetyEvent({
    feature: payload.feature,
    mode: "override_audit",
    severity: "info",
    message: `Coordinator override on ${payload.subjectId}: "${payload.reason}"`,
    detail: {
      subjectId: payload.subjectId,
      reason: payload.reason,
      actor: payload.actor,
    },
    mutation: {
      before: safeStringify(payload.beforeValue),
      after: safeStringify(payload.afterValue),
    },
  });
}

function safeStringify(value: unknown): string {
  try {
    const str = JSON.stringify(value);
    return str.length > 500 ? `${str.slice(0, 500)}…` : str;
  } catch {
    return String(value);
  }
}
