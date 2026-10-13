/*
 * askAgentRunner — shared F5 core that the pipeline stepper AND the
 * GlobalAskWidget both call.
 *
 * Extracts the LLM call + safety-guard chain from GlobalAskWidget so the
 * aiPipeline store can drive F5 without depending on the widget UI.
 *
 * Flow:
 *   1. sanitizePromptInjection  — strip injection patterns
 *   2. getOrchestrator().generate() — call the LLM via provider failover
 *   3. getAgentGuard().run()    — schema + citation + contraindication checks
 */

import type { ProviderName } from "./providers";
import { getOrchestrator } from "./providers";
import {
  ASK_AGENT_FEATURE_KEY,
  buildAskAgentSystemPrompt,
  buildAskAgentUserPrompt,
  type AgentScope,
  type AgentContextSnippet,
} from "./prompts/askAgent";
import { AgentResponseSchema, type AgentResponse } from "./schemas";
import { EVIDENCE_CORPUS } from "../retrieval/evidenceCorpus";
import { getAgentGuard } from "../safety/guards/agent";
import { sanitizePromptInjection } from "../safety/promptInjectionFilter";
import { SafetyBlockError } from "../safety/safetyGuard";

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export interface AskAgentResult {
  status: "success" | "error";
  answer: AgentResponse | null;
  sanitizedQuestion: string;
  error: string | null;
  provider: ProviderName | null;
  model: string | null;
  wallTimeMs: number;
}

/* ------------------------------------------------------------------ */
/* Snippet builder — reused by both pipeline and widget                */
/* ------------------------------------------------------------------ */

/**
 * Build the evidence-snippet whitelist the LLM is allowed to ground on.
 * In this demo we draw the top-8 from the in-memory `EVIDENCE_CORPUS`.
 * In production this would be top-K hits from hybrid retrieval scoped
 * to the current patient / trial / queue / audit.
 */
export function buildTrialAgentSnippets(
  scope: AgentScope,
): AgentContextSnippet[] {
  // Global scope gets no PHI snippets.
  if (scope === "global") return [];
  const pick = EVIDENCE_CORPUS.slice(0, 8);
  return pick.map((note) => ({
    evidenceId: note.id,
    label: `${note.source} — ${note.sourceDate}`,
    content: note.text,
  }));
}

/* ------------------------------------------------------------------ */
/* Core runner                                                        */
/* ------------------------------------------------------------------ */

/**
 * Run a single F5 Ask-Agent query end-to-end:
 *   sanitize → LLM call → safety guard → typed result.
 *
 * Callers: `aiPipeline.runAgentStep()` and `GlobalAskWidget.runLiveAgentQuery()`.
 */
export async function runAskAgent(opts: {
  question: string;
  scope: AgentScope;
  scopeId?: string;
  snippets?: AgentContextSnippet[];
}): Promise<AskAgentResult> {
  const start = Date.now();

  // 1. Pre-flight: strip prompt-injection patterns.
  const { sanitized: safeQuestion } = sanitizePromptInjection(
    opts.question,
    "F5",
    ASK_AGENT_FEATURE_KEY,
  );

  // 2. Build snippets if the caller didn't supply custom ones.
  const snippets = opts.snippets ?? buildTrialAgentSnippets(opts.scope);

  try {
    // 3. Call the LLM orchestrator (failover chain).
    const result = await getOrchestrator().generate<AgentResponse>({
      featureKey: ASK_AGENT_FEATURE_KEY,
      system: buildAskAgentSystemPrompt(opts.scope),
      user: buildAskAgentUserPrompt({
        scope: opts.scope,
        scopeId: opts.scopeId,
        question: safeQuestion,
        snippets,
      }),
      schema: AgentResponseSchema,
      temperature: 0.1,
      maxTokens: 1024,
    });

    // 4. F5 guard stack: schema → citationEnforcer → contraindicationCheck.
    const guardedAnswer = getAgentGuard().run(result.value, {
      feature: "F5",
      featureKey: ASK_AGENT_FEATURE_KEY,
      provider: result.provider,
      model: result.model,
    });

    return {
      status: "success",
      answer: guardedAnswer,
      sanitizedQuestion: safeQuestion,
      error: null,
      provider: result.provider,
      model: result.model,
      wallTimeMs: Date.now() - start,
    };
  } catch (err) {
    const message =
      err instanceof SafetyBlockError
        ? `Safety guard blocked F5 answer: ${err.message}`
        : (err as Error).message;
    return {
      status: "error",
      answer: null,
      sanitizedQuestion: safeQuestion,
      error: message,
      provider: null,
      model: null,
      wallTimeMs: Date.now() - start,
    };
  }
}
