/*
 * Barrel re-export — keeps `import { Patient } from "../types"` working for all
 * existing callers after the M1 split. New code should import from the specific
 * file (e.g. `from "../types/clinical"`) to keep module boundaries clean.
 */

export * from "./clinical.ts";
export * from "./collab.ts";
export * from "./agent.ts";
export * from "./insights.ts";
export * from "./data-ops.ts";
export * from "./visual.ts";
export * from "./handoff.ts";
export * from "./research.ts";
export * from "./review.ts";
