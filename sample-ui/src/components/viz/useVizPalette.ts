/*
 * useVizPalette — reads CSS custom properties for the viz palette.
 *
 * Why a hook and not direct CSS:
 * - Visx and other shape generators need JS string values ("#0f5c62") passed as props,
 *   so we must resolve tokens from getComputedStyle rather than using var(...) inline.
 * - When the theme changes (class on <html>), we must re-read and re-render.
 * - A single MutationObserver on <html> class attribute drives updates for the whole app.
 *
 * Keep token names in sync with tokens.css / themes.css section 16 block.
 */

import { useEffect, useState } from "react";

export interface VizPalette {
  series: readonly [string, string, string, string, string, string, string];
  ramp: readonly [string, string, string, string, string, string];
  status: {
    pass: string;
    fail: string;
    uncertain: string;
    manual: string;
  };
  grid: string;
  axis: string;
  text: string;
  textStrong: string;
  datumRing: string;
  motionDurationMs: number;
}

const TOKEN_NAMES = {
  series: [
    "--viz-series-1",
    "--viz-series-2",
    "--viz-series-3",
    "--viz-series-4",
    "--viz-series-5",
    "--viz-series-6",
    "--viz-series-7"
  ],
  ramp: [
    "--viz-ramp-0",
    "--viz-ramp-1",
    "--viz-ramp-2",
    "--viz-ramp-3",
    "--viz-ramp-4",
    "--viz-ramp-5"
  ],
  statusPass: "--viz-status-pass",
  statusFail: "--viz-status-fail",
  statusUncertain: "--viz-status-uncertain",
  statusManual: "--viz-status-manual",
  grid: "--viz-grid",
  axis: "--viz-axis",
  text: "--viz-text",
  textStrong: "--viz-text-strong",
  datumRing: "--viz-datum-ring",
  motion: "--viz-motion-duration"
} as const;

function readPalette(): VizPalette {
  if (typeof window === "undefined") {
    // SSR fallback — values don't matter, hydration will overwrite.
    return {
      series: ["#0f5c62", "#c88b28", "#5c7b4f", "#ad4d41", "#2d5578", "#7a4474", "#4a6158"],
      ramp: ["#faf5ea", "#f0e3c7", "#e5c48e", "#d09855", "#a85e2d", "#6b2f13"],
      status: {
        pass: "#5c7b4f",
        fail: "#ad4d41",
        uncertain: "#c88b28",
        manual: "#506067"
      },
      grid: "rgba(22, 36, 44, 0.08)",
      axis: "rgba(22, 36, 44, 0.35)",
      text: "#506067",
      textStrong: "#16242c",
      datumRing: "rgba(22, 36, 44, 0.18)",
      motionDurationMs: 180
    };
  }

  const styles = getComputedStyle(document.documentElement);
  const get = (name: string) => styles.getPropertyValue(name).trim();

  const parseDurationMs = (raw: string): number => {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    if (trimmed.endsWith("ms")) return parseFloat(trimmed);
    if (trimmed.endsWith("s")) return parseFloat(trimmed) * 1000;
    return parseFloat(trimmed) || 0;
  };

  return {
    series: TOKEN_NAMES.series.map(get) as unknown as VizPalette["series"],
    ramp: TOKEN_NAMES.ramp.map(get) as unknown as VizPalette["ramp"],
    status: {
      pass: get(TOKEN_NAMES.statusPass),
      fail: get(TOKEN_NAMES.statusFail),
      uncertain: get(TOKEN_NAMES.statusUncertain),
      manual: get(TOKEN_NAMES.statusManual)
    },
    grid: get(TOKEN_NAMES.grid),
    axis: get(TOKEN_NAMES.axis),
    text: get(TOKEN_NAMES.text),
    textStrong: get(TOKEN_NAMES.textStrong),
    datumRing: get(TOKEN_NAMES.datumRing),
    motionDurationMs: parseDurationMs(get(TOKEN_NAMES.motion))
  };
}

export function useVizPalette(): VizPalette {
  const [palette, setPalette] = useState<VizPalette>(readPalette);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // First reconciliation pass after mount, in case the SSR fallback was used.
    setPalette(readPalette());

    // Re-read whenever the theme class on <html> changes.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          setPalette(readPalette());
          return;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Also listen for system reduced-motion flips (tokens recompute because of media query).
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMqChange = () => setPalette(readPalette());
    mq.addEventListener("change", onMqChange);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", onMqChange);
    };
  }, []);

  return palette;
}
