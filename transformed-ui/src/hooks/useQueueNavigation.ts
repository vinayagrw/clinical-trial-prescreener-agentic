import { useState, useCallback, useMemo } from "react";
import { enrichedQueueItems } from "../data/extendedMockData";
import { sortByUrgency } from "../data/helpers";

export function useQueueNavigation() {
  const sorted = useMemo(() => sortByUrgency(enrichedQueueItems), []);
  const [currentIndex, setCurrentIndex] = useState(0);

  const current = sorted[currentIndex] ?? null;
  const total = sorted.length;

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, sorted.length - 1));
  }, [sorted.length]);

  const goPrevious = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = useCallback((matchId: string) => {
    const idx = sorted.findIndex((item) => item.matchId === matchId);
    if (idx >= 0) setCurrentIndex(idx);
  }, [sorted]);

  return {
    current,
    currentIndex,
    total,
    goNext,
    goPrevious,
    goTo,
    hasNext: currentIndex < total - 1,
    hasPrevious: currentIndex > 0,
  };
}
