/*
 * useVizKeyboardNav — roving tabindex across a 1D or 2D grid of datum nodes.
 *
 * Every viz that exposes interactive datums uses this hook so the coordinator
 * can traverse them with arrow keys. One datum is focusable at a time (tabindex=0);
 * the rest are -1. Arrow keys move the focused index; Home/End jump to extremes;
 * Enter/Space activate the onActivate callback; Escape calls onEscape.
 *
 * The hook is layout-agnostic — the consumer tells it the total count and the
 * number of columns (1 for horizontal lists, N for grids). It does not mount
 * any DOM itself.
 */

import { useCallback, useState, type KeyboardEvent } from "react";

export interface VizKeyboardNavOptions {
  count: number;
  columns?: number; // default 1 (linear list)
  onActivate?: (index: number) => void;
  onEscape?: () => void;
  initialIndex?: number;
}

export interface VizKeyboardNavResult {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  getTabIndex: (index: number) => 0 | -1;
  onKeyDown: (event: KeyboardEvent<Element>) => void;
}

export function useVizKeyboardNav({
  count,
  columns = 1,
  onActivate,
  onEscape,
  initialIndex = 0
}: VizKeyboardNavOptions): VizKeyboardNavResult {
  const [focusedIndex, setFocusedIndex] = useState<number>(
    Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0))
  );

  const getTabIndex = useCallback(
    (index: number): 0 | -1 => (index === focusedIndex ? 0 : -1),
    [focusedIndex]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<Element>) => {
      if (count === 0) return;
      let next = focusedIndex;
      switch (event.key) {
        case "ArrowRight":
          next = Math.min(focusedIndex + 1, count - 1);
          break;
        case "ArrowLeft":
          next = Math.max(focusedIndex - 1, 0);
          break;
        case "ArrowDown":
          next = Math.min(focusedIndex + columns, count - 1);
          break;
        case "ArrowUp":
          next = Math.max(focusedIndex - columns, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = count - 1;
          break;
        case "Enter":
        case " ":
          onActivate?.(focusedIndex);
          event.preventDefault();
          return;
        case "Escape":
          onEscape?.();
          return;
        default:
          return;
      }
      event.preventDefault();
      setFocusedIndex(next);
    },
    [count, columns, focusedIndex, onActivate, onEscape]
  );

  return { focusedIndex, setFocusedIndex, getTabIndex, onKeyDown };
}
