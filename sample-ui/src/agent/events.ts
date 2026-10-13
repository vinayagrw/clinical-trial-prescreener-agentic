/*
 * Event type guards for the AgentEvent discriminated union.
 *
 * The union itself lives in src/types/agent.ts so that non-agent code
 * (e.g. UI components) can import types without pulling in the runtime
 * helpers below. This file is for callers that need to narrow events
 * inside a stream loop.
 */

import type { AgentEvent } from "../types/agent";

export type {
  AgentEvent,
  Checkpoint,
  ComponentSpec,
  GenerativeRendererName,
  RefusalReason,
  AgentScope,
} from "../types/agent";

export function isTextDelta(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "text_delta" }> {
  return evt.kind === "text_delta";
}

export function isToolCall(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "tool_call" }> {
  return evt.kind === "tool_call";
}

export function isToolResult(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "tool_result" }> {
  return evt.kind === "tool_result";
}

export function isComponentSpec(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "component_spec" }> {
  return evt.kind === "component_spec";
}

export function isCheckpointRequest(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "checkpoint_request" }> {
  return evt.kind === "checkpoint_request";
}

export function isRefusal(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "refusal" }> {
  return evt.kind === "refusal";
}

export function isError(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "error" }> {
  return evt.kind === "error";
}

export function isDone(
  evt: AgentEvent,
): evt is Extract<AgentEvent, { kind: "done" }> {
  return evt.kind === "done";
}
