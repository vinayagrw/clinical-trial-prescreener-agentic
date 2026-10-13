import React, { useState } from "react";
import type { MatchStatus } from "../../types/index";
import { useReview } from "../../context/ReviewContext";

export interface InlineOverrideProps {
  criterionId: string;
}

const statusOptions: { value: MatchStatus; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "uncertain", label: "Uncertain" },
  { value: "manual_review", label: "Manual Review" },
];

export function InlineOverride({ criterionId }: InlineOverrideProps) {
  const { overrides, setOverride } = useReview();
  const existing = overrides.get(criterionId);

  const [selectedStatus, setSelectedStatus] = useState<MatchStatus | null>(
    existing?.status ?? null
  );
  const [rationale, setRationale] = useState(existing?.rationale ?? "");

  const handleSave = () => {
    if (selectedStatus) {
      setOverride(criterionId, selectedStatus, rationale);
    }
  };

  return (
    <div className="inline-override">
      <div className="inline-override__toggles">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`inline-override__toggle${
              selectedStatus === opt.value ? " inline-override__toggle--active" : ""
            }`}
            onClick={() => setSelectedStatus(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <textarea
        className="inline-override__input"
        placeholder="Rationale for override..."
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
      />

      <button
        type="button"
        className="inline-override__save"
        onClick={handleSave}
        disabled={!selectedStatus}
      >
        {existing ? "Update Override" : "Save Override"}
      </button>
    </div>
  );
}
