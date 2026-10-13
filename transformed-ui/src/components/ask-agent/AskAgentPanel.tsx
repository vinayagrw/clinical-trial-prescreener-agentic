import React, { useState, useCallback, useMemo } from "react";
import { useLocation, useParams, matchPath } from "react-router-dom";
import type { AgentMessage, AgentConversationThread } from "../../types/extended";
import {
  mockAgentConversation,
  suggestedPromptsByPage,
} from "../../data/extendedMockData";
import { getMatch, getPatient, getTrial } from "../../data/index";
import { ask, type AskAgentContext } from "../../services/askAgent";
import { AgentConversation } from "./AgentConversation";

function resolvePageKey(pathname: string): AskAgentContext["page"] {
  if (pathname.includes("mission-control")) return "mission-control";
  if (pathname.includes("review")) return "review";
  if (pathname.includes("insights")) return "insights";
  if (pathname.includes("trials")) return "trial-config";
  return "mission-control";
}

// Pull matchId out of /review/:matchId or /audit/:matchId when present.
function resolveMatchIdFromPath(pathname: string): string | undefined {
  const review = matchPath("/review/:matchId", pathname);
  if (review?.params.matchId) return review.params.matchId;
  const audit = matchPath("/audit/:matchId", pathname);
  if (audit?.params.matchId) return audit.params.matchId;
  return undefined;
}

let nextMsgId = 100;

export const AskAgentPanel: React.FC = () => {
  const location = useLocation();
  const currentPage = resolvePageKey(location.pathname);
  const prompts = suggestedPromptsByPage[currentPage] ?? [];

  const routeMatchId = resolveMatchIdFromPath(location.pathname);
  const context: AskAgentContext = useMemo(() => {
    const m = routeMatchId ? getMatch(routeMatchId) : undefined;
    return {
      page: currentPage,
      matchId: m?.id,
      patientId: m?.patientId,
      trialId: m?.trialId,
    };
  }, [currentPage, routeMatchId]);

  // Derive the context badge ("Angela Brooks · LU-021") shown in the header.
  const contextBadge = useMemo(() => {
    if (!context.matchId) return null;
    const match = getMatch(context.matchId);
    if (!match) return null;
    const patient = getPatient(match.patientId);
    const trial = getTrial(match.trialId);
    if (!patient || !trial) return null;
    return `${patient.name} · ${trial.shortCode}`;
  }, [context.matchId]);

  const [messages, setMessages] = useState<AgentMessage[]>(
    () => [...mockAgentConversation.messages]
  );
  const [isTyping, setIsTyping] = useState(false);

  const thread: AgentConversationThread = {
    ...mockAgentConversation,
    messages,
    context: {
      page: currentPage,
      patientId: context.patientId,
      matchId: context.matchId,
      trialId: context.trialId,
    },
  };

  const askRealAgent = useCallback(
    async (userText: string) => {
      setIsTyping(true);
      try {
        const result = await ask(userText, context);
        const agentMsg: AgentMessage = {
          id: `msg-auto-${++nextMsgId}`,
          role: "agent",
          content: result.content,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          citations: result.citations,
          table: result.table,
          confidenceNote: result.confidenceNote,
        };
        setMessages((prev) => [...prev, agentMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [context]
  );

  const handleSend = useCallback(
    (text: string) => {
      const userMsg: AgentMessage = {
        id: `msg-user-${++nextMsgId}`,
        role: "user",
        content: text,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, userMsg]);
      askRealAgent(text);
    },
    [askRealAgent]
  );

  const handlePromptClick = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  return (
    <div className="ask-agent ask-agent--panel">
      {contextBadge && (
        <div className="ask-agent__context-badge" role="status">
          <span className="ask-agent__context-badge-dot" aria-hidden="true" />
          <span className="ask-agent__context-badge-label">Context</span>
          <span className="ask-agent__context-badge-value">{contextBadge}</span>
        </div>
      )}
      <AgentConversation
        thread={thread}
        onSend={handleSend}
        isTyping={isTyping}
        suggestedPrompts={prompts}
        onPromptClick={handlePromptClick}
      />
    </div>
  );
};
