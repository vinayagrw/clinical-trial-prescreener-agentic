import React, { createContext, useContext, useCallback, useRef, useEffect, type ReactNode } from "react";

interface ShortcutRegistration {
  key: string;
  modifiers?: ("ctrl" | "shift" | "alt" | "meta")[];
  handler: () => void;
  description: string;
  scope: "global" | "mission-control" | "deep-review" | "command-palette";
}

interface KeyboardContextValue {
  register: (id: string, shortcut: ShortcutRegistration) => void;
  unregister: (id: string) => void;
  activeScope: string;
  setActiveScope: (scope: string) => void;
  getShortcuts: () => Map<string, ShortcutRegistration>;
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const registryRef = useRef<Map<string, ShortcutRegistration>>(new Map());
  const scopeRef = useRef<string>("global");

  const register = useCallback((id: string, shortcut: ShortcutRegistration) => {
    registryRef.current.set(id, shortcut);
  }, []);

  const unregister = useCallback((id: string) => {
    registryRef.current.delete(id);
  }, []);

  const setActiveScope = useCallback((scope: string) => {
    scopeRef.current = scope;
  }, []);

  const getShortcuts = useCallback(() => {
    return new Map(registryRef.current);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if focus is in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        if (e.key !== "Escape") return;
      }

      const modifiers = {
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };

      for (const [, shortcut] of registryRef.current) {
        // Check scope
        if (shortcut.scope !== "global" && shortcut.scope !== scopeRef.current) continue;

        // Check key match
        if (shortcut.key.toLowerCase() !== e.key.toLowerCase()) continue;

        // Check modifiers
        const requiredMods = shortcut.modifiers ?? [];
        const ctrlRequired = requiredMods.includes("ctrl") || requiredMods.includes("meta");
        const shiftRequired = requiredMods.includes("shift");
        const altRequired = requiredMods.includes("alt");

        if (ctrlRequired !== modifiers.ctrl) continue;
        if (shiftRequired !== modifiers.shift) continue;
        if (altRequired !== modifiers.alt) continue;

        // Match found
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value: KeyboardContextValue = {
    register,
    unregister,
    activeScope: scopeRef.current,
    setActiveScope,
    getShortcuts,
  };

  return <KeyboardContext.Provider value={value}>{children}</KeyboardContext.Provider>;
}

export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error("useKeyboard must be used within KeyboardProvider");
  return ctx;
}
