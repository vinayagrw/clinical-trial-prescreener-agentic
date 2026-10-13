/*
 * MockAgentClient — the M1 implementation of AgentClient.
 *
 * It wraps the existing canned `assistantSessions` fixture (still living in
 * src/data/assistantData.ts during the transition) and replays each
 * AssistantResponse as a synthetic stream of AgentEvents:
 *
 *   text_delta × N  (chunked at ~3 words with ~30ms jitter to feel alive)
 *   tool_call / tool_result pairs when the response is a draft/comparison
 *   component_spec when the response is structured (compare table, cohort)
 *   checkpoint_request for agentic chain demos (dispositive actions)
 *   refusal when the scope is flagged as "stale_evidence" (demo fixture)
 *   done with synthetic token usage
 *
 * Respects `signal.aborted` between every emission so the Stop button has
 * real teeth even without a real LLM behind it.
 *
 * Deliberately stubbed — M5 swaps this for AnthropicAgentClient which wraps
 * @anthropic-ai/sdk's client.messages.stream(). Nothing outside the agent
 * layer should care about the swap.
 */

import { getAssistantSession } from "../data/assistantData";
import type {
  AgentEvent,
  Checkpoint,
  ComponentSpec,
  RefusalReason,
} from "../types/agent";
import type { AssistantResponse, AssistantSession } from "../types/agent";
import type { AgentClient, AgentRequest } from "./client";

// --- Pacing knobs (tuned to feel real without being slow in demos) ---
const WORDS_PER_CHUNK = 3;
const DELAY_PER_CHUNK_MS = 30;
const DELAY_AFTER_TOOL_MS = 120;
const DELAY_BEFORE_CHECKPOINT_MS = 80;

/** Promise-resolvers keyed by checkpointId so confirmCheckpoint() can release. */
const pendingCheckpoints = new Map<
  string,
  (decision: "approve" | "modify" | "reject") => void
>();

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Chunk a long summary string into ~3-word pieces so the stream feels like
 * an LLM typing. We chunk on whitespace to avoid splitting mid-word.
 */
function chunkText(text: string, wordsPerChunk = WORDS_PER_CHUNK): string[] {
  const words = text.split(/(\s+)/); // keep whitespace tokens
  const chunks: string[] = [];
  let buf: string[] = [];
  let wordCount = 0;
  for (const token of words) {
    buf.push(token);
    if (/\S/.test(token)) {
      wordCount += 1;
    }
    if (wordCount >= wordsPerChunk) {
      chunks.push(buf.join(""));
      buf = [];
      wordCount = 0;
    }
  }
  if (buf.length) chunks.push(buf.join(""));
  return chunks;
}

/**
 * Heuristic: decide which kind of response this is so we emit the right
 * event mix. The canned fixtures predate AgentEvent, so we infer from shape.
 */
type ResponseShape =
  | { kind: "prose" }
  | { kind: "draft"; artifactKind: "outreach_brief" | "pi_handoff" }
  | { kind: "comparison"; rendererName: "CompareTrialsTable" }
  | { kind: "trace" }
  | { kind: "refusal"; reason: RefusalReason };

function classifyResponse(
  response: AssistantResponse,
  request: AgentRequest,
): ResponseShape {
  // Stale-evidence demo fixture — any request with this marker produces a refusal.
  if (request.userMessage.toLowerCase().includes("stale")) {
    return {
      kind: "refusal",
      reason: {
        code: "stale_evidence",
        humanExplanation:
          "The evidence I have for this question is more than 30 days old. I won't answer from stale labs — refresh the source feed and ask again.",
      },
    };
  }

  if (response.draftSections?.length) {
    return {
      kind: "draft",
      artifactKind: response.draftType ?? "outreach_brief",
    };
  }

  if (response.supportingTable && response.answerArtifacts?.some((a) => a.kind === "comparison_table")) {
    return { kind: "comparison", rendererName: "CompareTrialsTable" };
  }

  if (response.answerArtifacts?.some((a) => a.kind === "trace")) {
    return { kind: "trace" };
  }

  return { kind: "prose" };
}

/**
 * Build a synthetic checkpoint for the outreach-draft agentic-chain demo.
 * Real clients would get this from the model's tool use; we hard-code one
 * so the UI can practice the interaction.
 */
function buildDraftCheckpoint(draftType: "outreach_brief" | "pi_handoff"): Checkpoint {
  return {
    id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stepLabel: draftType === "outreach_brief" ? "Draft outreach brief" : "Draft PI handoff",
    description:
      draftType === "outreach_brief"
        ? "I'm about to draft an outreach brief for this patient. The draft will be saved internally only — no external message is sent."
        : "I'm about to draft a PI handoff packet. This will be saved for review by the PI.",
    proposedAction: {
      kind: "save_draft",
      draftType,
      payload: null,
    },
    requiredConfirmation: "single_click",
  };
}

/** Session-level usage accounting for the mock — rough per-turn estimate. */
function estimateUsage(response: AssistantResponse) {
  const prose =
    response.summary.length + (response.bullets?.join(" ").length ?? 0);
  const tableChars =
    response.supportingTable?.rows.flat().join(" ").length ?? 0;
  // Rough conversion: ~4 chars per token. Add a fixed overhead for the
  // system prompt + evidence context that would be in-flight in production.
  const outputTokens = Math.ceil((prose + tableChars) / 4);
  return { inputTokens: 800, outputTokens };
}

// --- Session routing ---

function sessionIdForScope(request: AgentRequest): string {
  const { scope } = request;
  const { matchId, trialId } = scope.entityIds;

  switch (scope.routeKind) {
    case "review":
      return matchId ? `review-${matchId}` : "review-match-001";
    case "audit":
      return matchId ? `audit-${matchId}` : "audit-match-001";
    case "trial_admin":
      return trialId ? "trial-admin" : "trial-admin";
    case "command_center":
      return "command-center";
    case "insights":
      // Insights has no canned session yet; fall back to command-center so
      // the ambient-answer experience still works in M1.
      return "command-center";
    case "cockpit":
    default:
      return "cockpit";
  }
}

/** Pick the canned response most likely to match the user's question. */
function selectResponse(
  session: AssistantSession,
  userMessage: string,
): AssistantResponse {
  const normalized = userMessage.toLowerCase();
  let best = session.responses[0];
  let bestScore = -1;

  for (const response of session.responses) {
    const promptText = `${response.userQuestion}`.toLowerCase();
    let score = 0;
    for (const token of normalized.split(/\s+/)) {
      if (token.length > 3 && promptText.includes(token)) score += 1;
    }
    if (score > bestScore) {
      best = response;
      bestScore = score;
    }
  }

  return best;
}

// --- Emission helpers ---

async function* emitProse(
  response: AssistantResponse,
  requestId: string,
  signal: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const body = [
    response.summary,
    response.bullets?.length ? `\n\n${response.bullets.map((b) => `• ${b}`).join("\n")}` : "",
    `\n\nHow I got here: ${response.howDerived}`,
    `\n\nRecommended next step: ${response.recommendedNextAction}`,
  ].join("");

  for (const chunk of chunkText(body)) {
    if (signal.aborted) return;
    yield { kind: "text_delta", requestId, delta: chunk };
    await sleep(DELAY_PER_CHUNK_MS, signal);
  }
}

async function* emitComponent(
  response: AssistantResponse,
  requestId: string,
  rendererName: ComponentSpec["rendererName"],
): AsyncGenerator<AgentEvent> {
  const spec: ComponentSpec = {
    rendererName,
    props: {
      title: response.supportingTable?.title ?? response.summary,
      columns: response.supportingTable?.columns ?? [],
      rows: response.supportingTable?.rows ?? [],
    },
  };
  yield { kind: "component_spec", requestId, spec };
}

async function* emitDraftChain(
  response: AssistantResponse,
  requestId: string,
  draftType: "outreach_brief" | "pi_handoff",
  signal: AbortSignal,
): AsyncGenerator<AgentEvent> {
  // 1. Short tool_call / tool_result pair so the trace panel has something.
  const callId = `call-${requestId}-1`;
  yield {
    kind: "tool_call",
    requestId,
    toolName: "draft_outreach_brief",
    args: { draftType },
    callId,
  };
  await sleep(DELAY_AFTER_TOOL_MS, signal);
  if (signal.aborted) return;
  yield {
    kind: "tool_result",
    requestId,
    callId,
    result: { status: "ok", sections: response.draftSections?.length ?? 0 },
  };

  // 2. Short prose intro so the conversation has narration.
  for (const chunk of chunkText(
    `Here's a draft ${draftType === "outreach_brief" ? "outreach brief" : "PI handoff"} for your review. Nothing is sent externally — this is internal-only.`,
  )) {
    if (signal.aborted) return;
    yield { kind: "text_delta", requestId, delta: chunk };
    await sleep(DELAY_PER_CHUNK_MS, signal);
  }

  // 3. Pause for human confirmation via checkpoint.
  await sleep(DELAY_BEFORE_CHECKPOINT_MS, signal);
  if (signal.aborted) return;
  const checkpoint = buildDraftCheckpoint(draftType);
  yield { kind: "checkpoint_request", requestId, checkpoint };

  // 4. Wait for human decision; confirmCheckpoint() resolves the promise.
  const decision = await new Promise<"approve" | "modify" | "reject">((resolve) => {
    pendingCheckpoints.set(checkpoint.id, resolve);
    // If aborted while waiting, release with reject so the loop terminates.
    const onAbort = () => {
      if (pendingCheckpoints.has(checkpoint.id)) {
        pendingCheckpoints.delete(checkpoint.id);
        resolve("reject");
      }
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

  if (decision === "reject" || signal.aborted) {
    return;
  }

  // 5. After approval, stream the actual draft sections as text_delta.
  for (const section of response.draftSections ?? []) {
    for (const chunk of chunkText(`\n\n${section.label}\n${section.content}`)) {
      if (signal.aborted) return;
      yield { kind: "text_delta", requestId, delta: chunk };
      await sleep(DELAY_PER_CHUNK_MS, signal);
    }
  }
}

async function* emitRefusal(
  reason: RefusalReason,
  requestId: string,
): AsyncGenerator<AgentEvent> {
  yield {
    kind: "refusal",
    requestId,
    reason,
    remediation:
      reason.code === "stale_evidence"
        ? "Refresh evidence from the source feed, then ask again."
        : undefined,
  };
}

// --- The client ---

export class MockAgentClient implements AgentClient {
  async *stream(
    request: AgentRequest,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const sessionId = sessionIdForScope(request);
    const session = getAssistantSession(sessionId);

    if (!session) {
      yield {
        kind: "error",
        requestId: request.requestId,
        message: `No mock session found for "${sessionId}".`,
        recoverable: false,
      };
      yield {
        kind: "done",
        requestId: request.requestId,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
      return;
    }

    const response = selectResponse(session, request.userMessage);
    const shape = classifyResponse(response, request);

    try {
      if (shape.kind === "refusal") {
        yield* emitRefusal(shape.reason, request.requestId);
      } else if (shape.kind === "draft") {
        yield* emitDraftChain(response, request.requestId, shape.artifactKind, signal);
      } else {
        // Prose + optional component spec.
        yield* emitProse(response, request.requestId, signal);
        if (shape.kind === "comparison") {
          yield* emitComponent(response, request.requestId, shape.rendererName);
        }
      }

      if (signal.aborted) return;

      yield {
        kind: "done",
        requestId: request.requestId,
        usage: estimateUsage(response),
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return; // Clean abort — no further events.
      }
      yield {
        kind: "error",
        requestId: request.requestId,
        message: (err as Error).message ?? "Unknown mock stream error",
        recoverable: true,
      };
    }
  }

  async confirmCheckpoint(
    checkpointId: string,
    decision: "approve" | "modify" | "reject",
    _modifications?: unknown,
  ): Promise<void> {
    const resolver = pendingCheckpoints.get(checkpointId);
    if (resolver) {
      pendingCheckpoints.delete(checkpointId);
      resolver(decision);
    }
  }
}

/** Default singleton used by main.tsx wiring. */
export const mockAgentClient = new MockAgentClient();
