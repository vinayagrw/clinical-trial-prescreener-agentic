import React, { useEffect, useRef, useState } from "react";
import type { AgentConversationThread, AgentMode, SuggestedPrompt } from "../../types/extended";
import { AgentModeTabs } from "./AgentModeTabs";
import { AgentMessage } from "./AgentMessage";
import { AgentInputBar } from "./AgentInputBar";
import { AgentSuggestedPrompt } from "./AgentSuggestedPrompt";

interface AgentConversationProps {
  thread: AgentConversationThread;
  onSend: (text: string) => void;
  isTyping?: boolean;
  suggestedPrompts?: SuggestedPrompt[];
  onPromptClick?: (text: string) => void;
}

export const AgentConversation: React.FC<AgentConversationProps> = ({
  thread,
  onSend,
  isTyping = false,
  suggestedPrompts,
  onPromptClick,
}) => {
  const [activeMode, setActiveMode] = useState<AgentMode>("ask");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showPrompts, setShowPrompts] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.messages, isTyping]);

  return (
    <div className="ask-agent__conversation">
      <div className="ask-agent__conv-header">
        <span className="ask-agent__conv-title">
          AI-guided eligibility analysis
        </span>
        <span className="ask-agent__conv-badge">Evidence-backed answers</span>
      </div>

      <AgentModeTabs activeMode={activeMode} onModeChange={setActiveMode} />

      <div className="ask-agent__messages">
        {/* Inline suggested prompts for panel mode */}
        {suggestedPrompts && suggestedPrompts.length > 0 && showPrompts && (
          <div style={{ marginBottom: 12 }}>
            <div className="ask-agent__section-label" style={{ marginBottom: 8 }}>SUGGESTED PROMPTS</div>
            <div className="ask-agent__prompts">
              {suggestedPrompts.slice(0, 4).map((prompt) => (
                <AgentSuggestedPrompt
                  key={prompt.id}
                  prompt={prompt}
                  onClick={(text) => {
                    setShowPrompts(false);
                    onPromptClick?.(text);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {thread.messages.map((msg) => (
          <AgentMessage key={msg.id} message={msg} />
        ))}

        {isTyping && (
          <div className="ask-agent__typing">
            <span className="ask-agent__typing-dot" />
            <span className="ask-agent__typing-dot" />
            <span className="ask-agent__typing-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <AgentInputBar onSend={onSend} />
    </div>
  );
};
