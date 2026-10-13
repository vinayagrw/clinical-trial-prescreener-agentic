/*
 * AgentClient — the seam between the UI layer and whatever actually generates
 * agent events.
 *
 * In M1 the only implementation is MockAgentClient in ./mockClient.ts, which
 * replays canned AssistantResponses from src/data/assistantData.ts as a
 * synthetic stream of AgentEvents. In M5 a second implementation,
 * AnthropicAgentClient in ./anthropicClient.ts, will wire to
 * @anthropic-ai/sdk's streaming API with tool use and prompt caching.
 *
 * The UI layer only ever sees this interface — swapping implementations is
 * a single-file change in main.tsx.
 */

import type { AgentEvent, AgentScope } from "../types/agent";

export interface AgentRequest {
  /** Unique per user turn; used to correlate events in the stream. */
  requestId: string;
  /** The raw user prompt. Free-text; scope supplies structure. */
  userMessage: string;
  /** Route + selection + confidentiality. Produced by src/agent/scope.ts. */
  scope: AgentScope;
  /** Prior turns in this thread. Empty for the first turn of a new thread. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /**
   * Whitelist of client-side tool names this turn is allowed to call.
   * Must be a subset of src/agent/tools/index.ts#clientToolRegistry.
   */
  allowedTools: string[];
}

export interface AgentClient {
  /**
   * Opens a streaming turn. The returned async iterable is expected to emit
   * at least one `done` event (or `error` on failure). Callers drive the
   * loop with `for await (const evt of client.stream(req, signal))`.
   *
   * Abort behavior: when `signal.aborted` flips true, the iterable should
   * stop emitting and return. No partial text should leak after abort.
   */
  stream(request: AgentRequest, signal: AbortSignal): AsyncIterable<AgentEvent>;

  /**
   * Called when a human approves, modifies, or rejects a checkpoint request
   * emitted earlier in the stream. The mock client resumes its canned
   * sequence; the real client relays the decision back to the model.
   */
  confirmCheckpoint(
    checkpointId: string,
    decision: "approve" | "modify" | "reject",
    modifications?: unknown,
  ): Promise<void>;
}

/**
 * Budget interceptor — wraps any AgentClient and reports token usage to a
 * listener (usually src/agent/budget.ts). Lets BudgetBadge show live counts
 * without every client having to know about budgets.
 */
export function withBudget(
  client: AgentClient,
  onUsage: (tokens: number) => void,
): AgentClient {
  return {
    async *stream(request, signal) {
      for await (const evt of client.stream(request, signal)) {
        if (evt.kind === "done") {
          onUsage(evt.usage.inputTokens + evt.usage.outputTokens);
        }
        yield evt;
      }
    },
    confirmCheckpoint: client.confirmCheckpoint.bind(client),
  };
}
