/*
 * aiReviewMode — per-match "AI Live" toggle.
 *
 * Review Workbench is a read-only hand-review tool by default. P7 adds an
 * optional live AI overlay that surfaces F1 decomposition, F2 retrieval
 * traces, F3 evaluation, and F4 temporal reasoning against the currently
 * selected trial / patient combo. That overlay is gated behind this store so
 * the default render path stays byte-for-byte identical to today (the
 * acceptance criterion called out in the plan).
 *
 * The toggle is scoped per-matchId so you can have AI Live ON for one case
 * and OFF for another without leaking state. Default is OFF for every match.
 */

import { create } from "zustand";

interface AiReviewModeState {
  /** Map of matchId → AI Live enabled. Undefined means "not yet touched" (defaults to false). */
  enabled: Record<string, boolean>;
  setEnabled: (matchId: string, value: boolean) => void;
  toggle: (matchId: string) => void;
  isEnabled: (matchId: string) => boolean;
}

export const useAiReviewModeStore = create<AiReviewModeState>((set, get) => ({
  enabled: {},
  setEnabled: (matchId, value) =>
    set((state) => ({
      enabled: { ...state.enabled, [matchId]: value },
    })),
  toggle: (matchId) =>
    set((state) => ({
      enabled: { ...state.enabled, [matchId]: !state.enabled[matchId] },
    })),
  isEnabled: (matchId) => Boolean(get().enabled[matchId]),
}));
