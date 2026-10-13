/*
 * main.tsx — app bootstrap.
 *
 * Two things happen here that matter:
 *
 * 1. We set the theme class on <html> BEFORE React renders. This avoids
 *    a flash of unstyled content when a user who prefers dark lands on
 *    the app — if we waited for React to mount and run an effect, they'd
 *    see light theme for ~1 frame first.
 *
 * 2. We swap the monolithic `./styles.css` import for `./styles/global.css`,
 *    which chain-imports tokens → themes → motion → primitives →
 *    styles.css (legacy) → responsive, giving the token system room to
 *    override downstream styles where needed.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { loadMemory } from "./agent/memory";
import "./styles/global.css";

// --- Theme pre-paint ---
// Runs synchronously before React mounts so the <html> class is correct on
// the very first paint. Falls back to prefers-color-scheme when there is no
// explicit user preference. Errors from localStorage are swallowed by
// loadMemory() — if storage is broken we just render light theme.
(function applyInitialTheme() {
  try {
    const memory = loadMemory();
    const preferred =
      memory.themePreference ??
      (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    document.documentElement.classList.add(`theme-${preferred}`);
  } catch {
    document.documentElement.classList.add("theme-light");
  }
})();

// One QueryClient per app — shared across all hooks. Defaults chosen for a
// demo-heavy workload: stale-while-revalidate semantics, background refetch
// off until M5 when real data warrants it.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
