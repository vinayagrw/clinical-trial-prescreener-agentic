import React from "react";
import { trialVersions } from "../../data/index";

interface DiffLine {
  text: string;
  type: "added" | "removed" | "changed" | "unchanged";
}

const leftLines: DiffLine[] = [
  { text: "ECOG performance status <= 1", type: "changed" },
  { text: "Prior IO therapy is exclusionary", type: "removed" },
  { text: "Screening window: 14 days for labs", type: "changed" },
  { text: "CNS metastases: no active lesions", type: "unchanged" },
  { text: "Cardiac event lookback: 6 months", type: "unchanged" },
];

const rightLines: DiffLine[] = [
  { text: "ECOG performance status <= 2 (was <= 1)", type: "changed" },
  { text: "Prior IO exclusion removed", type: "added" },
  { text: "Screening window: 21 days for labs (was 14)", type: "changed" },
  { text: "CNS metastases: no active lesions requiring therapy", type: "added" },
  { text: "Cardiac event lookback: 6 months", type: "unchanged" },
];

export function ProtocolDiff() {
  const current = trialVersions.find((v) => v.version === "v4.2");
  const previous = trialVersions.find((v) => v.version === "v4.1");

  return (
    <div className="protocol-diff">
      <div className="protocol-diff__column">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-micro)",
            fontWeight: "var(--weight-bold)",
            color: "var(--ink-muted)",
            marginBottom: "var(--space-3)",
          }}
        >
          {previous?.version ?? "v4.1"} &mdash; {previous?.releasedAt ?? ""}
        </div>
        {leftLines.map((line, i) => (
          <div
            key={i}
            className={`protocol-diff__line${line.type !== "unchanged" ? ` protocol-diff__line--${line.type}` : ""}`}
          >
            {line.text}
          </div>
        ))}
      </div>

      <div className="protocol-diff__column">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-micro)",
            fontWeight: "var(--weight-bold)",
            color: "var(--ink-muted)",
            marginBottom: "var(--space-3)",
          }}
        >
          {current?.version ?? "v4.2"} &mdash; {current?.releasedAt ?? ""}
        </div>
        {rightLines.map((line, i) => (
          <div
            key={i}
            className={`protocol-diff__line${line.type !== "unchanged" ? ` protocol-diff__line--${line.type}` : ""}`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
