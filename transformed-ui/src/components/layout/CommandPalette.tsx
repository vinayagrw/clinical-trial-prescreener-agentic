import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { patients, trials, queueItems } from "../../data/index";

interface PaletteItem {
  id: string;
  icon: string;
  label: string;
  meta: string;
  action: () => void;
}

export function CommandPalette() {
  const { setCommandPaletteOpen } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setCommandPaletteOpen(false);
  }, [setCommandPaletteOpen]);

  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    // Patients
    patients.forEach((p) => {
      const queueItem = queueItems.find((q) => q.patientId === p.id);
      const matchId = queueItem?.matchId ?? "match-001";
      items.push({
        id: `patient-${p.id}`,
        icon: "\uD83D\uDC64",
        label: p.name,
        meta: `${p.mrn} - ${p.diseaseArea}`,
        action: () => {
          navigate(`/review/${matchId}`);
          close();
        },
      });
    });

    // Trials
    trials.forEach((t) => {
      items.push({
        id: `trial-${t.id}`,
        icon: "\uD83E\uDDEA",
        label: `${t.shortCode} - ${t.title}`,
        meta: `${t.phase} - ${t.diseaseArea}`,
        action: () => {
          navigate(`/trials/${t.id}`);
          close();
        },
      });
    });

    // Pages
    const pages: { label: string; route: string }[] = [
      { label: "Mission Control", route: "/" },
      { label: "Insights", route: "/insights" },
    ];
    pages.forEach((page) => {
      items.push({
        id: `page-${page.route}`,
        icon: "\uD83D\uDCC4",
        label: page.label,
        meta: "Page",
        action: () => {
          navigate(page.route);
          close();
        },
      });
    });

    // Actions
    const actions: { label: string; handler: () => void }[] = [
      {
        label: "Toggle Dark Mode",
        handler: () => {
          close();
        },
      },
    ];
    actions.forEach((act, i) => {
      items.push({
        id: `action-${i}`,
        icon: "\u26A1",
        label: act.label,
        meta: "Action",
        action: act.handler,
      });
    });

    return items;
  }, [navigate, close]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const lower = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.meta.toLowerCase().includes(lower)
    );
  }, [allItems, query]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev <= 0 ? Math.max(filtered.length - 1, 0) : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [filtered, activeIndex, close]
  );

  return (
    <div className="command-palette-overlay" onClick={close}>
      <div
        className="command-palette glass-surface glass-surface--elevated"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette__input">
          <span aria-hidden="true">&#128269;</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search patients, trials, pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command palette search"
          />
        </div>
        <div className="command-palette__results" role="listbox">
          {filtered.map((item, index) => (
            <div
              key={item.id}
              className={`command-palette__item ${
                index === activeIndex ? "command-palette__item--active" : ""
              }`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => item.action()}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="command-palette__item-label">{item.label}</span>
              <span className="command-palette__item-meta">{item.meta}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="command-palette__item">
              <span className="command-palette__item-label">No results found</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
