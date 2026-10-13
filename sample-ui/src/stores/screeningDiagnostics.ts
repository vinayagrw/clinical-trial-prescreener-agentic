import { create } from "zustand";
import type { ProviderName } from "../lib/ai/providers";
import type { AppRuntimeMode } from "../lib/runtimeMetadata";

export type ScreeningDiagnosticErrorCategory =
  | "quota"
  | "network"
  | "schema"
  | "safety"
  | "fallback"
  | "configuration"
  | "unknown";

export type ScreeningRuntimeMode = "demo" | "live";
export type ScreeningDiagnosticOutcome =
  | "f6_success"
  | "live_failed_demo_fallback"
  | "f6_failed_deterministic_fallback"
  | "fatal";
export type ScreeningFallbackPath = "none" | "demo_fixture" | "deterministic_first";

export interface ScreeningProviderAttempt {
  provider: ProviderName;
  status: "started" | "skipped" | "succeeded" | "failed";
  runtimeMode: ScreeningRuntimeMode;
  attemptedAt: string;
  completedAt?: string;
  model?: string;
  wallTimeMs?: number;
  reason?: string;
  errorName?: string;
  errorCategory?: ScreeningDiagnosticErrorCategory;
  schemaPath?: string;
  schemaMessage?: string;
  schemaSummary?: string;
  schemaRawSummary?: string;
}

export interface ScreeningDiagnosticRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  patientId: string;
  trialId: string;
  screeningMode: "deterministic_first" | "full_record_llm";
  runtimeMode: ScreeningRuntimeMode;
  providerOrder: ProviderName[];
  criteriaCount: number;
  rawRecordChars: number;
  promptChars: number;
  providerAttempts: ScreeningProviderAttempt[];
  fallbackPath: ScreeningFallbackPath;
  fallbackReason: string | null;
  finalProvider: ProviderName | null;
  finalModel: string | null;
  outcome: ScreeningDiagnosticOutcome;
  summary: string;
  errorMessage: string | null;
  schemaPath: string | null;
  schemaMessage: string | null;
  schemaSummary: string | null;
  schemaRawSummary: string | null;
  safetyMessages: string[];
  buildMode: AppRuntimeMode;
  buildStamp: string;
  appVersion: string;
  clientPort: string | null;
}

interface ScreeningDiagnosticsState {
  runs: ScreeningDiagnosticRun[];
  startRun: (
    input: Omit<
      ScreeningDiagnosticRun,
      | "id"
      | "completedAt"
      | "providerAttempts"
      | "fallbackPath"
      | "fallbackReason"
      | "finalProvider"
      | "finalModel"
      | "outcome"
      | "summary"
      | "errorMessage"
      | "schemaPath"
      | "schemaMessage"
      | "schemaSummary"
      | "schemaRawSummary"
      | "safetyMessages"
    >,
  ) => string;
  addProviderAttempt: (
    runId: string,
    attempt: ScreeningProviderAttempt,
  ) => void;
  completeRun: (
    runId: string,
    patch: Partial<
      Pick<
        ScreeningDiagnosticRun,
        | "completedAt"
        | "fallbackPath"
        | "fallbackReason"
        | "finalProvider"
        | "finalModel"
        | "outcome"
        | "summary"
        | "errorMessage"
        | "schemaPath"
        | "schemaMessage"
        | "schemaSummary"
        | "schemaRawSummary"
        | "safetyMessages"
      >
    >,
  ) => void;
  recordRun: (run: ScreeningDiagnosticRun) => void;
  clear: () => void;
}

const MAX_RUNS = 24;

function makeRunId(): string {
  return `screening-diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useScreeningDiagnosticsStore = create<ScreeningDiagnosticsState>((set) => ({
  runs: [],
  startRun: (input) => {
    const runId = makeRunId();
    const run: ScreeningDiagnosticRun = {
      ...input,
      id: runId,
      completedAt: null,
      providerAttempts: [],
      fallbackPath: "none",
      fallbackReason: null,
      finalProvider: null,
      finalModel: null,
      outcome: "fatal",
      summary: "Preparing Full-record LLM assessment.",
      errorMessage: null,
      schemaPath: null,
      schemaMessage: null,
      schemaSummary: null,
      schemaRawSummary: null,
      safetyMessages: [],
    };

    set((state) => ({
      runs: [run, ...state.runs].slice(0, MAX_RUNS),
    }));

    return runId;
  },
  addProviderAttempt: (runId, attempt) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              providerAttempts: [...run.providerAttempts, attempt],
            }
          : run,
      ),
    }));
  },
  completeRun: (runId, patch) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId
          ? {
              ...run,
              ...patch,
            }
          : run,
        ),
    }));
  },
  recordRun: (run) => {
    set((state) => ({
      runs: [run, ...state.runs.filter((candidate) => candidate.id !== run.id)].slice(
        0,
        MAX_RUNS,
      ),
    }));
  },
  clear: () => set({ runs: [] }),
}));
