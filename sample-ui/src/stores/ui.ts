/*
 * UI store — client state that doesn't belong in the server cache.
 *
 * TanStack Query owns server data. Zustand owns ephemeral UI: which theme,
 * whether the command palette is open, the toast queue, reduced-motion
 * override, and the bulk-selection set used by the cockpit.
 *
 * Why zustand and not useContext? Because several providers would each
 * live at the App root and re-render the whole tree on any change.
 * Zustand lets components subscribe to precisely the slice they need.
 *
 * Single source of truth rule:
 *   - Server data → useQuery
 *   - Per-component state → useState
 *   - Cross-component UI → here
 * If a new piece of state doesn't fit this table, figure out which bucket
 * it belongs to before reaching for a fourth.
 */

import { create } from "zustand";
import { loadMemory, updateMemory } from "../agent/memory";

export type ThemeName = "light" | "dark" | "hc";

export interface PendingToast {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "warning" | "critical";
  /** Optional undo callback surfaced as an action pill. */
  undo?: () => void;
  undoLabel?: string;
  /** Dismiss after N ms. Defaults to 6000. */
  durationMs?: number;
}

export interface UiStore {
  // --- Theme ---
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  // Reduced motion is applied via CSS but we mirror the OS setting here so
  // components can branch on it without rewiring a media query hook.
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;

  // --- Command palette ---
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  // --- Toast queue ---
  toasts: PendingToast[];
  pushToast: (toast: Omit<PendingToast, "id">) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;

  // --- Bulk selection (cockpit queue) ---
  bulkSelection: Set<string>;
  toggleBulkSelect: (id: string) => void;
  clearBulkSelect: () => void;
  setBulkSelect: (ids: string[]) => void;
}

function nextToastId(): string {
  // Not cryptographically unique — just needs to be stable per enqueue.
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readInitialTheme(): ThemeName {
  const memory = loadMemory();
  if (memory.themePreference) return memory.themePreference;
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  }
  return "light";
}

function readInitialReducedMotion(): boolean {
  const memory = loadMemory();
  if (memory.reducedMotion !== undefined) return memory.reducedMotion;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

export const useUiStore = create<UiStore>((set, get) => ({
  // --- Theme ---
  theme: readInitialTheme(),
  setTheme: (theme) => {
    set({ theme });
    updateMemory({ themePreference: theme });
    if (typeof document !== "undefined") {
      const classList = document.documentElement.classList;
      classList.remove("theme-light", "theme-dark", "theme-hc");
      classList.add(`theme-${theme}`);
    }
  },
  reducedMotion: readInitialReducedMotion(),
  setReducedMotion: (value) => {
    set({ reducedMotion: value });
    updateMemory({ reducedMotion: value });
  },

  // --- Command palette ---
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  // --- Toast queue ---
  toasts: [],
  pushToast: (toast) => {
    const id = nextToastId();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),

  // --- Bulk selection ---
  bulkSelection: new Set<string>(),
  toggleBulkSelect: (id) => {
    const next = new Set(get().bulkSelection);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ bulkSelection: next });
  },
  clearBulkSelect: () => set({ bulkSelection: new Set() }),
  setBulkSelect: (ids) => set({ bulkSelection: new Set(ids) }),
}));

/** Convenience selector — avoids re-renders when only unrelated state changes. */
export const selectTheme = (state: UiStore) => state.theme;
export const selectCommandPaletteOpen = (state: UiStore) => state.commandPaletteOpen;
export const selectToasts = (state: UiStore) => state.toasts;
export const selectBulkSelection = (state: UiStore) => state.bulkSelection;
