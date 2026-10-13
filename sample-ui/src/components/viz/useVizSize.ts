/*
 * useVizSize — box measurement for responsive viz.
 *
 * Returns {width, height, isReady}. Until the first measurement arrives, isReady
 * is false so viz can short-circuit to a skeleton instead of rendering at 0×0.
 *
 * Measurement strategy (two legs, for reliability across environments):
 * 1. Synchronous first measurement via the callback ref itself — reads
 *    getBoundingClientRect() as soon as the node is attached. This avoids
 *    relying on ResizeObserver for the initial render, which is important
 *    because some environments (headless Chrome with CDP emulation) don't
 *    reliably fire ResizeObserver on initial observe.
 * 2. ResizeObserver for subsequent size changes (window resize, layout shifts).
 *
 * Lifecycle note: the cleanup (observer.disconnect) lives inside the callback
 * ref's (node: null) branch. React always calls callback refs with `null` on
 * unmount, so that is the correct and complete place to teardown. A separate
 * `useEffect` cleanup would also fire on React 18 strict-mode double-invoke
 * (dummy-unmount), which permanently kills the observer created during the
 * first ref invocation — because the ref callback is not re-invoked when the
 * node identity hasn't changed. That bug would leave `isReady` stuck at false
 * forever, skeleton-rendering every viz. Do not add a useEffect cleanup here.
 */

import { useCallback, useRef, useState } from "react";

export interface VizSize {
  width: number;
  height: number;
  isReady: boolean;
}

export function useVizSize<T extends HTMLElement>(): {
  ref: (node: T | null) => void;
  size: VizSize;
} {
  const [size, setSize] = useState<VizSize>({ width: 0, height: 0, isReady: false });
  const observerRef = useRef<ResizeObserver | null>(null);

  const applySize = useCallback((width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    setSize((prev) =>
      prev.isReady && prev.width === width && prev.height === height
        ? prev
        : { width, height, isReady: true }
    );
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node) return;

      // 1. Synchronous first measurement — read the box immediately so the
      // viz renders on the first paint cycle without waiting on ResizeObserver.
      const initial = node.getBoundingClientRect();
      applySize(initial.width, initial.height);

      // 2. ResizeObserver for subsequent changes (window resize, layout shifts).
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const box = entry.contentBoxSize?.[0];
          const width = box ? box.inlineSize : entry.contentRect.width;
          const height = box ? box.blockSize : entry.contentRect.height;
          applySize(width, height);
        }
      });
      observer.observe(node);
      observerRef.current = observer;
    },
    [applySize]
  );

  return { ref, size };
}
