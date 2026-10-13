import { StatusChip } from "./StatusChip";
import type { WorklistItem } from "../types";

interface HandoffWorklistTableProps {
  items: WorklistItem[];
  onOpen: (handoffId: string) => void;
}

function toneForStatus(status: WorklistItem["status"]) {
  return status === "needs_review" ? "brick" : "moss";
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function HandoffWorklistTable({
  items,
  onOpen,
}: HandoffWorklistTableProps) {
  return (
    <section className="surface handoff-surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Active handoffs</p>
          <h3>Generated worklist</h3>
        </div>
      </div>

      <div className="handoff-worklist">
        {items.map((item) => (
          <article key={item.handoffId} className="handoff-worklist__row">
            <div>
              <div className="handoff-worklist__title">
                <strong>{item.patientName}</strong>
                <StatusChip label={item.status.replace("_", " ")} tone={toneForStatus(item.status)} compact />
              </div>
              <p className="handoff-worklist__meta">
                {item.maskedMrn} | {item.unit} | {item.primaryService}
              </p>
              <p>{item.diagnosis}</p>
            </div>

            <div className="handoff-worklist__stats">
              <div>
                <strong>{item.openDisagreements}</strong>
                <span>disagreements</span>
              </div>
              <div>
                <strong>{item.missingInfoCount}</strong>
                <span>missing items</span>
              </div>
              <div>
                <strong>{item.windowHours}h</strong>
                <span>window</span>
              </div>
            </div>

            <div className="handoff-worklist__headline">
              <strong>{item.headline}</strong>
              <p>{item.nextAction}</p>
              <p className="handoff-worklist__meta">Generated {formatTimestamp(item.generatedAt)}</p>
            </div>

            <div className="handoff-worklist__actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => onOpen(item.handoffId)}
              >
                Open case
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
