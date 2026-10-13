import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Theme, TaskLane } from "../types/extended";

interface AppState {
  theme: Theme;
  selectedMatchId: string | null;
  selectedPatientId: string | null;
  commandPaletteOpen: boolean;
  sidePanelOpen: boolean;
  sidePanelContent: "evidence" | "audit" | "collaboration" | "ask-agent" | null;
  currentLane: TaskLane | null;
  digestCollapsed: boolean;
  askAgentOpen: boolean;
  demoBannerDismissed: boolean;
}

interface AppContextValue extends AppState {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSelectedMatchId: (id: string | null) => void;
  setSelectedPatientId: (id: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setSidePanelOpen: (open: boolean) => void;
  setSidePanelContent: (content: AppState["sidePanelContent"]) => void;
  openSidePanel: (content: AppState["sidePanelContent"]) => void;
  closeSidePanel: () => void;
  setCurrentLane: (lane: TaskLane | null) => void;
  setDigestCollapsed: (collapsed: boolean) => void;
  toggleDigest: () => void;
  toggleAskAgent: () => void;
  setAskAgentOpen: (open: boolean) => void;
  dismissDemoBanner: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("ctp-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return "light";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelContent, setSidePanelContent] = useState<AppState["sidePanelContent"]>(null);
  const [currentLane, setCurrentLane] = useState<TaskLane | null>(null);
  const [digestCollapsed, setDigestCollapsed] = useState(false);
  const [askAgentOpen, setAskAgentOpen] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  const dismissDemoBanner = useCallback(() => {
    setDemoBannerDismissed(true);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("ctp-theme", t); } catch {}
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((prev) => !prev);
  }, []);

  const openSidePanel = useCallback((content: AppState["sidePanelContent"]) => {
    setSidePanelContent(content);
    setSidePanelOpen(true);
  }, []);

  const closeSidePanel = useCallback(() => {
    setSidePanelOpen(false);
    setTimeout(() => setSidePanelContent(null), 300);
  }, []);

  const toggleDigest = useCallback(() => {
    setDigestCollapsed((prev) => !prev);
  }, []);

  const toggleAskAgent = useCallback(() => {
    setAskAgentOpen((prev) => {
      const next = !prev;
      if (next) {
        setSidePanelContent("ask-agent");
        setSidePanelOpen(true);
      } else {
        setSidePanelOpen(false);
        setTimeout(() => setSidePanelContent(null), 300);
      }
      return next;
    });
  }, []);

  // Set data-theme on mount
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value: AppContextValue = {
    theme,
    selectedMatchId,
    selectedPatientId,
    commandPaletteOpen,
    sidePanelOpen,
    sidePanelContent,
    currentLane,
    digestCollapsed,
    askAgentOpen,
    setTheme,
    toggleTheme,
    setSelectedMatchId,
    setSelectedPatientId,
    setCommandPaletteOpen,
    toggleCommandPalette,
    setSidePanelOpen,
    setSidePanelContent,
    openSidePanel,
    closeSidePanel,
    setCurrentLane,
    setDigestCollapsed,
    toggleDigest,
    toggleAskAgent,
    setAskAgentOpen,
    demoBannerDismissed,
    dismissDemoBanner,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
