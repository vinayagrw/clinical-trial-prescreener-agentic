import React from "react";
import { trialVersions } from "../../data/index";

export function ProtocolTimeline() {
  return (
    <div style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          position: "relative",
          paddingBottom: "var(--space-4)",
        }}
      >
        {/* Connecting line */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 24,
            right: 24,
            height: 2,
            background: "var(--slate-200)",
            zIndex: 0,
          }}
        />

        {/* Version nodes */}
        {trialVersions.map((version, index) => {
          const isActive = version.status === "Current in pilot";
          return (
            <div
              key={version.id}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* Dot */}
              <div
                style={{
                  width: isActive ? 16 : 10,
                  height: isActive ? 16 : 10,
                  borderRadius: "50%",
                  background: isActive ? "var(--teal-500)" : "var(--slate-300)",
                  border: isActive ? "3px solid var(--teal-100)" : "none",
                  marginBottom: "var(--space-2)",
                }}
              />

              {/* Version label */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-small)",
                  fontWeight: isActive ? "var(--weight-bold)" : "var(--weight-medium)",
                  color: isActive ? "var(--teal-500)" : "var(--ink-muted)",
                }}
              >
                {version.version}
              </span>

              {/* Date */}
              <span
                style={{
                  fontSize: "var(--text-micro)",
                  color: "var(--ink-muted)",
                  marginTop: "var(--space-1)",
                }}
              >
                {version.releasedAt}
              </span>

              {/* Status */}
              <span
                style={{
                  fontSize: "var(--text-micro)",
                  fontWeight: "var(--weight-medium)",
                  color: isActive ? "var(--teal-500)" : "var(--slate-400)",
                  marginTop: "var(--space-1)",
                }}
              >
                {version.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
