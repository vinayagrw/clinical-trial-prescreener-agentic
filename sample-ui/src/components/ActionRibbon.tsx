interface ActionRibbonItem {
  label: string;
  value: string;
}

interface ActionRibbonProps {
  eyebrow: string;
  title: string;
  items: ActionRibbonItem[];
}

export function ActionRibbon({
  eyebrow,
  title,
  items
}: ActionRibbonProps) {
  return (
    <section className="action-ribbon">
      <div className="action-ribbon__header">
        <div>
          <p className="eyebrow-label">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="action-ribbon__grid">
        {items.map((item) => (
          <article key={item.label} className="action-ribbon__item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
