/*
 * Spinner — inline loading indicator.
 *
 * Not a Radix wrapper; we own this so we can respect prefers-reduced-motion
 * by swapping the animation for a static marker. Anything longer than
 * ~300ms should use Skeleton instead.
 */

import type { CSSProperties } from "react";

export interface SpinnerProps {
  /** Square size in pixels (default 16). */
  size?: number;
  /** Optional caption read by screen readers in place of the default. */
  label?: string;
  style?: CSSProperties;
  className?: string;
}

export function Spinner({
  size = 16,
  label = "Loading",
  style,
  className,
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`ctp-spinner${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, ...style }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
