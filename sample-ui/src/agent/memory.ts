/*
 * Client-side preference + memory store, backed by localStorage.
 *
 * This is NOT a replacement for the server audit trail — it's the "remember
 * my last task mode, my saved queue views, the ambient insights I dismissed"
 * layer that the agent reads so the coordinator doesn't have to re-state
 * preferences every session.
 *
 * Server-backed audit events still live in the AuditEvent stream; the data
 * here is ephemeral, per-device, and the user can nuke it without losing
 * any clinical state.
 *
 * Persistence rule: never store anything that would fail a stranger test.
 * PHI, rationale text that names patients, or evidence excerpts — none of
 * that belongs in localStorage. Only IDs + user preferences + dismissal
 * timestamps.
 */

const STORAGE_KEY = "ctp-prescreener-memory.v1";

export interface SavedView {
  id: string;
  label: string;
  taskMode: string;
  filters: Record<string, unknown>;
}

/**
 * A prior override this user has made. Stored as a pattern ("I often allow
 * creatinine up to 1.8 when the trend is improving") not the actual patient,
 * so the agent can nudge future overrides without re-surfacing PHI.
 */
export interface RememberedOverride {
  criterionLabel: string;
  /** Freeform rationale text. PHI-scrubbed before saving. */
  rationale: string;
  /** ISO timestamp — lets memory.ts age out stale patterns after N months. */
  recordedAt: string;
}

export interface MemoryStore {
  recentOverrides: RememberedOverride[];
  savedViews: SavedView[];
  preferredTaskMode?: string;
  /** Map of frequencyCapKey → dismissedAt epoch ms. */
  dismissedAmbientInsights: Record<string, number>;
  themePreference?: "light" | "dark" | "hc";
  reducedMotion?: boolean;
}

const EMPTY_STORE: MemoryStore = {
  recentOverrides: [],
  savedViews: [],
  dismissedAmbientInsights: {},
};

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadMemory(): MemoryStore {
  const ls = safeLocalStorage();
  if (!ls) return { ...EMPTY_STORE };

  const raw = ls.getItem(STORAGE_KEY);
  if (!raw) return { ...EMPTY_STORE };

  try {
    const parsed = JSON.parse(raw) as Partial<MemoryStore>;
    return {
      recentOverrides: parsed.recentOverrides ?? [],
      savedViews: parsed.savedViews ?? [],
      preferredTaskMode: parsed.preferredTaskMode,
      dismissedAmbientInsights: parsed.dismissedAmbientInsights ?? {},
      themePreference: parsed.themePreference,
      reducedMotion: parsed.reducedMotion,
    };
  } catch {
    // Corrupt store — reset rather than crash the app.
    ls.removeItem(STORAGE_KEY);
    return { ...EMPTY_STORE };
  }
}

export function saveMemory(mem: MemoryStore): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(mem));
  } catch {
    // Storage full / private mode / quota — silently drop. We never want
    // the persistence layer to crash the UI.
  }
}

export function updateMemory(patch: Partial<MemoryStore>): MemoryStore {
  const next = { ...loadMemory(), ...patch };
  saveMemory(next);
  return next;
}

// --- Override memory ---

const OVERRIDE_CAP = 50;

export function rememberOverride(
  criterionLabel: string,
  rationale: string,
): void {
  const mem = loadMemory();
  const entry: RememberedOverride = {
    criterionLabel,
    rationale,
    recordedAt: new Date().toISOString(),
  };
  // Dedupe by (label, rationale) pair; keep most recent.
  const filtered = mem.recentOverrides.filter(
    (existing) =>
      !(existing.criterionLabel === criterionLabel && existing.rationale === rationale),
  );
  mem.recentOverrides = [entry, ...filtered].slice(0, OVERRIDE_CAP);
  saveMemory(mem);
}

// --- Ambient insight frequency cap ---

/**
 * Returns true if the insight should be shown. Respects dismissals: once an
 * insight with a given frequencyCapKey is dismissed, it will not resurface
 * for `cooldownMs` milliseconds. Keys are chosen by the insight producer to
 * group "the same kind of nag" together (e.g. "cohort-pattern-cns-blocker").
 */
export function shouldSurfaceInsight(
  frequencyCapKey: string,
  cooldownMs: number,
): boolean {
  const mem = loadMemory();
  const dismissedAt = mem.dismissedAmbientInsights[frequencyCapKey];
  if (!dismissedAt) return true;
  return Date.now() - dismissedAt >= cooldownMs;
}

export function dismissAmbientInsight(frequencyCapKey: string): void {
  const mem = loadMemory();
  mem.dismissedAmbientInsights[frequencyCapKey] = Date.now();
  saveMemory(mem);
}

// --- Saved views ---

export function upsertSavedView(view: SavedView): void {
  const mem = loadMemory();
  const idx = mem.savedViews.findIndex((v) => v.id === view.id);
  if (idx >= 0) {
    mem.savedViews[idx] = view;
  } else {
    mem.savedViews.push(view);
  }
  saveMemory(mem);
}

export function deleteSavedView(id: string): void {
  const mem = loadMemory();
  mem.savedViews = mem.savedViews.filter((v) => v.id !== id);
  saveMemory(mem);
}
