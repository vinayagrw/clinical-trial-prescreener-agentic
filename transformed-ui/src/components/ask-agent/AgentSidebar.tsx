import React from "react";
import type { SuggestedPrompt } from "../../types/extended";
import { AgentSuggestedPrompt } from "./AgentSuggestedPrompt";

interface AgentSidebarProps {
  prompts: SuggestedPrompt[];
  onPromptClick: (text: string) => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  prompts,
  onPromptClick,
}) => {
  return (
    <div className="ask-agent__sidebar">
      <div className="ask-agent__sidebar-title">
        <span role="img" aria-label="microscope">
          🔬
        </span>{" "}
        Ask Agent
      </div>
      <div className="ask-agent__sidebar-desc">
        Evidence-backed exploration of your screening queue, trial criteria, and
        patient data.
      </div>

      <div className="ask-agent__section-label">HOW TO USE IT</div>
      <div className="ask-agent__how-to">
        Ask questions about your queue, patients, or trial criteria. Responses
        include data tables, evidence citations, and confidence indicators.
      </div>

      <div className="ask-agent__section-label">SUGGESTED PROMPTS</div>
      <div className="ask-agent__prompts">
        {prompts.map((prompt) => (
          <AgentSuggestedPrompt
            key={prompt.id}
            prompt={prompt}
            onClick={onPromptClick}
          />
        ))}
      </div>
    </div>
  );
};
