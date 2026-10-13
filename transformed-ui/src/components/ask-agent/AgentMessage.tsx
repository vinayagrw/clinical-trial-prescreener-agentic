import React from "react";
import type { AgentMessage as AgentMessageType } from "../../types/extended";
import { AgentDataTable } from "./AgentDataTable";
import { AgentCitationChip } from "./AgentCitationChip";

interface AgentMessageProps {
  message: AgentMessageType;
}

/**
 * Parse markdown-style bold (**text**) and newlines into React elements.
 * Splits on double newlines into paragraphs, and converts **bold** to <strong>.
 */
function renderFormattedContent(content: string): React.ReactNode {
  const paragraphs = content.split("\n\n");

  return paragraphs.map((paragraph, pIdx) => {
    // Split single newlines within a paragraph into line segments
    const lines = paragraph.split("\n");
    const lineElements: React.ReactNode[] = [];

    lines.forEach((line, lIdx) => {
      if (lIdx > 0) {
        lineElements.push(<br key={`br-${pIdx}-${lIdx}`} />);
      }
      // Parse **bold** markers
      const parts = line.split(/(\*\*.*?\*\*)/g);
      parts.forEach((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          lineElements.push(
            <strong key={`b-${pIdx}-${lIdx}-${partIdx}`}>
              {part.slice(2, -2)}
            </strong>
          );
        } else {
          lineElements.push(part);
        }
      });
    });

    return <p key={pIdx}>{lineElements}</p>;
  });
}

export const AgentMessage: React.FC<AgentMessageProps> = ({ message }) => {
  if (message.role === "user") {
    return (
      <div className="ask-agent__message ask-agent__message--user">
        {message.content}
      </div>
    );
  }

  return (
    <div className="ask-agent__message ask-agent__message--agent">
      <div className="ask-agent__message-text">
        {renderFormattedContent(message.content)}
      </div>

      {message.table && <AgentDataTable data={message.table} />}

      {message.citations && message.citations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {message.citations.map((citation) => (
            <AgentCitationChip key={citation.id} citation={citation} />
          ))}
        </div>
      )}

      {message.confidenceNote && (
        <p
          style={{
            fontSize: "var(--text-micro, 0.7rem)",
            fontStyle: "italic",
            color: "var(--ink-muted, #999)",
            marginTop: 8,
          }}
        >
          {message.confidenceNote}
        </p>
      )}
    </div>
  );
};
