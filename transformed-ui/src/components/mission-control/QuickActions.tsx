import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export function QuickActions() {
  const { selectedMatchId, setSelectedMatchId } = useApp();
  const navigate = useNavigate();

  if (!selectedMatchId) return null;

  const handleOpenReview = () => {
    navigate(`/review/${selectedMatchId}`);
  };

  const handleAssignPI = () => {
    // Placeholder: would trigger PI assignment workflow
  };

  const handleAddWatchlist = () => {
    // Placeholder: would add to watchlist lane
  };

  const handleDismiss = () => {
    setSelectedMatchId(null);
  };

  return (
    <div className="quick-actions">
      <button
        className="quick-actions__btn quick-actions__btn--primary"
        onClick={handleOpenReview}
        type="button"
      >
        Open Review
      </button>
      <button
        className="quick-actions__btn"
        onClick={handleAssignPI}
        type="button"
      >
        Assign to PI
      </button>
      <button
        className="quick-actions__btn"
        onClick={handleAddWatchlist}
        type="button"
      >
        Add to Watchlist
      </button>
      <button
        className="quick-actions__btn"
        onClick={handleDismiss}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}
