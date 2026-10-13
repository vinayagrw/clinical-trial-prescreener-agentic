import React from "react";
import { useApp } from "../../context/AppContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { Kbd } from "../shared/Kbd";
import { IconButton } from "../shared/IconButton";

export function CommandBar() {
  const { toggleCommandPalette, toggleTheme, theme, toggleAskAgent } = useApp();

  return (
    <header className="command-bar glass-surface glass-surface--command-bar">
      <div className="command-bar__logo">
        <span aria-hidden="true">&#9877;</span>
        CTP Pre-Screener
      </div>

      <div className="command-bar__breadcrumbs">
        <Breadcrumbs />
      </div>

      <div
        className="command-bar__search"
        role="button"
        tabIndex={0}
        onClick={toggleCommandPalette}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleCommandPalette();
          }
        }}
      >
        <span aria-hidden="true">&#128269;</span>
        <input
          type="text"
          placeholder="Search patients, trials, actions..."
          readOnly
          tabIndex={-1}
          aria-label="Open command palette"
        />
        <Kbd>Ctrl+K</Kbd>
      </div>

      <div className="command-bar__actions">
        <IconButton
          icon="&#128276;"
          label="Notifications"
          badge={3}
        />
        <IconButton
          icon={theme === "dark" ? "\u2600" : "\uD83C\uDF19"}
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        />
        <IconButton
          icon="&#128172;"
          label="Ask Agent"
          onClick={toggleAskAgent}
        />
        <button
          className="icon-btn"
          aria-label="User menu"
          type="button"
        >
          LO
        </button>
      </div>
    </header>
  );
}
