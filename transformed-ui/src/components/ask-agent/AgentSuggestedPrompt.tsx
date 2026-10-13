import React from "react";
import type { SuggestedPrompt } from "../../types/extended";

interface AgentSuggestedPromptProps {
  prompt: SuggestedPrompt;
  onClick: (text: string) => void;
}

export const AgentSuggestedPrompt: React.FC<AgentSuggestedPromptProps> = ({
  prompt,
  onClick,
}) => {
  return (
    <button
      className="ask-agent__prompt-card"
      onClick={() => onClick(prompt.text)}
      type="button"
    >
      <span>{prompt.icon}</span> {prompt.text}
    </button>
  );
};
