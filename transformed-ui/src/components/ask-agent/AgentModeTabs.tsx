import React from "react";
import type { AgentMode } from "../../types/extended";

interface AgentModeTabsProps {
  activeMode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
}

const modes: { key: AgentMode; label: string }[] = [
  { key: "ask", label: "Ask" },
  { key: "compare", label: "Compare" },
  { key: "summarize", label: "Summarize" },
  { key: "explore", label: "Explore" },
  { key: "draft", label: "Draft" },
];

export const AgentModeTabs: React.FC<AgentModeTabsProps> = ({
  activeMode,
  onModeChange,
}) => {
  return (
    <div className="ask-agent__mode-tabs">
      {modes.map((mode) => (
        <button
          key={mode.key}
          className={`ask-agent__mode-tab${
            activeMode === mode.key ? " ask-agent__mode-tab--active" : ""
          }`}
          onClick={() => onModeChange(mode.key)}
          type="button"
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
};
