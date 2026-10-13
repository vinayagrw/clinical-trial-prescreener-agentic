import { useEffect } from "react";
import { useKeyboard } from "../context/KeyboardContext";

interface ShortcutDef {
  id: string;
  key: string;
  modifiers?: ("ctrl" | "shift" | "alt" | "meta")[];
  handler: () => void;
  description: string;
  scope?: "global" | "mission-control" | "deep-review" | "command-palette";
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[], deps: unknown[] = []) {
  const { register, unregister } = useKeyboard();

  useEffect(() => {
    shortcuts.forEach((s) => {
      register(s.id, {
        key: s.key,
        modifiers: s.modifiers,
        handler: s.handler,
        description: s.description,
        scope: s.scope ?? "global",
      });
    });

    return () => {
      shortcuts.forEach((s) => unregister(s.id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
