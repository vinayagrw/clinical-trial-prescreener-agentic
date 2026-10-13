import React from "react";
import { Sparkline } from "../shared/Sparkline";

const sparklineData = [
  {
    label: "Review Velocity",
    data: [8, 10, 9, 12, 11, 14, 12, 15, 13, 12],
    unit: "patients/day",
    color: "var(--teal-500)",
  },
  {
    label: "Outreach Rate",
    data: [3, 5, 4, 6, 7, 5, 8, 7, 9, 8],
    unit: "outreach/day",
    color: "var(--moss-500)",
  },
  {
    label: "Escalation Rate",
    data: [5, 4, 6, 3, 4, 2, 3, 2, 3, 2],
    unit: "escalations/day",
    color: "var(--amber-500)",
  },
];

export function VelocitySparklines() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--space-5)",
        padding: "var(--space-4)",
      }}
    >
      {sparklineData.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "var(--text-micro)",
                fontWeight: "var(--weight-bold)",
                textTransform: "uppercase" as const,
                letterSpacing: "var(--tracking-caps)",
                color: "var(--ink-muted)",
                marginBottom: "var(--space-1)",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--weight-semibold)",
                color: "var(--ink)",
              }}
            >
              {item.data[item.data.length - 1]} {item.unit}
            </div>
          </div>
          <Sparkline data={item.data} width={100} height={32} color={item.color} />
        </div>
      ))}
    </div>
  );
}
