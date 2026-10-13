import React from "react";
import type { AgentCitation } from "../../types/extended";

interface AgentCitationChipProps {
  citation: AgentCitation;
}

const toneColors: Record<AgentCitation["tone"], string> = {
  supporting: "var(--moss-500, #5a8a5e)",
  contradicting: "var(--brick-500, #b5453a)",
  context: "var(--slate-400, #8c8a85)",
};

// Ask Agent lives in the global SidePanel, which is rendered *outside* the
// DeepReviewPage's ReviewProvider. That means a click handler here cannot
// reach ReviewContext. We bridge the gap with a window custom event that
// EvidencePanel listens for — simple, decoupled, and survives re-mounts.
export const AgentCitationChip: React.FC<AgentCitationChipProps> = ({
  citation,
}) => {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("ctp:scroll-to-evidence", {
        detail: { id: citation.id },
      })
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      type="button"
      className="agent-citation agent-citation--clickable"
      title={`${citation.tone} evidence — click to scroll to source`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: toneColors[citation.tone],
          flexShrink: 0,
        }}
      />
      {citation.label} &middot; {citation.sourceDate}
    </button>
  );
};
