import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { enrichedQueueItems } from "../../data/extendedMockData";
import { sortByUrgency } from "../../data/helpers";
import { Kbd } from "../shared/Kbd";

export function PatientNav() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const sorted = useMemo(() => sortByUrgency(enrichedQueueItems), []);

  const currentIndex = sorted.findIndex((item) => item.matchId === matchId);
  const total = sorted.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  const goPrev = () => {
    if (hasPrev) {
      navigate(`/review/${sorted[currentIndex - 1].matchId}`);
    }
  };

  const goNext = () => {
    if (hasNext) {
      navigate(`/review/${sorted[currentIndex + 1].matchId}`);
    }
  };

  return (
    <div className="patient-nav glass-surface glass-surface--elevated">
      <button
        type="button"
        className="patient-nav__btn"
        onClick={goPrev}
        disabled={!hasPrev}
        aria-label="Previous patient"
      >
        &lt; Prev
      </button>

      <span className="patient-nav__counter">
        {currentIndex >= 0 ? currentIndex + 1 : "?"} of {total}
      </span>

      <button
        type="button"
        className="patient-nav__btn"
        onClick={goNext}
        disabled={!hasNext}
        aria-label="Next patient"
      >
        Next &gt;
      </button>

      <span style={{ display: "inline-flex", gap: "var(--space-1)", marginLeft: "var(--space-2)" }}>
        <Kbd>Shift+J</Kbd>
        <Kbd>Shift+K</Kbd>
      </span>
    </div>
  );
}
