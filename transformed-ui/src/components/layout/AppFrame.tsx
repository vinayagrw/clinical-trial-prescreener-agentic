import React from "react";
import { useApp } from "../../context/AppContext";
import { CommandBar } from "./CommandBar";
import { PrimaryNav } from "./PrimaryNav";
import { SidePanel } from "./SidePanel";
import { CommandPalette } from "./CommandPalette";

export interface AppFrameProps {
  children: React.ReactNode;
}

export function AppFrame({ children }: AppFrameProps) {
  const {
    sidePanelOpen,
    commandPaletteOpen,
    closeSidePanel,
    demoBannerDismissed,
    dismissDemoBanner,
  } = useApp();

  const frameClasses = [
    "app-frame",
    sidePanelOpen ? "app-frame--with-panel" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={frameClasses}>
      <CommandBar />
      <PrimaryNav />

      {!demoBannerDismissed && (
        <div className="app-banner" role="status">
          <span className="app-banner__icon" aria-hidden="true">ⓘ</span>
          <span className="app-banner__text">
            Demo mode — in-app overrides and filters reset on page reload
          </span>
          <button
            type="button"
            className="app-banner__dismiss"
            onClick={dismissDemoBanner}
            aria-label="Dismiss demo banner"
          >
            ×
          </button>
        </div>
      )}

      <main className="page-body">{children}</main>

      {sidePanelOpen && (
        <>
          <div
            className="side-panel-overlay"
            onClick={closeSidePanel}
            aria-hidden="true"
          />
          <SidePanel />
        </>
      )}

      {commandPaletteOpen && <CommandPalette />}
    </div>
  );
}
