/*
 * Data-ops types — M3 persona (Data Manager / Informatics Engineer).
 *
 * Consumed by src/features/data-ops/ pages for schema mapping, DQ KPIs,
 * and rule step-through debugging.
 */

export interface SchemaMapping {
  sourceSystem: "epic" | "mdm" | "lab_feed" | "imaging" | "genomic";
  sourceField: string;
  canonicalField: string;
  transform: string;
  lastVerifiedAt: string;
  /** 0-1 confidence; below a threshold the mapping is surfaced for review. */
  confidence: number;
}

export interface DataQualitySignal {
  sourceSystem: string;
  /** 0-1 proportion of expected records successfully ingested. */
  coverage: number;
  freshness: "fresh" | "aging" | "stale";
  errorCount24h: number;
  trend: "improving" | "stable" | "degrading";
}

/** One step in a rule trace — used by RuleDebugger for step-through. */
export interface RuleTraceStep {
  ruleId: string;
  stepNumber: number;
  label: string;
  input: unknown;
  output: unknown;
  branchTaken?: string;
  notes?: string;
}
