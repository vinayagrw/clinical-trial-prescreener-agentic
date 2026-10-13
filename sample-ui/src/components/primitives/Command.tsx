/*
 * Command palette primitive (lightweight).
 *
 * M1 stub: a Dialog hosting an input + filtered list of commands. No fancy
 * fuzzy matching yet — substring match is fine for the "coming soon"
 * command list shipped in M1. M2 can upgrade to `cmdk` or another matcher
 * without changing this module's public API.
 *
 * House API:
 *   <Command
 *     open={open}
 *     onOpenChange={setOpen}
 *     commands={[{ id, label, group?, shortcut?, onRun, disabled? }, …]}
 *   />
 *
 * Keyboard: Enter runs the highlighted item; arrow keys move highlight;
 * typing filters. Dialog handles Escape + focus trap.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogActions } from "./Dialog";
import { Shortcut } from "./Shortcut";

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  /** Keyboard shortcut pill rendered on the right side. */
  shortcut?: string[];
  disabled?: boolean;
  onRun: () => void;
  /** Optional keywords to boost substring matches (e.g. ["queue", "today"]). */
  keywords?: string[];
}

export interface CommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandItem[];
  placeholder?: string;
  title?: string;
  emptyMessage?: string;
}

function matchesQuery(item: CommandItem, query: string): boolean {
  if (!query.trim()) return true;
  const needle = query.toLowerCase();
  const haystack = [item.label, item.group ?? "", ...(item.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function Command({
  open,
  onOpenChange,
  commands,
  placeholder = "Search commands…",
  title = "Command palette",
  emptyMessage = "No commands match.",
}: CommandProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when palette opens; focus input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const filtered = useMemo(
    () => commands.filter((item) => matchesQuery(item, query)),
    [commands, query],
  );

  // Clamp active index when filter changes.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const key = item.group ?? "Commands";
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [filtered]);

  function runItem(item: CommandItem) {
    if (item.disabled) return;
    onOpenChange(false);
    // Defer so the dialog close animation can finish before the action runs.
    window.setTimeout(() => item.onRun(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) runItem(target);
    }
  }

  // Flat index map so group rendering still tracks highlight by absolute index.
  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} showTitle={false}>
      <div className="ctp-command-palette" role="dialog" aria-label={title}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="ctp-command-input"
          aria-label="Command search"
          aria-controls="ctp-command-list"
          aria-activedescendant={
            filtered[activeIndex]
              ? `ctp-command-item-${filtered[activeIndex].id}`
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
        />
        <div id="ctp-command-list" className="ctp-command-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="ctp-command-empty">{emptyMessage}</div>
          ) : (
            grouped.map(([groupLabel, items]) => (
              <div key={groupLabel} className="ctp-command-group" role="group" aria-label={groupLabel}>
                <div className="ctp-command-group-label">{groupLabel}</div>
                {items.map((item) => {
                  flatIndex += 1;
                  const isActive = flatIndex === activeIndex;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      id={`ctp-command-item-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      disabled={item.disabled}
                      className={`ctp-command-item${isActive ? " is-active" : ""}`}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      onClick={() => runItem(item)}
                    >
                      <span>{item.label}</span>
                      {item.shortcut ? <Shortcut keys={item.shortcut} /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <DialogActions>
          <span className="ctp-command-hint">
            Navigate <Shortcut keys={["Up"]} /> <Shortcut keys={["Down"]} /> · Select{" "}
            <Shortcut keys={["Enter"]} /> · Close <Shortcut keys={["Esc"]} />
          </span>
        </DialogActions>
      </div>
    </Dialog>
  );
}
