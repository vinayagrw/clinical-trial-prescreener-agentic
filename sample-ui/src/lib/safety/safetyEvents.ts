/*
 * Safety events store — append-only log of every safety-relevant thing
 * the AI layer does. Feeds the /safety dashboard (P6) and the inline
 * run log on /ai-features (P5).
 *
 * Events are categorized by mode (one of the 10 safety failure modes from
 * 21-ai-safety-and-success-model.md §3) and severity (info / warn / block).
 */

import { create } from "zustand";

export type SafetyMode =
  | "schema_validation"
  | "prompt_injection"
  | "citation_missing"
  | "bias_to_uncertain"
  | "contradiction"
  | "negation"
  | "contraindication"
  | "biomarker_ontology"
  | "override_audit"
  | "model_regression"
  | "citation_content"
  | "temporal_arithmetic"
  | "cross_criterion_consistency"
  | "recommendation_consistency"
  | "fitscore_consistency";

export type SafetySeverity = "info" | "warn" | "block";
export type SafetyFeature = "F1" | "F2" | "F3" | "F4" | "F5" | "F6";

export interface SafetyEvent {
  id: string;
  timestamp: string;
  feature: SafetyFeature;
  mode: SafetyMode;
  severity: SafetySeverity;
  message: string;
  detail?: Record<string, unknown>;
  /** If this event modified the AI output, what it was changed to (serialized). */
  mutation?: { before: string; after: string };
}

interface SafetyEventsState {
  events: SafetyEvent[];
  counts: Record<SafetyMode, number>;
  logEvent: (event: Omit<SafetyEvent, "id" | "timestamp">) => SafetyEvent;
  clear: () => void;
}

const EMPTY_COUNTS: Record<SafetyMode, number> = {
  schema_validation: 0,
  prompt_injection: 0,
  citation_missing: 0,
  bias_to_uncertain: 0,
  contradiction: 0,
  negation: 0,
  contraindication: 0,
  biomarker_ontology: 0,
  override_audit: 0,
  model_regression: 0,
  citation_content: 0,
  temporal_arithmetic: 0,
  cross_criterion_consistency: 0,
  recommendation_consistency: 0,
  fitscore_consistency: 0,
};

function makeEventId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `se-${Date.now()}-${random}`;
}

export const useSafetyEventsStore = create<SafetyEventsState>((set) => ({
  events: [],
  counts: { ...EMPTY_COUNTS },
  logEvent: (event) => {
    const full: SafetyEvent = {
      ...event,
      id: makeEventId(),
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      events: [full, ...state.events].slice(0, 500),
      counts: {
        ...state.counts,
        [event.mode]: state.counts[event.mode] + 1,
      },
    }));
    return full;
  },
  clear: () =>
    set(() => ({
      events: [],
      counts: { ...EMPTY_COUNTS },
    })),
}));

/** Non-reactive accessor for use inside non-component code (providers, guards). */
export function logSafetyEvent(event: Omit<SafetyEvent, "id" | "timestamp">): SafetyEvent {
  return useSafetyEventsStore.getState().logEvent(event);
}
