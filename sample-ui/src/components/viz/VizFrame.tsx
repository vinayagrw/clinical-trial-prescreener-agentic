/*
 * VizFrame — the wrapper every viz uses.
 *
 * Responsibilities (all guaranteed by this component so individual viz don't re-implement):
 * - Measured box via useVizSize — children receive {width, height}.
 * - Accessible labeling: role="figure", aria-labelledby, aria-describedby.
 * - Screen-reader table fallback via VizTableFallback (always in DOM, sr-only).
 * - Visible table fallback on very small viewports (<480px) — patient portal mobile story.
 * - Skeleton / empty / error states.
 * - Reduced-motion propagation — CSS var --viz-motion-duration is read by primitives.
 *
 * The children prop is a render prop that receives the measured size. This keeps
 * composed viz free to write SVG that knows its own dimensions without reading them
 * via useVizSize themselves.
 */

import { useId, type ReactNode } from "react";
import { useVizSize } from "./useVizSize";
import {
  VizTableFallback,
  type VizTableColumn
} from "./fallback/VizTableFallback";

const MOBILE_BREAKPOINT_PX = 480;

export interface VizFrameProps<T extends Record<string, unknown>> {
  /** aria-label / visible title wrapper; mandatory. */
  label: string;
  /** Optional description rendered in aria-describedby and below the viz if visible. */
  description?: string;
  /** Row data for the fallback table. */
  data: readonly T[];
  /** Schema describing fallback table columns. */
  columns: VizTableColumn<T>[];
  /** When true, suppresses the viz and shows a skeleton. */
  loading?: boolean;
  /** When true, shows an empty state instead of the viz. */
  empty?: boolean;
  /** Error state — takes precedence over viz render. */
  error?: Error | null;
  /** Minimum height for the render surface (defaults to 200px). */
  minHeight?: number;
  /** Render prop — receives measured width/height and returns the viz SVG. */
  children: (size: { width: number; height: number }) => ReactNode;
  /** Optional class name appended to the frame wrapper. */
  className?: string;
}

export function VizFrame<T extends Record<string, unknown>>({
  label,
  description,
  data,
  columns,
  loading = false,
  empty = false,
  error = null,
  minHeight = 200,
  children,
  className
}: VizFrameProps<T>) {
  const labelId = useId();
  const descId = useId();
  const fallbackId = useId();
  const { ref: measureRef, size } = useVizSize<HTMLDivElement>();

  const isMobile = size.isReady && size.width < MOBILE_BREAKPOINT_PX;
  const shouldPromoteFallback = isMobile;

  const wrapperClass = ["viz-frame", className].filter(Boolean).join(" ");

  return (
    <figure
      className={wrapperClass}
      role="figure"
      aria-labelledby={labelId}
      aria-describedby={description ? descId : fallbackId}
    >
      <figcaption id={labelId} className="viz-frame__label">
        {label}
      </figcaption>
      {description ? (
        <p id={descId} className="viz-frame__description">
          {description}
        </p>
      ) : null}

      <div
        ref={measureRef}
        className="viz-frame__surface"
        style={{ minHeight }}
      >
        {error ? (
          <div className="viz-frame__error" role="alert">
            <strong>Visualization failed to render.</strong>
            <p>{error.message}</p>
          </div>
        ) : loading ? (
          <div className="viz-frame__skeleton" aria-hidden="true" />
        ) : empty ? (
          <div className="viz-frame__empty">
            <strong>No data to display.</strong>
          </div>
        ) : shouldPromoteFallback ? (
          // Small viewport — show the table in place of the viz.
          <VizTableFallback
            caption={label}
            columns={columns}
            rows={data}
            visible
            id={fallbackId}
          />
        ) : size.isReady ? (
          children({ width: size.width, height: Math.max(size.height, minHeight) })
        ) : (
          // First frame before measurement — placeholder so the box has height.
          <div className="viz-frame__skeleton" aria-hidden="true" />
        )}
      </div>

      {/* sr-only fallback is always present unless the visible version took its place */}
      {!shouldPromoteFallback ? (
        <div className="viz-frame__sr-only-fallback">
          <VizTableFallback
            caption={label}
            columns={columns}
            rows={data}
            id={fallbackId}
          />
        </div>
      ) : null}
    </figure>
  );
}
