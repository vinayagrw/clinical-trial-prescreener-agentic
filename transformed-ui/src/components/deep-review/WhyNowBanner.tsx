import React from "react";
import { enrichedQueueItems } from "../../data/extendedMockData";

export interface WhyNowBannerProps {
  matchId: string;
}

export function WhyNowBanner({ matchId }: WhyNowBannerProps) {
  const enriched = enrichedQueueItems.find((q) => q.matchId === matchId);

  if (!enriched) return null;

  const items = [
    { label: "What Changed", value: enriched.whyNow.whatChanged },
    { label: "Why Urgent", value: enriched.whyNow.whyUrgent },
    { label: "Primary Blocker", value: enriched.whyNow.primaryBlocker },
    { label: "Recommended Action", value: enriched.whyNow.recommendedAction },
  ];

  return (
    <div className="why-now-banner">
      {items.map((item) => (
        <div key={item.label} className="why-now-banner__item">
          <div className="why-now-banner__label">{item.label}</div>
          <div className="why-now-banner__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
