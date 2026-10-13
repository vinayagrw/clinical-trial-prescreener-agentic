import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { MatchStatus, QueueDisposition } from "@old/types";

interface OverrideState {
  status: MatchStatus;
  rationale: string;
}

interface ReviewState {
  expandedCriterionId: string | null;
  overrides: Map<string, OverrideState>;
  disposition: QueueDisposition;
  headerCollapsed: boolean;
  evidencePanelCriterionId: string | null;
  savedBanner: string | null;
}

interface ReviewContextValue extends ReviewState {
  setExpandedCriterionId: (id: string | null) => void;
  toggleCriterion: (id: string) => void;
  setOverride: (criterionId: string, status: MatchStatus, rationale: string) => void;
  clearOverride: (criterionId: string) => void;
  setDisposition: (d: QueueDisposition) => void;
  setHeaderCollapsed: (collapsed: boolean) => void;
  setEvidencePanelCriterionId: (id: string | null) => void;
  setSavedBanner: (msg: string | null) => void;
  saveReview: () => void;
  resetReview: () => void;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Map<string, OverrideState>>(new Map());
  const [disposition, setDisposition] = useState<QueueDisposition>("needs_pi_review");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [evidencePanelCriterionId, setEvidencePanelCriterionId] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const toggleCriterion = useCallback((id: string) => {
    setExpandedCriterionId((prev) => (prev === id ? null : id));
    setEvidencePanelCriterionId(id);
  }, []);

  const setOverride = useCallback((criterionId: string, status: MatchStatus, rationale: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(criterionId, { status, rationale });
      return next;
    });
  }, []);

  const clearOverride = useCallback((criterionId: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(criterionId);
      return next;
    });
  }, []);

  const saveReview = useCallback(() => {
    const overrideCount = overrides.size;
    const msg = overrideCount > 0
      ? `Saved ${overrideCount} override(s). Disposition: ${disposition.replace(/_/g, " ")}.`
      : `Disposition saved: ${disposition.replace(/_/g, " ")}.`;
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 5000);
  }, [overrides, disposition]);

  const resetReview = useCallback(() => {
    setExpandedCriterionId(null);
    setOverrides(new Map());
    setDisposition("needs_pi_review");
    setHeaderCollapsed(false);
    setEvidencePanelCriterionId(null);
    setSavedBanner(null);
  }, []);

  const value: ReviewContextValue = {
    expandedCriterionId,
    overrides,
    disposition,
    headerCollapsed,
    evidencePanelCriterionId,
    savedBanner,
    setExpandedCriterionId,
    toggleCriterion,
    setOverride,
    clearOverride,
    setDisposition,
    setHeaderCollapsed,
    setEvidencePanelCriterionId,
    setSavedBanner,
    saveReview,
    resetReview,
  };

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used within ReviewProvider");
  return ctx;
}
