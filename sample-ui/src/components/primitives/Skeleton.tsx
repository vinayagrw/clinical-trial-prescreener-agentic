/*
 * Skeleton — placeholder shimmer for content loading.
 *
 * Usage rule: if a query is expected to take longer than ~300ms, render
 * a Skeleton in the same shape as the eventual content (same height,
 * roughly same width, no layout shift). Anything shorter than that should
 * just show stale content, not a flash of skeleton.
 *
 * Respects prefers-reduced-motion via the ctp-skeleton class defined in
 * src/styles/motion.css (shimmer disabled under reduced motion).
 */

import type { CSSProperties } from "react";

export interface SkeletonProps {
  /** Height of the placeholder block. Defaults to 1em. */
  height?: number | string;
  /** Width of the placeholder block. Defaults to 100%. */
  width?: number | string;
  /** Radius in pixels (default 8). */
  radius?: number;
  /** Optional class to merge in. */
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  height = "1em",
  width = "100%",
  radius = 8,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`ctp-skeleton${className ? ` ${className}` : ""}`}
      style={{
        display: "inline-block",
        height,
        width,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/**
 * Convenience for the common case: N stacked rows of text-height skeletons,
 * useful for queue rows / criterion list placeholders.
 */
export function SkeletonRows({
  count = 3,
  rowHeight = "1.25em",
  gap = 8,
}: {
  count?: number;
  rowHeight?: number | string;
  gap?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          height={rowHeight}
          width={`${Math.round(85 - index * 6)}%`}
        />
      ))}
    </div>
  );
}
