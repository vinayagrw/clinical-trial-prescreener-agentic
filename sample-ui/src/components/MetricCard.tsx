import type { CSSProperties } from "react";
import { Sparkline } from "./viz";

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  /** V6 — optional inline sparkline; when omitted the card renders as before. */
  trend?: readonly number[];
  trendLabel?: string;
  /**
   * Wave B — entrance stagger in ms. The `.metric-card` CSS reads
   * `--metric-delay` and feeds it to `animation-delay`, so a grid of cards
   * cascades in rather than popping all at once. Defaults to 0 (instant).
   */
  delay?: number;
}

export function MetricCard({
  label,
  value,
  detail,
  trend,
  trendLabel,
  delay = 0
}: MetricCardProps) {
  const showTrend = trend && trend.length > 1;
  const style = delay
    ? ({ ["--metric-delay"]: `${delay}ms` } as CSSProperties)
    : undefined;
  return (
    <article className="metric-card" style={style}>
      <p className="eyebrow-label">{label}</p>
      <div className="metric-card__value-row">
        <strong>{value}</strong>
        {showTrend ? (
          <Sparkline
            values={trend as readonly number[]}
            label={trendLabel ?? label}
            width={96}
            height={28}
          />
        ) : null}
      </div>
      {detail ? <p>{detail}</p> : null}
    </article>
  );
}
