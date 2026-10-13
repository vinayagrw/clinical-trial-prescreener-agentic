import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveScopeFromPath } from "../agent/scope";
import { getAssistantSession } from "../data/assistantData";
import {
  buildHandoffAgentSnippets,
  buildHandoffAssistantSession,
  type HandoffAssistantResources,
} from "../data/handoffAssistantData";
import {
  useHandoffAuditQuery,
  useHandoffQuery,
  usePatientDocumentsQuery,
  useWorklistQuery,
} from "../data/queries/handoffs";
import { useReviewDecisionMutation } from "../data/queries/aiReviews";
import { extractHighlightTerms } from "../lib/visualAdapters";
import { useVisualFocusStore } from "../stores/visualFocus";
import type {
  ActiveTab,
  AssistantResponse,
  AssistantSession,
  CitationRef,
  WidgetPageContext,
  WidgetState,
  WidgetThreadEntry
} from "../types";
import { StatusChip } from "./StatusChip";
import type { ProviderName } from "../lib/ai/providers";
import {
  type AgentScope,
} from "../lib/ai/prompts/askAgent";
import {
  type AgentResponse as GroundedAgentResponse,
} from "../lib/ai/schemas";
import { runAskAgent, buildTrialAgentSnippets } from "../lib/ai/askAgentRunner";
import { getEffectiveReviewOutput, useAiReviewRunSync } from "../lib/reviews";

/* Inline SVG icons — kept co-located so the widget stays a single file.
 * Styled via currentColor + stroke rules in .ask-widget*__icon svg {}. */
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6.3 6.3l4.2 4.2M13.5 13.5l4.2 4.2M6.3 17.7l4.2-4.2M13.5 10.5l4.2-4.2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 14v6h6M20 10V4h-6M10 4H4v6M14 20h6v-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

function toneForGrounding(status: AssistantResponse["groundingStatus"]) {
  switch (status) {
    case "grounded":
      return "moss";
    case "partial":
      return "amber";
    default:
      return "brick";
  }
}

function toneForCitation(citation: CitationRef) {
  if (citation.tone === "warning") {
    return "amber";
  }

  if (citation.tone === "supporting") {
    return "moss";
  }

  return "paper";
}

function fallbackSessionForContext(context: WidgetPageContext) {
  switch (context.routeKind) {
    case "review":
      return getAssistantSession("review-match-001");
    case "audit":
      return getAssistantSession("audit-match-001");
    case "trial_admin":
      return getAssistantSession("trial-admin");
    case "command_center":
      return getAssistantSession("command-center");
    default:
      return getAssistantSession("cockpit");
  }
}

function isHandoffRoute(routeKind: WidgetPageContext["routeKind"]) {
  return (
    routeKind === "handoff_worklist" ||
    routeKind === "handoff_case" ||
    routeKind === "handoff_audit"
  );
}

function hydrateContextLabel(
  baseContext: WidgetPageContext,
  options: {
    worklistCount: number;
    recordLabel?: string;
    auditLabel?: string;
  },
): WidgetPageContext {
  switch (baseContext.routeKind) {
    case "handoff_worklist":
      return {
        ...baseContext,
        label:
          options.worklistCount > 0
            ? `Resident handoff worklist / ${options.worklistCount} active`
            : "Resident handoff worklist",
      };
    case "handoff_case":
      return {
        ...baseContext,
        label: options.recordLabel ?? baseContext.label,
      };
    case "handoff_audit":
      return {
        ...baseContext,
        label: options.auditLabel ?? options.recordLabel ?? baseContext.label,
      };
    default:
      return baseContext;
  }
}

function sessionForContext(
  context: WidgetPageContext,
  handoffResources: HandoffAssistantResources,
) {
  if (!isHandoffRoute(context.routeKind)) {
    return getAssistantSession(context.sessionId) ?? fallbackSessionForContext(context);
  }

  return buildHandoffAssistantSession(context, handoffResources);
}

function findPromptId(session: AssistantSession, question: string) {
  const normalizedQuestion = question.toLowerCase();

  const bestPrompt = session.prompts
    .map((prompt) => {
      const promptText = `${prompt.label} ${prompt.prompt}`.toLowerCase();
      let score = 0;

      normalizedQuestion.split(/\s+/).forEach((token) => {
        if (token.length > 3 && promptText.includes(token)) {
          score += 1;
        }
      });

      return { id: prompt.id, score };
    })
    .sort((left, right) => right.score - left.score)[0];

  if (!bestPrompt || bestPrompt.score === 0) {
    return session.defaultPromptId;
  }

  return bestPrompt.id;
}

function responseForPrompt(session: AssistantSession, promptId: string) {
  return (
    session.responses.find((response) => response.promptId === promptId) ??
    session.responses[0]
  );
}

function defaultTabForResponse(
  response: AssistantResponse,
  routeKind: WidgetPageContext["routeKind"]
): ActiveTab {
  if (response.draftSections?.length) {
    return "draft";
  }

  if (routeKind === "audit" || routeKind === "handoff_audit") {
    return "trace";
  }

  return "answer";
}

function createContextMarker(context: WidgetPageContext): WidgetThreadEntry {
  return {
    id: `context-${context.key}-${Date.now()}`,
    type: "context",
    contextKey: context.key,
    contextLabel: context.label,
    detail: `Context available: ${context.label}`
  };
}

function buildBreadcrumbs(context: WidgetPageContext) {
  switch (context.routeKind) {
    case "review":
      return ["Queue", "Patient + Trial", context.label];
    case "audit":
      return ["Queue", "Trace Replay", context.label];
    case "trial_admin":
      return ["Admin", "Protocol Control", context.label];
    case "command_center":
      return ["Workspace", "Portfolio", context.label];
    case "handoff_worklist":
      return ["Handoffs", "Worklist", context.label];
    case "handoff_case":
      return ["Handoffs", "Case Summary", context.label];
    case "handoff_audit":
      return ["Handoffs", "Audit Trail", context.label];
    default:
      return ["Queue", "Cockpit", context.label];
  }
}

/** Map the widget's route kind to the scope-bound F5 ask-agent scope. */
function scopeForRoute(routeKind: WidgetPageContext["routeKind"]): AgentScope {
  switch (routeKind) {
    case "review":
      return "patient";
    case "audit":
      return "audit";
    case "handoff_case":
      return "patient";
    case "handoff_audit":
      return "audit";
    case "trial_admin":
      return "trial";
    case "command_center":
      return "queue";
    case "cockpit":
      return "queue";
    case "handoff_worklist":
      return "queue";
    default:
      return "global";
  }
}

/** Tone for the new GroundedAgentResponse enum — differs from the canned one because it uses "ungrounded" instead of "uncertain". */
function toneForLiveGrounding(
  status: GroundedAgentResponse["groundingStatus"],
): "moss" | "amber" | "brick" {
  switch (status) {
    case "grounded":
      return "moss";
    case "partial":
      return "amber";
    case "ungrounded":
      return "brick";
  }
}

interface LiveAgentState {
  status: "idle" | "running" | "success" | "error";
  answer: GroundedAgentResponse | null;
  error: string | null;
  question: string;
  provider: ProviderName | null;
  model: string | null;
}

const IDLE_LIVE_AGENT: LiveAgentState = {
  status: "idle",
  answer: null,
  error: null,
  question: "",
  provider: null,
  model: null,
};

export function GlobalAskWidget() {
  const location = useLocation();
  const routeContext = useMemo(
    () => resolveScopeFromPath(location.pathname),
    [location.pathname]
  );
  const baseContext = routeContext.widgetContext;
  const worklistQuery = useWorklistQuery(baseContext.routeKind === "handoff_worklist");
  const handoffQuery = useHandoffQuery(
    baseContext.routeKind === "handoff_case" || baseContext.routeKind === "handoff_audit"
      ? baseContext.handoffId
      : undefined,
  );
  const handoffAuditQuery = useHandoffAuditQuery(
    baseContext.routeKind === "handoff_audit" ? baseContext.handoffId : undefined,
  );
  const handoffDocumentsQuery = usePatientDocumentsQuery(
    handoffQuery.data?.patientId,
    handoffQuery.data?.windowHours,
  );
  const availableContext = useMemo(
    () =>
      hydrateContextLabel(baseContext, {
        worklistCount: worklistQuery.data?.items.length ?? 0,
        recordLabel: handoffQuery.data
          ? `${handoffQuery.data.patientName} / ${handoffQuery.data.primaryService}`
          : undefined,
        auditLabel: handoffQuery.data
          ? `${handoffQuery.data.patientName} audit / ${handoffQuery.data.primaryService}`
          : undefined,
      }),
    [baseContext, handoffQuery.data, worklistQuery.data?.items.length]
  );

  const [widgetState, setWidgetState] = useState<WidgetState>("minimized");
  const [activeContext, setActiveContext] = useState<WidgetPageContext | null>(null);
  const [pendingContextSwitch, setPendingContextSwitch] =
    useState<WidgetPageContext | null>(null);
  const [dismissedContextKey, setDismissedContextKey] = useState("");
  const [threadEntries, setThreadEntries] = useState<WidgetThreadEntry[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [activeResponseId, setActiveResponseId] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("answer");
  const [widgetNotice, setWidgetNotice] = useState("");
  // F5 live agent state — fills when the user sends a free-text question.
  const [liveAgent, setLiveAgent] = useState<LiveAgentState>(IDLE_LIVE_AGENT);
  const [askReviewRationale, setAskReviewRationale] = useState("");
  const [askReviewDraft, setAskReviewDraft] = useState("");
  const setVisualFocus = useVisualFocusStore((state) => state.setFocus);
  const clearVisualFocus = useVisualFocusStore((state) => state.clearFocus);
  const focusTermCount = useVisualFocusStore((state) => state.terms.length);

  const handoffResources = useMemo<HandoffAssistantResources>(
    () => ({
      worklistItems: worklistQuery.data?.items,
      record: handoffQuery.data,
      audit: handoffAuditQuery.data,
      documents: handoffDocumentsQuery.data?.documents ?? handoffQuery.data?.documents,
      isLoading:
        baseContext.routeKind === "handoff_worklist"
          ? worklistQuery.isLoading
          : baseContext.routeKind === "handoff_case"
            ? handoffQuery.isLoading || handoffDocumentsQuery.isLoading
            : baseContext.routeKind === "handoff_audit"
              ? handoffQuery.isLoading || handoffAuditQuery.isLoading
              : false,
      errorMessage:
        worklistQuery.error?.message ??
        handoffQuery.error?.message ??
        handoffAuditQuery.error?.message ??
        handoffDocumentsQuery.error?.message ??
        null,
    }),
    [
      baseContext.routeKind,
      handoffAuditQuery.data,
      handoffAuditQuery.error?.message,
      handoffAuditQuery.isLoading,
      handoffDocumentsQuery.data?.documents,
      handoffDocumentsQuery.error?.message,
      handoffDocumentsQuery.isLoading,
      handoffQuery.data,
      handoffQuery.error?.message,
      handoffQuery.isLoading,
      worklistQuery.data?.items,
      worklistQuery.error?.message,
      worklistQuery.isLoading,
    ],
  );
  const effectiveContext = activeContext ?? availableContext;
  const activeSession = useMemo(
    () => sessionForContext(effectiveContext, handoffResources),
    [effectiveContext, handoffResources],
  );
  const activeResponse =
    activeSession && activeResponseId
      ? activeSession.responses.find((response) => response.id === activeResponseId)
      : undefined;
  const displayedResponse =
    activeResponse ??
    (activeSession && selectedPromptId
      ? responseForPrompt(activeSession, selectedPromptId)
      : activeSession?.responses[0]);
  const successfulLiveAnswer =
    liveAgent.status === "success" && liveAgent.answer
      ? liveAgent.answer
      : null;
  const liveReviewRun = useAiReviewRunSync(
    successfulLiveAnswer
      ? {
          sourceKey: `ask-agent:${effectiveContext.key}:${liveAgent.question}`,
          featureKey: "F5_grounded_ask_agent",
          featureLabel: "F5 Grounded Ask Agent",
          stageKey: "agent_answer",
          workspace: "ask_agent",
          entityType: "assistant_answer",
          entityId: `${effectiveContext.key}:${liveAgent.question}`,
          entityLabel: `${effectiveContext.label} / ${liveAgent.question.slice(0, 48)}`,
          deepLink: location.pathname,
          summary: successfulLiveAnswer.answer,
          promptSnapshot: {
            scope: scopeForRoute(effectiveContext.routeKind),
            question: liveAgent.question,
          },
          inputSnapshot: {
            contextKey: effectiveContext.key,
            contextLabel: effectiveContext.label,
            routeKind: effectiveContext.routeKind,
          },
          outputSnapshot: successfulLiveAnswer,
          provider: liveAgent.provider,
          model: liveAgent.model,
          policy: "preview_only",
          allowedActions: [
            "approve_as_is",
            "edit_output",
            "reject",
            "escalate_manual_review",
            "revert_to_ai_draft",
          ],
          editableFields: ["outputSnapshot", "citations"],
          requiredFields: ["rationale"],
          citations: successfulLiveAnswer.citations.map((citation) => ({
            id: citation.evidenceId,
            label: `${citation.source} · ${citation.sourceDate}`,
            detail: citation.excerpt,
            quote: citation.excerpt,
            tone:
              successfulLiveAnswer.groundingStatus === "grounded"
                ? "supporting"
                : "warning",
          })),
          safetyFlags: [
            ...(successfulLiveAnswer.groundingStatus !== "grounded"
              ? [
                  {
                    id: "ask-agent-grounding",
                    label: "Answer is not fully grounded",
                    detail: "Review before sharing because the answer is partial or ungrounded.",
                    severity: "warning" as const,
                  },
                ]
              : []),
          ],
        }
      : null,
  );
  const askReviewDecisionMutation = useReviewDecisionMutation(liveReviewRun.run?.id);
  const reviewedLiveAnswer = getEffectiveReviewOutput(liveReviewRun.run, successfulLiveAnswer);

  useEffect(() => {
    if (!reviewedLiveAnswer) {
      return;
    }
    setAskReviewDraft(reviewedLiveAnswer.answer);
    setAskReviewRationale(liveReviewRun.run?.latestDecision?.rationale ?? "");
  }, [liveReviewRun.run?.latestDecision?.rationale, reviewedLiveAnswer]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    if (!activeContext) {
      setActiveContext(availableContext);
      setThreadEntries([createContextMarker(availableContext)]);
      setSelectedPromptId(activeSession.defaultPromptId);
      setActiveResponseId(responseForPrompt(activeSession, activeSession.defaultPromptId).id);
      setActiveTab(defaultTabForResponse(responseForPrompt(activeSession, activeSession.defaultPromptId), availableContext.routeKind));
      return;
    }

    if (
      availableContext.key !== activeContext.key &&
      availableContext.key !== dismissedContextKey &&
      (!pendingContextSwitch || pendingContextSwitch.key !== availableContext.key)
    ) {
      setPendingContextSwitch(availableContext);
    }

    if (availableContext.key === activeContext.key) {
      if (
        availableContext.label !== activeContext.label ||
        availableContext.scopeLabel !== activeContext.scopeLabel ||
        availableContext.sessionId !== activeContext.sessionId
      ) {
        setActiveContext(availableContext);
      }
      setPendingContextSwitch(null);
      setDismissedContextKey("");
    }
  }, [
    activeContext,
    activeSession,
    availableContext,
    dismissedContextKey,
    pendingContextSwitch
  ]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    const hasPrompt = activeSession.prompts.some(
      (prompt) => prompt.id === selectedPromptId
    );

    if (!hasPrompt) {
      const fallbackResponse = responseForPrompt(
        activeSession,
        activeSession.defaultPromptId
      );
      setSelectedPromptId(activeSession.defaultPromptId);
      setActiveResponseId(fallbackResponse.id);
      setActiveTab(defaultTabForResponse(fallbackResponse, effectiveContext.routeKind));
    }
  }, [activeSession, effectiveContext.routeKind, selectedPromptId]);

  useEffect(() => {
    const focusEnabled =
      widgetState !== "minimized" &&
      (activeTab === "evidence" || activeTab === "draft" || activeTab === "trace");

    if (!focusEnabled || !displayedResponse) {
      clearVisualFocus();
      return;
    }

    const focusTexts =
      activeTab === "evidence"
        ? displayedResponse.citations.flatMap((citation) => [citation.label, citation.detail])
        : activeTab === "draft"
          ? displayedResponse.draftSections?.flatMap((section) => [
              section.label,
              section.content
            ]) ?? [displayedResponse.summary]
          : [displayedResponse.summary, displayedResponse.howDerived, displayedResponse.recommendedNextAction];

    setVisualFocus({
      routeKind: effectiveContext.routeKind,
      contextLabel: effectiveContext.label,
      activeTab,
      terms: extractHighlightTerms(focusTexts)
    });

    return () => {
      clearVisualFocus();
    };
  }, [
    activeTab,
    clearVisualFocus,
    displayedResponse,
    effectiveContext.label,
    effectiveContext.routeKind,
    setVisualFocus,
    widgetState
  ]);

  if (!activeSession || !displayedResponse) {
    return null;
  }

  const pendingPinnedIndicator =
    availableContext.key !== effectiveContext.key && !pendingContextSwitch;
  const breadcrumbs = buildBreadcrumbs(effectiveContext);

  const handlePrompt = (promptId: string, customQuestion?: string) => {
    const response = responseForPrompt(activeSession, promptId);
    const question = customQuestion ?? response.userQuestion;

    setSelectedPromptId(promptId);
    setActiveResponseId(response.id);
    setActiveTab(defaultTabForResponse(response, effectiveContext.routeKind));
    setThreadEntries((current) => [
      ...current,
      {
        id: `exchange-${response.id}-${Date.now()}`,
        type: "exchange",
        contextKey: effectiveContext.key,
        contextLabel: effectiveContext.label,
        sessionId: activeSession.id,
        question,
        responseId: response.id,
        responseSummary: response.summary
      }
    ]);
    setQuestionInput("");
    setWidgetNotice("");
    setWidgetState((current) => (current === "minimized" ? "drawer" : current));
  };

  const runLiveAgentQuery = async (question: string) => {
    const scope = scopeForRoute(effectiveContext.routeKind);
    const snippets = isHandoffRoute(effectiveContext.routeKind)
      ? buildHandoffAgentSnippets(effectiveContext, handoffResources)
      : buildTrialAgentSnippets(scope);

    setLiveAgent({
      status: "running",
      answer: null,
      error: null,
      question,
      provider: null,
      model: null,
    });

    const result = await runAskAgent({
      question,
      scope,
      scopeId: effectiveContext.key,
      snippets,
    });

    if (result.status === "error") {
      setLiveAgent({
        status: "error",
        answer: null,
        error: result.error,
        question: result.sanitizedQuestion,
        provider: null,
        model: null,
      });
    } else {
      setLiveAgent({
        status: "success",
        answer: result.answer,
        error: null,
        question: result.sanitizedQuestion,
        provider: result.provider,
        model: result.model,
      });
    }
  };

  const handleAsk = () => {
    const trimmed = questionInput.trim();
    if (!trimmed) {
      return;
    }

    // Keep the canned prompt-match path so pre-existing demo scripts still work,
    // AND kick a live F5 query through the orchestrator so free-text gets a real
    // (or demo-fixture) answer grounded in snippets.
    const nextPromptId = findPromptId(activeSession, trimmed);
    handlePrompt(nextPromptId, trimmed);
    void runLiveAgentQuery(trimmed);
  };

  const handleSwitchContext = () => {
    if (!pendingContextSwitch) {
      return;
    }

    const nextSession = sessionForContext(pendingContextSwitch, handoffResources);

    if (!nextSession) {
      return;
    }

    const nextResponse = responseForPrompt(nextSession, nextSession.defaultPromptId);

    setActiveContext(pendingContextSwitch);
    setThreadEntries((current) => [...current, createContextMarker(pendingContextSwitch)]);
    setSelectedPromptId(nextSession.defaultPromptId);
    setActiveResponseId(nextResponse.id);
    setActiveTab(defaultTabForResponse(nextResponse, pendingContextSwitch.routeKind));
    setPendingContextSwitch(null);
    setDismissedContextKey("");
    setWidgetNotice(`Switched Ask Agent context to ${pendingContextSwitch.label}.`);
    setWidgetState((current) => (current === "minimized" ? "drawer" : current));
  };

  const handleStayOnContext = () => {
    if (!pendingContextSwitch) {
      return;
    }

    setDismissedContextKey(pendingContextSwitch.key);
    setPendingContextSwitch(null);
    setWidgetNotice(
      `Staying on ${effectiveContext.label}. The current page context is available if you want to switch later.`
    );
  };

  const handleAction = (actionId: string) => {
    if (actionId === "attach-to-workflow") {
      setWidgetNotice("Attached the outreach brief to coordinator workflow state in the mock widget flow.");
      return;
    }

    if (actionId === "save-note") {
      setWidgetNotice("Saved the current draft as an internal coordinator note.");
      return;
    }

    if (actionId === "copy-draft") {
      setWidgetNotice("Copied the current draft in the mock widget flow.");
    }
  };

  const handleAskReviewAction = async (
    action:
      | "approve_as_is"
      | "edit_output"
      | "reject"
      | "revert_to_ai_draft",
  ) => {
    const checkpoint = liveReviewRun.run?.reviewCheckpoints[0];
    if (!liveReviewRun.run || !checkpoint) {
      return;
    }

    try {
      await askReviewDecisionMutation.mutateAsync({
        checkpointId: checkpoint.id,
        action,
        rationale:
          askReviewRationale.trim() ||
          (action === "approve_as_is"
            ? "Approved Ask Agent answer without changes."
            : action === "reject"
              ? "Rejected Ask Agent answer pending correction."
              : "Reviewed Ask Agent answer inline."),
        editedOutput:
          action === "edit_output" && reviewedLiveAnswer
            ? {
                ...reviewedLiveAnswer,
                answer: askReviewDraft,
              }
            : undefined,
      });
      setWidgetNotice(
        action === "approve_as_is"
          ? "Approved the current live answer."
          : action === "edit_output"
            ? "Saved the edited Ask Agent answer."
            : action === "reject"
              ? "Rejected the current Ask Agent answer."
              : "Reverted Ask Agent back to the AI draft.",
      );
    } catch (error) {
      setWidgetNotice(
        error instanceof Error ? error.message : "Unable to update Ask Agent review state.",
      );
    }
  };

  const openDrawer = () => {
    setWidgetState("drawer");
  };

  const bubbleBadge =
    pendingContextSwitch || pendingPinnedIndicator ? "1" : undefined;

  return (
    <>
      {widgetState === "minimized" ? (
        <button
          type="button"
          className="ask-widget-bubble"
          onClick={openDrawer}
          aria-label={`Open Ask Agent, scoped to ${effectiveContext.scopeLabel}`}
        >
          <span className="ask-widget-bubble__icon">
            <SparkleIcon />
          </span>
          <span className="ask-widget-bubble__copy">
            <strong>Ask Agent</strong>
            <span>{effectiveContext.scopeLabel}</span>
          </span>
          {bubbleBadge ? (
            <span className="ask-widget-bubble__badge" aria-label="New context available">
              {bubbleBadge}
            </span>
          ) : null}
        </button>
      ) : null}

      {widgetState !== "minimized" ? (
        <aside
          className={`ask-widget ask-widget--${widgetState}`}
          aria-label="Global Ask Agent widget"
        >
          <div className="ask-widget__header">
            <div>
              <p className="eyebrow-label">Global assistant</p>
              <h3>Ask Agent</h3>
              <div className="ask-widget__header-trust">
                <button
                  type="button"
                  className={`ask-widget__trust-pill ask-widget__trust-pill--${humanize(displayedResponse.groundingStatus).replace(/\s+/g, "-")}`}
                  onClick={() => setActiveTab("evidence")}
                  aria-label={`${humanize(displayedResponse.groundingStatus)} answer with ${displayedResponse.citations.length} citations. Open Evidence tab.`}
                >
                  <span className="ask-widget__trust-pill__dot" aria-hidden />
                  {humanize(displayedResponse.groundingStatus)} · {displayedResponse.citations.length}{" "}
                  {displayedResponse.citations.length === 1 ? "citation" : "citations"}
                </button>
              </div>
            </div>

            <div className="ask-widget__header-actions">
              <button
                type="button"
                className="ask-widget__icon-button"
                onClick={() =>
                  setWidgetState((current) =>
                    current === "expanded" ? "drawer" : "expanded"
                  )
                }
                aria-label={widgetState === "expanded" ? "Collapse widget" : "Expand widget"}
              >
                {widgetState === "expanded" ? <ChevronDownIcon /> : <ExpandIcon />}
              </button>
              <button
                type="button"
                className="ask-widget__icon-button"
                onClick={() => setWidgetState("minimized")}
                aria-label="Minimize Ask Agent"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="ask-widget__meta">
            <nav className="ask-widget__breadcrumb" aria-label="Widget context path">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`}>
                  {crumb}
                  {index < breadcrumbs.length - 1 ? (
                    <span className="ask-widget__crumb-sep" aria-hidden>
                      {" · "}
                    </span>
                  ) : null}
                </span>
              ))}
            </nav>

            <div className="ask-widget__segmented" role="tablist" aria-label="Scope">
              <button
                type="button"
                role="tab"
                aria-selected="true"
                className="ask-widget__segment ask-widget__segment--active"
              >
                {effectiveContext.label}
              </button>
              {availableContext.key !== effectiveContext.key ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected="false"
                  className="ask-widget__segment"
                  onClick={() => {
                    setPendingContextSwitch(availableContext);
                    setWidgetNotice(
                      `Page context ${availableContext.label} is ready to attach.`
                    );
                  }}
                >
                  {availableContext.label}
                </button>
              ) : null}
            </div>

            <span
              className="ask-widget__focus-count"
              aria-label={`${focusTermCount} focus terms`}
            >
              <FocusIcon />
              {focusTermCount}
            </span>
          </div>

          {pendingContextSwitch ? (
            <div className="callout callout--warning">
              <strong>New page context available</strong>
              <p>
                You are on <strong>{pendingContextSwitch.label}</strong>, but Ask Agent is
                still scoped to <strong>{effectiveContext.label}</strong>.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSwitchContext}
                >
                  Switch context
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleStayOnContext}
                >
                  Stay on current context
                </button>
              </div>
            </div>
          ) : null}

          {pendingPinnedIndicator ? (
            <div className="callout">
              <strong>Context is pinned</strong>
              <p>
                Ask Agent is still pinned to <strong>{effectiveContext.label}</strong> while
                the page is showing <strong>{availableContext.label}</strong>.
              </p>
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPendingContextSwitch(availableContext)}
                >
                  Switch to page context
                </button>
              </div>
            </div>
          ) : null}

          {widgetNotice ? (
            <div
              className="callout callout--success"
              role="status"
              aria-live="polite"
            >
              <strong>Widget status</strong>
              <p>{widgetNotice}</p>
            </div>
          ) : null}

          <section className="ask-widget__prompts">
            <div>
              <p className="eyebrow-label">{activeSession.promptGroup}</p>
              <h4>Contextual suggestions</h4>
            </div>

            <div className="ask-widget__prompt-list">
              {activeSession.prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  className={`ask-widget__prompt ${
                    prompt.id === selectedPromptId ? "ask-widget__prompt--active" : ""
                  }`}
                  onClick={() => handlePrompt(prompt.id)}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </section>

          <section className="ask-widget__thread">
            {threadEntries.map((entry) => {
              if (entry.type === "context") {
                return (
                  <div key={entry.id} className="ask-widget__context-marker">
                    <span>{entry.detail}</span>
                  </div>
                );
              }

              return (
                <div
                  key={entry.id}
                  className={`ask-widget__thread-entry ${
                    entry.responseId === displayedResponse.id
                      ? "ask-widget__thread-entry--active"
                      : ""
                  }`}
                >
                  <p className="ask-widget__thread-context">{entry.contextLabel}</p>
                  <strong>{entry.question}</strong>
                  <p>{entry.responseSummary}</p>
                </div>
              );
            })}
          </section>

          <section className="ask-widget__detail-container">
          <div className="ask-widget__tabs" role="tablist" aria-label="Answer details">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "answer"}
              className={`ask-widget__tab ${
                activeTab === "answer" ? "ask-widget__tab--active" : ""
              }`}
              onClick={() => setActiveTab("answer")}
            >
              Answer
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "evidence"}
              className={`ask-widget__tab ${
                activeTab === "evidence" ? "ask-widget__tab--active" : ""
              }`}
              onClick={() => setActiveTab("evidence")}
            >
              Evidence
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "table"}
              className={`ask-widget__tab ${
                activeTab === "table" ? "ask-widget__tab--active" : ""
              }`}
              onClick={() => setActiveTab("table")}
              disabled={!displayedResponse.supportingTable}
            >
              Table
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "draft"}
              className={`ask-widget__tab ${
                activeTab === "draft" ? "ask-widget__tab--active" : ""
              }`}
              onClick={() => setActiveTab("draft")}
              disabled={!displayedResponse.draftSections?.length}
            >
              Draft
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "trace"}
              className={`ask-widget__tab ${
                activeTab === "trace" ? "ask-widget__tab--active" : ""
              }`}
              onClick={() => setActiveTab("trace")}
            >
              Trace
            </button>
          </div>

          <div className="ask-widget__detail">
            {liveAgent.status !== "idle" && (
              <div
                className={`ask-widget__live-answer ask-widget__live-answer--${liveAgent.status}`}
                role="status"
                aria-live="polite"
              >
                <div className="ask-widget__live-answer-header">
                  <strong>Live answer</strong>
                  {liveAgent.status === "success" && reviewedLiveAnswer && (
                    <StatusChip
                      label={humanize(reviewedLiveAnswer.groundingStatus)}
                      tone={toneForLiveGrounding(reviewedLiveAnswer.groundingStatus)}
                      compact
                    />
                  )}
                  {liveAgent.provider && (
                    <span className="ask-widget__live-answer-provider">
                      via <strong>{liveAgent.provider}</strong>
                      {liveAgent.model ? ` · ${liveAgent.model}` : ""}
                    </span>
                  )}
                </div>
                {liveAgent.status === "running" && (
                  <p className="ask-widget__live-answer-body">
                    Asking the agent in the current scope…
                  </p>
                )}
                {liveAgent.status === "error" && liveAgent.error && (
                  <p className="ask-widget__live-answer-body">
                    Live agent failed: {liveAgent.error}
                  </p>
                )}
                {liveAgent.status === "success" && reviewedLiveAnswer && (
                  <>
                    <p className="ask-widget__live-answer-body">
                      {reviewedLiveAnswer.answer}
                    </p>
                    <div className="stacked-chips" style={{ marginBottom: "var(--space-3)" }}>
                      {liveReviewRun.run ? (
                        <StatusChip
                          label={`Review ${liveReviewRun.run.status.replace(/_/g, " ")}`}
                          tone={liveReviewRun.run.status === "approved" ? "moss" : "amber"}
                          compact
                        />
                      ) : null}
                      <Link className="ghost-link" to="/ai-reviews">
                        Open AI review queue
                      </Link>
                    </div>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={askReviewDraft}
                      onChange={(event) => setAskReviewDraft(event.target.value)}
                      style={{ marginBottom: "var(--space-2)" }}
                    />
                    <textarea
                      className="textarea"
                      rows={2}
                      value={askReviewRationale}
                      onChange={(event) => setAskReviewRationale(event.target.value)}
                      placeholder="Reviewer rationale"
                      style={{ marginBottom: "var(--space-2)" }}
                    />
                    <div className="action-row" style={{ marginBottom: "var(--space-3)" }}>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleAskReviewAction("approve_as_is")}
                        disabled={askReviewDecisionMutation.isPending}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleAskReviewAction("edit_output")}
                        disabled={askReviewDecisionMutation.isPending}
                      >
                        Save edit
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleAskReviewAction("reject")}
                        disabled={askReviewDecisionMutation.isPending}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleAskReviewAction("revert_to_ai_draft")}
                        disabled={askReviewDecisionMutation.isPending}
                      >
                        Revert
                      </button>
                    </div>
                    <ul className="ask-widget__live-answer-cites">
                      {reviewedLiveAnswer.citations.map((c) => (
                        <li key={c.evidenceId}>
                          <strong>{c.source}</strong> · {c.sourceDate} · &ldquo;{c.excerpt}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <div className="ask-widget__detail-top">
              <div>
                <p className="eyebrow-label">Active answer</p>
                <h4>{displayedResponse.trustBadge}</h4>
              </div>
              <div className="stacked-chips">
                <StatusChip label={humanize(displayedResponse.mode)} tone="paper" compact />
                <StatusChip label={humanize(displayedResponse.scope)} tone="teal" compact />
                <StatusChip
                  label={humanize(displayedResponse.groundingStatus)}
                  tone={toneForGrounding(displayedResponse.groundingStatus)}
                  compact
                />
              </div>
            </div>

            {activeTab === "answer" ? (
              <div className="ask-widget__detail-stack">
                <p className="ask-widget__summary">{displayedResponse.summary}</p>
                {displayedResponse.scopeMismatchWarning ? (
                  <div className="callout callout--warning">
                    <strong>Scope note</strong>
                    <p>{displayedResponse.scopeMismatchWarning}</p>
                  </div>
                ) : null}
                {displayedResponse.bullets?.length ? (
                  <ul className="ask-widget__bullet-list">
                    {displayedResponse.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="callout">
                  <strong>Recommended next action</strong>
                  <p>{displayedResponse.recommendedNextAction}</p>
                </div>
              </div>
            ) : null}

            {activeTab === "evidence" ? (
              <div className="ask-widget__detail-stack">
                {displayedResponse.citations.map((citation) => (
                  <article key={citation.id} className="ask-widget__citation">
                    <div className="card-row">
                      <strong>{citation.label}</strong>
                      <StatusChip
                        label={citation.freshness}
                        tone={toneForCitation(citation)}
                        compact
                      />
                    </div>
                    <p>{citation.detail}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {activeTab === "table" ? (
              displayedResponse.supportingTable ? (
                <div className="ask-widget__detail-stack">
                  <div className="ask-widget__table">
                    <div
                      className="ask-widget__table-row ask-widget__table-row--header"
                      style={{
                        gridTemplateColumns: `repeat(${displayedResponse.supportingTable.columns.length}, minmax(0, 1fr))`
                      }}
                    >
                      {displayedResponse.supportingTable.columns.map((column) => (
                        <span key={column}>{column}</span>
                      ))}
                    </div>
                    {displayedResponse.supportingTable.rows.map((row, rowIndex) => (
                      <div
                        key={`${displayedResponse.supportingTable?.title}-${rowIndex}`}
                        className="ask-widget__table-row"
                        style={{
                          gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`
                        }}
                      >
                        {row.map((cell, cellIndex) => (
                          <span key={`${cell}-${cellIndex}`}>{cell}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="ask-widget__empty">No structured table for this answer.</p>
              )
            ) : null}

            {activeTab === "draft" ? (
              displayedResponse.draftSections?.length ? (
                <div className="ask-widget__detail-stack">
                  <div className="card-row">
                    <strong>Outreach brief</strong>
                    <StatusChip
                      label={humanize(displayedResponse.draftReviewState ?? "ready_for_review")}
                      tone="amber"
                      compact
                    />
                  </div>
                  {displayedResponse.draftSections.map((section) => (
                    <article key={section.label} className="ask-widget__draft-card">
                      <strong>{section.label}</strong>
                      <p>{section.content}</p>
                    </article>
                  ))}
                  {displayedResponse.actions?.length ? (
                    <div className="action-row">
                      {displayedResponse.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className={
                            action.tone === "primary"
                              ? "primary-button"
                              : "secondary-button"
                          }
                          onClick={() => handleAction(action.id)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="ask-widget__empty">No draft artifact for this answer.</p>
              )
            ) : null}

            {activeTab === "trace" ? (
              <div className="ask-widget__detail-stack">
                <div className="ask-widget__trace-card">
                  <strong>How was this derived?</strong>
                  <p>{displayedResponse.howDerived}</p>
                </div>
                <div className="callout">
                  <strong>Current context</strong>
                  <p>{effectiveContext.label}</p>
                </div>
              </div>
            ) : null}
            </div>
          </section>

          <div className="ask-widget__composer">
            <input
              className="input"
              value={questionInput}
              placeholder="Ask a question about the current context..."
              onChange={(event) => setQuestionInput(event.target.value)}
            />
            <button type="button" className="primary-button" onClick={handleAsk}>
              Ask
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
