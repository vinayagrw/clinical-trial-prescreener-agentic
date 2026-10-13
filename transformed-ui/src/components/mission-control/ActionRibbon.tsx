import React from "react";

export interface ActionRibbonItem {
  label: string;
  value: string;
  hint?: string;
}

interface ActionRibbonProps {
  eyebrow: string;
  title: string;
  items: ActionRibbonItem[];
}

/**
 * Compact headline strip that sits above Mission Control's metric heroes and
 * frames the day's work: "here's what changed overnight, here's what's ready
 * to act on." Ported from sample-ui/src/components/ActionRibbon.tsx
 * with a richer item shape that allows an optional hint below each metric.
 */
export function ActionRibbon({ eyebrow, title, items }: ActionRibbonProps) {
  return (
    <section className="action-ribbon glass-surface glass-surface--card">
      <div className="action-ribbon__header">
        <p className="action-ribbon__eyebrow">{eyebrow}</p>
        <h3 className="action-ribbon__title">{title}</h3>
      </div>

      <div className="action-ribbon__grid">
        {items.map((item) => (
          <article key={item.label} className="action-ribbon__item">
            <span className="action-ribbon__item-label">{item.label}</span>
            <strong className="action-ribbon__item-value">{item.value}</strong>
            {item.hint && <span className="action-ribbon__item-hint">{item.hint}</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
