import React from "react";
import { Link } from "react-router-dom";

export interface EntitySwitcherItem {
  /** Unique entity id — used for current-state comparison. */
  id: string;
  /** Primary chip text (e.g., "BC-077" or "Angela Brooks"). */
  label: string;
  /** Optional secondary text shown next to the primary label. For match
   *  switchers this is the trial shortcode so Priya's two-trial case
   *  disambiguates without collision. */
  sublabel?: string;
  /** Route to navigate to on click. */
  href: string;
  /** Full-context tooltip shown on hover (e.g., the full trial title). */
  title?: string;
}

interface EntitySwitcherProps {
  /** Short uppercase eyebrow label that frames the row, e.g. "Switch trial". */
  eyebrow: string;
  items: EntitySwitcherItem[];
  /** Id of the entity currently displayed on this page. */
  currentId: string;
}

/**
 * Compact horizontal chip strip that lets users flip between sibling
 * entities (trials, matches) without going back up through the primary nav.
 * Slots under the page header on Trial Config, Deep Review, and Audit Trace.
 *
 * Each chip is a real `<Link>` so right-click, middle-click, keyboard, and
 * copy-link-address all work. Returns null when there is only one sibling —
 * no point showing a one-chip switcher.
 */
export function EntitySwitcher({ eyebrow, items, currentId }: EntitySwitcherProps) {
  if (items.length <= 1) return null;

  return (
    <nav className="entity-switcher" aria-label={eyebrow}>
      <span className="entity-switcher__eyebrow">{eyebrow}</span>
      <div className="entity-switcher__chips">
        {items.map((item) => {
          const isCurrent = item.id === currentId;
          return (
            <Link
              key={item.id}
              to={item.href}
              title={item.title}
              aria-current={isCurrent ? "page" : undefined}
              className={`entity-switcher__chip${
                isCurrent ? " entity-switcher__chip--current" : ""
              }`}
            >
              <span className="entity-switcher__chip-label">{item.label}</span>
              {item.sublabel && (
                <span className="entity-switcher__chip-sublabel">
                  · {item.sublabel}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
