import React from "react";
import { useApp } from "../../context/AppContext";
import { AskAgentPanel } from "../ask-agent/AskAgentPanel";

export function SidePanel() {
  const { sidePanelContent, closeSidePanel } = useApp();

  // Ask Agent gets its own full-panel layout — no header/content wrapper
  if (sidePanelContent === "ask-agent") {
    return (
      <aside className="side-panel glass-surface glass-surface--side-panel" style={{ width: 560 }}>
        <div className="side-panel__header">
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-h4)" }}>Ask Agent</h2>
          <button
            className="icon-btn"
            onClick={closeSidePanel}
            aria-label="Close panel"
            type="button"
          >
            &times;
          </button>
        </div>
        <div className="side-panel__content">
          <AskAgentPanel />
        </div>
      </aside>
    );
  }

  const panelTitles: Record<string, string> = {
    evidence: "Evidence Details",
    audit: "Audit Trail",
    collaboration: "Collaboration",
  };

  const title = sidePanelContent ? panelTitles[sidePanelContent] ?? "" : "";

  return (
    <aside className="side-panel glass-surface glass-surface--side-panel">
      <div className="side-panel__header">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={closeSidePanel}
          aria-label="Close panel"
          type="button"
        >
          &times;
        </button>
      </div>
      <div className="side-panel__content">
        {sidePanelContent === "evidence" && (
          <div style={{ padding: "var(--space-4)" }}>Evidence details</div>
        )}
        {sidePanelContent === "audit" && (
          <div style={{ padding: "var(--space-4)" }}>Audit trail</div>
        )}
        {sidePanelContent === "collaboration" && (
          <div style={{ padding: "var(--space-4)" }}>Collaboration</div>
        )}
      </div>
    </aside>
  );
}
