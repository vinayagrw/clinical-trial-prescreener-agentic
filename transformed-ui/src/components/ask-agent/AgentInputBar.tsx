import React, { useState, useCallback } from "react";

interface AgentInputBarProps {
  onSend: (text: string) => void;
  placeholder?: string;
}

export const AgentInputBar: React.FC<AgentInputBarProps> = ({
  onSend,
  placeholder = "Ask about your queue, patients, or trial criteria...",
}) => {
  const [value, setValue] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="ask-agent__input-bar">
      <input
        className="ask-agent__input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <button
        className="ask-agent__send-btn"
        onClick={handleSend}
        type="button"
        aria-label="Send message"
      >
        &#x2192;
      </button>
    </div>
  );
};
