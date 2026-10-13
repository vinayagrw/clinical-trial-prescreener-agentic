import React from "react";
import type { ReleaseGate } from "../../types/extended";

interface ReleaseGateStripProps {
  gates: ReleaseGate[];
}

const STATUS_LABEL: Record<ReleaseGate["status"], string> = {
  complete: "Done",
  pending: "In review",
  blocked: "Blocked",
};

/**
 * Release-readiness checklist for a trial going live. Each gate is either
 * complete (a safety guardrail already satisfied), pending (a coordinator or
 * PI task in flight), or blocked (a hard stop that needs escalation). Ported
 * from sample-ui's AdminVisuals.ReleaseGateStrip with a richer data
 * model so the strip can tell the whole readiness story on its own.
 */
export function ReleaseGateStrip({ gates }: ReleaseGateStripProps) {
  if (gates.length === 0) {
    return (
      <div className="release-gate-strip">
        <p style={{ color: "var(--ink-muted)", fontStyle: "italic", margin: 0 }}>
          No release gates configured yet.
        </p>
      </div>
    );
  }

  return (
    <div className="release-gate-strip">
      {gates.map((gate, index) => (
        <article
          key={gate.id}
          className={`release-gate-strip__item release-gate-strip__item--${gate.status}`}
        >
          <span className="release-gate-strip__marker">
            {gate.status === "complete" ? "✓" : index + 1}
          </span>
          <div className="release-gate-strip__body">
            <p className="release-gate-strip__label">{gate.label}</p>
            <p className="release-gate-strip__detail">{gate.detail}</p>
          </div>
          <span className={`release-gate-strip__status release-gate-strip__status--${gate.status}`}>
            {STATUS_LABEL[gate.status]}
          </span>
        </article>
      ))}
    </div>
  );
}
