/*
 * Agent domain types — conversation, events, checkpoints, generative UI specs.
 *
 * The AgentEvent discriminated union is the wire format between AgentClient
 * (mock or real) and the UI layer. All streaming, tool use, refusal, and
 * component-spec behavior flows through this union.
 */

import type { Freshness, QueueDisposition } from "./clinical.ts";

// --- Legacy assistant types (preserved for widget compatibility) ---

export type AssistantScope =
  | "this_patient"
  | "this_trial"
  | "this_criterion"
  | "this_queue"
  | "workspace";

export type AssistantMode =
  | "quick_answer"
  | "case_reasoning"
  | "draft"
  | "workspace_research";

export type GroundingStatus = "grounded" | "partial" | "uncertain";
export type WidgetState = "minimized" | "drawer" | "expanded";
export type ActiveTab = "answer" | "evidence" | "table" | "draft" | "trace";

export interface AssistantAction {
  id: string;
  label: string;
  tone: "primary" | "secondary";
}

export interface CitationRef {
  id: string;
  label: string;
  detail: string;
  freshness: Freshness;
  tone: "supporting" | "warning" | "context";
}

export interface SupportingTable {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface DraftSection {
  label: string;
  content: string;
}

export interface AnswerArtifact {
  kind: "summary" | "comparison_table" | "draft" | "change_digest" | "trace";
  title: string;
  detail: string;
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  prompt: string;
  mode: AssistantMode;
  scope: AssistantScope;
}

export interface ConversationContext {
  title: string;
  scopeLabel: string;
  description: string;
  patientId?: string;
  trialId?: string;
  matchId?: string;
  criterionId?: string;
  handoffId?: string;
  encounterId?: string;
  windowHours?: 24 | 48 | 72;
}

export interface AssistantResponse {
  id: string;
  promptId: string;
  userQuestion: string;
  scope: AssistantScope;
  mode: AssistantMode;
  groundingStatus: GroundingStatus;
  trustBadge: string;
  summary: string;
  bullets?: string[];
  supportingTable?: SupportingTable;
  citations: CitationRef[];
  howDerived: string;
  recommendedNextAction: string;
  scopeMismatchWarning?: string;
  answerArtifacts?: AnswerArtifact[];
  draftType?: "outreach_brief" | "pi_handoff";
  draftReviewState?: "ready_for_review" | "attached_to_case";
  draftSections?: DraftSection[];
  actions?: AssistantAction[];
  followups?: string[];
}

export interface AssistantSession {
  id: string;
  promptGroup: string;
  context: ConversationContext;
  prompts: SuggestedPrompt[];
  responses: AssistantResponse[];
  defaultPromptId: string;
}

export interface WidgetPageContext {
  key: string;
  label: string;
  scopeLabel: string;
  sessionId: string;
  routeKind:
    | "cockpit"
    | "review"
    | "command_center"
    | "trial_admin"
    | "audit"
    | "handoff_worklist"
    | "handoff_case"
    | "handoff_audit";
  handoffId?: string;
}

export interface ThreadContextMarker {
  id: string;
  type: "context";
  contextKey: string;
  contextLabel: string;
  detail: string;
}

export interface ThreadExchange {
  id: string;
  type: "exchange";
  contextKey: string;
  contextLabel: string;
  sessionId: string;
  question: string;
  responseId: string;
  responseSummary: string;
}

export type WidgetThreadEntry = ThreadContextMarker | ThreadExchange;

export interface AssistantInteraction {
  id: string;
  scope: AssistantScope;
  promptId: string;
  outputKind: "answer" | "draft" | "trace";
  savedState: "attached" | "review_only";
  timestamp: string;
}

// --- 2026 AI-first types (M2 capabilities) ---

/**
 * Renderer whitelist for generative UI. GenerativeSlot.tsx validates
 * incoming ComponentSpec.rendererName against this list and rejects unknowns.
 * Never eval. Never accept a renderer name not in this list.
 */
export type GenerativeRendererName =
  | "CompareTrialsTable"
  | "CohortChart"
  | "CounterfactualCard"
  | "DosingCard"
  | "ConsentSummary"
  | "WhatIfSimulator"
  | "SafetyCorrelationMatrix";

export interface ComponentSpec {
  rendererName: GenerativeRendererName;
  /** Renderer-specific props; validated per-renderer at the boundary (not here). */
  props: Record<string, unknown>;
}

/** Human-in-loop gate between agent-proposed steps. */
export interface Checkpoint {
  id: string;
  stepLabel: string;
  description: string;
  proposedAction:
    | {
        kind: "save_draft";
        draftType: "outreach_brief" | "pi_handoff" | "rationale";
        payload: unknown;
      }
    | {
        kind: "apply_override";
        criterionId: string;
        newStatus: "pass" | "fail" | "uncertain" | "manual_review";
      }
    | { kind: "update_disposition"; disposition: QueueDisposition }
    | { kind: "refresh_evidence"; evidenceIds: string[] };
  requiredConfirmation: "single_click" | "typed_phrase" | "second_reviewer";
}

export interface RefusalReason {
  code: "stale_evidence" | "out_of_scope" | "insufficient_grounding" | "policy_block";
  humanExplanation: string;
}

/** Discriminated union of events emitted by AgentClient.stream(). */
export type AgentEvent =
  | { kind: "text_delta"; requestId: string; delta: string }
  | {
      kind: "tool_call";
      requestId: string;
      toolName: string;
      args: unknown;
      callId: string;
    }
  | {
      kind: "tool_result";
      requestId: string;
      callId: string;
      result: unknown;
    }
  | { kind: "component_spec"; requestId: string; spec: ComponentSpec }
  | {
      kind: "checkpoint_request";
      requestId: string;
      checkpoint: Checkpoint;
    }
  | {
      kind: "refusal";
      requestId: string;
      reason: RefusalReason;
      remediation?: string;
    }
  | {
      kind: "error";
      requestId: string;
      message: string;
      recoverable: boolean;
    }
  | {
      kind: "done";
      requestId: string;
      usage: { inputTokens: number; outputTokens: number };
    };

export interface AgentScope {
  routeKind:
    | "cockpit"
    | "review"
    | "command_center"
    | "handoff_worklist"
    | "handoff_case"
    | "handoff_audit"
    | "insights"
    | "trial_admin"
    | "audit"
    | "portal"
    | "referring"
    | "sponsor"
    | "irb"
    | "data_ops";
  entityIds: {
    patientId?: string;
    trialId?: string;
    criterionId?: string;
    queueFilter?: string;
    matchId?: string;
    handoffId?: string;
    encounterId?: string;
  };
  /**
   * Confidentiality controls what data the agent is allowed to see and emit.
   * Sponsor views always receive "deidentified"; patient portal always "patient_facing".
   */
  confidentialityLevel: "internal" | "deidentified" | "patient_facing";
}
