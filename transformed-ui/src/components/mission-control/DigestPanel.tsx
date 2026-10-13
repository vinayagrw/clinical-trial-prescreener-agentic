import React from "react";
import { useApp } from "../../context/AppContext";
import { changeDigest } from "../../data/extendedMockData";
import { filterDigestByImpact } from "../../data/helpers";
import { StatusDot } from "../shared/StatusDot";

const impactDotStatus: Record<string, string> = {
  high: "fail",
  medium: "uncertain",
  low: "manual_review",
};

export function DigestPanel() {
  const { digestCollapsed, toggleDigest } = useApp();

  // Sort: high impact first, then medium, then low
  const sortedItems = [...changeDigest].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.impactLevel] ?? 3) - (order[b.impactLevel] ?? 3);
  });

  return (
    <div className="digest-panel">
      <div className="digest-panel__header" onClick={toggleDigest} role="button" tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleDigest();
          }
        }}
      >
        <span className="digest-panel__title">
          <span role="img" aria-label="overnight">&#127769;</span>
          {changeDigest.length} changes overnight
        </span>
        <span
          className={`lane-header__toggle${digestCollapsed ? " lane-header__toggle--collapsed" : ""}`}
        >
          &#9662;
        </span>
      </div>
      {!digestCollapsed && (
        <div className="digest-panel__list">
          {sortedItems.map((item) => (
            <div key={item.id} className="digest-panel__item">
              <span className="digest-panel__item-time">{item.timestamp}</span>
              <StatusDot
                status={impactDotStatus[item.impactLevel] ?? "info"}
                size="sm"
              />
              <span>{item.summary}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
