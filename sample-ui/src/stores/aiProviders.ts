/*
 * aiProviders store — bridges the LlmOrchestrator's internal health map
 * into React via Zustand. Components subscribe to `useAiProvidersStore`
 * to show the live health indicator in the app header.
 *
 * Mount `useAiProvidersSync()` once in App.tsx so the store stays in
 * sync with orchestrator health changes without leaking listeners.
 */

import { useEffect } from "react";
import { create } from "zustand";
import {
  getOrchestrator,
  type ProviderHealthMap,
  type ProviderName,
} from "../lib/ai/providers";

interface AiProvidersState {
  health: ProviderHealthMap;
  order: ProviderName[];
  demoMode: boolean;
  lastRefreshedAt: string | null;
  setHealth: (h: ProviderHealthMap) => void;
  setDemoMode: (enabled: boolean) => void;
  refresh: () => Promise<void>;
}

export const useAiProvidersStore = create<AiProvidersState>((set) => {
  const orchestrator = getOrchestrator();
  return {
    health: orchestrator.getHealth(),
    order: orchestrator.getOrder(),
    demoMode: orchestrator.isDemoMode(),
    lastRefreshedAt: null,
    setHealth: (h) => set(() => ({ health: h })),
    setDemoMode: (enabled) => {
      orchestrator.setDemoMode(enabled);
      set(() => ({ demoMode: enabled }));
    },
    refresh: async () => {
      await orchestrator.refreshHealth();
      set(() => ({
        health: orchestrator.getHealth(),
        lastRefreshedAt: new Date().toISOString(),
      }));
    },
  };
});

/**
 * React hook — attaches a health listener to the orchestrator on mount and
 * kicks an initial refreshHealth(). Mount this once at the top of the app
 * (App.tsx) so every component sees live provider state without each
 * component owning its own subscription.
 */
export function useAiProvidersSync(): void {
  useEffect(() => {
    const orchestrator = getOrchestrator();
    const unsubscribe = orchestrator.onHealthChange((h) => {
      useAiProvidersStore.setState({ health: h });
    });
    // Kick an initial health check so the UI isn't stuck at "unknown".
    void orchestrator
      .refreshHealth()
      .then(() => {
        useAiProvidersStore.setState({
          health: orchestrator.getHealth(),
          lastRefreshedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Health failures are already recorded on the orchestrator.
      });
    return unsubscribe;
  }, []);
}
