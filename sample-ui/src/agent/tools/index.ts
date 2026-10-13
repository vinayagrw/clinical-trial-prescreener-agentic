/*
 * Client-side tool registry and generative renderer whitelist.
 *
 * ## Security invariants (both enforced by this file)
 *
 * 1. The agent can never execute code by name. Every tool it can call must
 *    be pre-registered here with a typed handler. If the agent asks for a
 *    tool not in the registry, the caller MUST refuse — see
 *    src/features/agent/hooks/useAgentStream.ts.
 *
 * 2. The agent can never render an arbitrary React component. Every
 *    component_spec event must reference a rendererName from
 *    `allowedRenderers` below. src/features/agent/components/GenerativeSlot.tsx
 *    looks up the name against this list and renders a visible error card
 *    if it does not match. Never eval. Never accept a renderer name that
 *    is not in this list.
 *
 * When adding a new tool or renderer:
 *   - Add an entry here.
 *   - Add a test in src/test/agent-stream.test.ts that verifies unknown
 *     names are rejected.
 *   - Document its threat model in doc comments.
 */

import type { GenerativeRendererName } from "../../types/agent";

export interface ClientTool {
  name: string;
  description: string;
  /** JSON schema object for the tool's arguments. */
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

/** The live tool registry. Tools register themselves via registerTool(). */
export const clientToolRegistry: Record<string, ClientTool> = {};

export function registerTool(tool: ClientTool): void {
  if (clientToolRegistry[tool.name]) {
    throw new Error(
      `Tool "${tool.name}" is already registered; tool names must be unique.`,
    );
  }
  clientToolRegistry[tool.name] = tool;
}

export function getTool(name: string): ClientTool | undefined {
  return clientToolRegistry[name];
}

export function isToolAllowed(name: string, allowedList: string[]): boolean {
  return allowedList.includes(name) && clientToolRegistry[name] !== undefined;
}

/**
 * Hard-coded generative UI whitelist. Must match GenerativeRendererName
 * in src/types/agent.ts exactly — the type system enforces this.
 *
 * Any renderer name that appears in a component_spec event but is NOT in
 * this list MUST be rejected with a visible error card. No exceptions.
 */
export const allowedRenderers: readonly GenerativeRendererName[] = [
  "CompareTrialsTable",
  "CohortChart",
  "CounterfactualCard",
  "DosingCard",
  "ConsentSummary",
  "WhatIfSimulator",
  "SafetyCorrelationMatrix",
] as const;

export function isRendererAllowed(name: string): name is GenerativeRendererName {
  return (allowedRenderers as readonly string[]).includes(name);
}
