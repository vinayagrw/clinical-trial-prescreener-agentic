import { create } from "zustand";
import type { ActiveTab, WidgetPageContext } from "../types";

interface VisualFocusState {
  routeKind: WidgetPageContext["routeKind"] | null;
  contextLabel: string;
  activeTab: ActiveTab | null;
  terms: string[];
  setFocus: (payload: {
    routeKind: WidgetPageContext["routeKind"];
    contextLabel: string;
    activeTab: ActiveTab;
    terms: string[];
  }) => void;
  clearFocus: () => void;
}

export const useVisualFocusStore = create<VisualFocusState>((set) => ({
  routeKind: null,
  contextLabel: "",
  activeTab: null,
  terms: [],
  setFocus: (payload) => set(payload),
  clearFocus: () =>
    set({
      routeKind: null,
      contextLabel: "",
      activeTab: null,
      terms: []
    })
}));

