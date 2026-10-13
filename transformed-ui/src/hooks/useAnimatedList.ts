import { useMemo } from "react";

export function useAnimatedList<T>(items: T[], staggerMs: number = 40): { item: T; delay: number }[] {
  return useMemo(
    () => items.map((item, i) => ({ item, delay: i * staggerMs })),
    [items, staggerMs]
  );
}
