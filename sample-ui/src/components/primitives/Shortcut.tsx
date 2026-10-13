/*
 * Shortcut — tiny visual pill for rendering keyboard shortcuts in menus,
 * tooltips, and the keyboard help overlay.
 *
 * Detects platform once at import time so we can show ⌘ on macOS and Ctrl
 * elsewhere. Passing the keys as a prop (e.g. ["Cmd", "K"]) keeps the
 * semantics portable — the component handles the glyph substitution.
 */

import type { ReactNode } from "react";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

function glyphForKey(key: string): ReactNode {
  const lower = key.toLowerCase();
  if (lower === "cmd" || lower === "meta") return isMac ? "⌘" : "Ctrl";
  if (lower === "ctrl") return "Ctrl";
  if (lower === "alt" || lower === "opt") return isMac ? "⌥" : "Alt";
  if (lower === "shift") return isMac ? "⇧" : "Shift";
  if (lower === "enter" || lower === "return") return "↵";
  if (lower === "esc" || lower === "escape") return "Esc";
  if (lower === "up") return "↑";
  if (lower === "down") return "↓";
  if (lower === "left") return "←";
  if (lower === "right") return "→";
  return key;
}

export interface ShortcutProps {
  keys: string[];
}

export function Shortcut({ keys }: ShortcutProps) {
  return (
    <span className="ctp-shortcut" aria-hidden="true">
      {keys.map((key, index) => (
        <kbd key={index} className="ctp-shortcut-key">
          {glyphForKey(key)}
        </kbd>
      ))}
    </span>
  );
}
