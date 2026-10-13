/*
 * aiPipeline store — drives the guided stepper on /ai-features.
 *
 * The stepper walks the user through the full AI workflow:
 *   Input → F1 decomposition → F2 retrieval → F3 evaluation → F4 temporal →
 *   F5 ask agent → Done.
 *
 * This store owns the step cursor, overall pipeline status, per-step run
 * log entries, and the wall-time counters. It does NOT own the feature
 * results themselves — those live in the existing F1/F2/F3/F4 stores
 * (aiDecomposition, aiRetrieval, aiEvaluation, aiTemporal) which the
 * stepper continues to read from directly. This store is a thin
 * orchestration layer that calls into those stores and tracks progress.
 *
 * By keeping state separate we reuse every view component unchanged and
 * the pipeline can re-run just one step without re-running the rest.
 */

import { create } from "zustand";
import type { ProviderName } from "../lib/ai/providers";
import type { AgentResponse } from "../lib/ai/schemas";
import { runAskAgent } from "../lib/ai/askAgentRunner";
import { useAiDecompositionStore } from "./aiDecomposition";
import { useAiRetrievalStore, RETRIEVAL_CRITERIA } from "./aiRetrieval";
import { useAiEvaluationStore } from "./aiEvaluation";
import { useAiTemporalStore } from "./aiTemporal";

export type PipelineStepId =
  | "input"
  | "decomposition"
  | "retrieval"
  | "evaluation"
  | "temporal"
  | "agent"
  | "done";

export const PIPELINE_STEP_ORDER: PipelineStepId[] = [
  "input",
  "decomposition",
  "retrieval",
  "evaluation",
  "temporal",
  "agent",
  "done",
];

export type PipelineStepStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped";

export interface PipelineStepMeta {
  id: PipelineStepId;
  label: string;
  shortLabel: string;
  feature: "input" | "F1" | "F2" | "F3" | "F4" | "F5" | "done";
  description: string;
}

export const PIPELINE_STEPS: PipelineStepMeta[] = [
  {
    id: "input",
    label: "Protocol input",
    shortLabel: "Input",
    feature: "input",
    description:
      "Paste the eligibility section of the protocol PDF. The pre-flight prompt-injection filter runs here.",
  },
  {
    id: "decomposition",
    label: "F1 · Decompose criteria",
    shortLabel: "F1",
    feature: "F1",
    description:
      "Structured criterion extraction with inclusion/exclusion + computability + source spans.",
  },
  {
    id: "retrieval",
    label: "F2 · Hybrid retrieval",
    shortLabel: "F2",
    feature: "F2",
    description:
      "BM25 + embedding + freshness gate over the patient chart, one pass per decomposed criterion.",
  },
  {
    id: "evaluation",
    label: "F3 · Criterion evaluation",
    shortLabel: "F3",
    feature: "F3",
    description:
      "Per-row pass / fail / uncertain with citations; every verdict passes the 7-check F3 guard stack.",
  },
  {
    id: "temporal",
    label: "F4 · Temporal reasoning",
    shortLabel: "F4",
    feature: "F4",
    description:
      "Washout clear-dates, lab freshness, imaging windows → earliest enrollment date.",
  },
  {
    id: "agent",
    label: "F5 · Grounded Ask Agent",
    shortLabel: "F5",
    feature: "F5",
    description:
      "Scope-bound agent answers the canned coordinator question with citations + grounding status.",
  },
  {
    id: "done",
    label: "Pipeline complete",
    shortLabel: "Done",
    feature: "done",
    description:
      "Every step finished. The safety console holds every event the pipeline logged along the way.",
  },
];

export interface RunLogEntry {
  id: string;
  at: string;
  step: PipelineStepId;
  feature: PipelineStepMeta["feature"];
  message: string;
  provider?: ProviderName | null;
  model?: string | null;
  wallTimeMs?: number | null;
  tone: "info" | "success" | "warn" | "error";
}

interface StepState {
  status: PipelineStepStatus;
  startedAt: string | null;
  endedAt: string | null;
  wallTimeMs: number | null;
  error: string | null;
}

const EMPTY_STEP: StepState = {
  status: "pending",
  startedAt: null,
  endedAt: null,
  wallTimeMs: null,
  error: null,
};

/** F5 Ask Agent result — stored here so AgentStep can render inline. */
export interface F5AgentResult {
  status: "idle" | "running" | "success" | "error";
  answer: AgentResponse | null;
  question: string;
  error: string | null;
  provider: ProviderName | null;
  model: string | null;
}

const IDLE_F5: F5AgentResult = {
  status: "idle",
  answer: null,
  question: "",
  error: null,
  provider: null,
  model: null,
};

interface AiPipelineState {
  currentStep: PipelineStepId;
  stepState: Record<PipelineStepId, StepState>;
  runLog: RunLogEntry[];
  isRunning: boolean;
  startedAt: string | null;
  completedAt: string | null;
  /** F5 agent result — populated when runAgentStep sends to the LLM. */
  f5Result: F5AgentResult;
  /** Advance to the next pending step without running it (for manual step-through). */
  advance: () => void;
  /** Jump the cursor to an explicit step. */
  goTo: (step: PipelineStepId) => void;
  /** Run one step in isolation (no auto-advance). */
  runStep: (step: PipelineStepId) => Promise<void>;
  /** Run every step from the current cursor through `done` in order. */
  runAll: () => Promise<void>;
  /** Add a free-form entry to the run log (used by step components for side-notes). */
  logEntry: (entry: Omit<RunLogEntry, "id" | "at">) => void;
  /** Reset cursor + per-step state + run log. Does NOT reset the feature stores. */
  reset: () => void;
}

function makeRunLogId(): string {
  const r = Math.random().toString(36).slice(2, 7);
  return `rl-${Date.now()}-${r}`;
}

function emptyStepState(): Record<PipelineStepId, StepState> {
  return {
    input: { ...EMPTY_STEP },
    decomposition: { ...EMPTY_STEP },
    retrieval: { ...EMPTY_STEP },
    evaluation: { ...EMPTY_STEP },
    temporal: { ...EMPTY_STEP },
    agent: { ...EMPTY_STEP },
    done: { ...EMPTY_STEP },
  };
}

function nextStep(step: PipelineStepId): PipelineStepId {
  const idx = PIPELINE_STEP_ORDER.indexOf(step);
  if (idx === -1) return "input";
  if (idx >= PIPELINE_STEP_ORDER.length - 1) return "done";
  return PIPELINE_STEP_ORDER[idx + 1];
}

/** Canned F5 question the agent step auto-sends — matches the demo story. */
export const DEFAULT_PIPELINE_AGENT_QUESTION =
  "What's blocking patient-001 from enrolling in trial-001 right now, and what evidence do you have?";

export const useAiPipelineStore = create<AiPipelineState>((set, get) => {
  function pushLog(entry: Omit<RunLogEntry, "id" | "at">): void {
    const full: RunLogEntry = {
      ...entry,
      id: makeRunLogId(),
      at: new Date().toISOString(),
    };
    set((state) => ({ runLog: [full, ...state.runLog].slice(0, 200) }));
  }

  function startStep(step: PipelineStepId): void {
    set((state) => ({
      currentStep: step,
      isRunning: true,
      startedAt: state.startedAt ?? new Date().toISOString(),
      stepState: {
        ...state.stepState,
        [step]: {
          ...state.stepState[step],
          status: "running",
          startedAt: new Date().toISOString(),
          endedAt: null,
          error: null,
        },
      },
    }));
  }

  function finishStep(
    step: PipelineStepId,
    patch: Partial<StepState> & { status: PipelineStepStatus },
  ): void {
    set((state) => {
      const startedAt = state.stepState[step].startedAt;
      const wall =
        patch.wallTimeMs ??
        (startedAt ? Date.now() - new Date(startedAt).getTime() : null);
      const endedAt = new Date().toISOString();
      return {
        stepState: {
          ...state.stepState,
          [step]: {
            ...state.stepState[step],
            ...patch,
            endedAt,
            wallTimeMs: wall,
          },
        },
      };
    });
  }

  async function runInputStep(): Promise<void> {
    startStep("input");
    pushLog({
      step: "input",
      feature: "input",
      tone: "info",
      message: "Protocol text handed to the F1 input pipeline (pre-flight sanitizer ran).",
    });
    // The actual textarea edit is user-driven; running the step just marks
    // it success so the cursor can advance. The F1 store already seeds
    // DEFAULT_PROTOCOL_TEXT so there is always something to run against.
    finishStep("input", { status: "success", wallTimeMs: 0 });
  }

  async function runDecompositionStep(): Promise<void> {
    startStep("decomposition");
    const start = Date.now();
    await useAiDecompositionStore.getState().runDecomposition();
    const f1 = useAiDecompositionStore.getState();
    const wall = Date.now() - start;
    if (f1.status === "error") {
      finishStep("decomposition", {
        status: "error",
        error: f1.error,
        wallTimeMs: wall,
      });
      pushLog({
        step: "decomposition",
        feature: "F1",
        tone: "error",
        message: `F1 decomposition failed: ${f1.error ?? "unknown error"}`,
        wallTimeMs: wall,
      });
      throw new Error(f1.error ?? "F1 decomposition failed");
    }
    finishStep("decomposition", {
      status: "success",
      wallTimeMs: f1.wallTimeMs ?? wall,
    });
    pushLog({
      step: "decomposition",
      feature: "F1",
      tone: "success",
      message: `Decomposed ${f1.view?.criteria.length ?? 0} criteria via ${f1.provider ?? "?"}/${f1.model ?? "?"}.`,
      provider: f1.provider,
      model: f1.model,
      wallTimeMs: f1.wallTimeMs ?? wall,
    });
  }

  async function runRetrievalStep(): Promise<void> {
    startStep("retrieval");
    const start = Date.now();
    // Drive one retrieval pass against the first retrieval preset that maps
    // to a decomposed criterion — in demo this is ANC ≥ 1500/μL so the F2
    // run card has something realistic to show.
    const firstCriterionId =
      useAiDecompositionStore.getState().view?.criteria[0]?.id ??
      RETRIEVAL_CRITERIA[0].id;
    const retrievalId =
      RETRIEVAL_CRITERIA.find((r) => r.id === firstCriterionId)?.id ??
      RETRIEVAL_CRITERIA[0].id;
    await useAiRetrievalStore.getState().runRetrieval(retrievalId);
    const f2 = useAiRetrievalStore.getState();
    const wall = Date.now() - start;
    if (f2.status === "error") {
      finishStep("retrieval", {
        status: "error",
        error: f2.error,
        wallTimeMs: wall,
      });
      pushLog({
        step: "retrieval",
        feature: "F2",
        tone: "error",
        message: `F2 retrieval failed: ${f2.error ?? "unknown error"}`,
        wallTimeMs: wall,
      });
      throw new Error(f2.error ?? "F2 retrieval failed");
    }
    finishStep("retrieval", { status: "success", wallTimeMs: wall });
    pushLog({
      step: "retrieval",
      feature: "F2",
      tone: "success",
      message: `Ranked ${f2.run?.results.length ?? 0} evidence hits for ${retrievalId}.`,
      wallTimeMs: wall,
    });
  }

  async function runEvaluationStep(): Promise<void> {
    startStep("evaluation");
    const start = Date.now();
    const criteria = useAiDecompositionStore.getState().view?.criteria ?? [];
    if (criteria.length === 0) {
      finishStep("evaluation", {
        status: "error",
        error: "No decomposed criteria — run F1 first.",
        wallTimeMs: Date.now() - start,
      });
      pushLog({
        step: "evaluation",
        feature: "F3",
        tone: "error",
        message: "F3 skipped — no decomposed criteria available.",
      });
      throw new Error("No decomposed criteria available for F3 evaluation.");
    }
    await useAiEvaluationStore.getState().evaluateAll(criteria);
    const wall = Date.now() - start;
    const rows = useAiEvaluationStore.getState().rows;
    const statuses = criteria.map((c) => rows[c.id]?.verdict?.status ?? "uncertain");
    const passCount = statuses.filter((s) => s === "pass").length;
    const failCount = statuses.filter((s) => s === "fail").length;
    const reviewCount = statuses.filter(
      (s) => s === "manual_review" || s === "uncertain",
    ).length;
    finishStep("evaluation", { status: "success", wallTimeMs: wall });
    pushLog({
      step: "evaluation",
      feature: "F3",
      tone: "success",
      message: `Evaluated ${criteria.length} criteria → ${passCount} pass / ${failCount} fail / ${reviewCount} review.`,
      wallTimeMs: wall,
    });
  }

  async function runTemporalStep(): Promise<void> {
    startStep("temporal");
    const start = Date.now();
    useAiTemporalStore.getState().runTemporalAnalysis();
    const f4 = useAiTemporalStore.getState();
    const wall = Date.now() - start;
    if (f4.status === "error") {
      finishStep("temporal", {
        status: "error",
        error: f4.error,
        wallTimeMs: wall,
      });
      pushLog({
        step: "temporal",
        feature: "F4",
        tone: "error",
        message: `F4 temporal failed: ${f4.error ?? "unknown error"}`,
      });
      throw new Error(f4.error ?? "F4 temporal failed");
    }
    finishStep("temporal", { status: "success", wallTimeMs: wall });
    const earliest =
      f4.run?.decision.earliestEnrollmentDate ?? "(no decision)";
    pushLog({
      step: "temporal",
      feature: "F4",
      tone: "success",
      message: `Earliest enrollment date: ${earliest} (today ${f4.todayIso}).`,
      wallTimeMs: wall,
    });
  }

  async function runAgentStep(): Promise<void> {
    startStep("agent");
    const question = DEFAULT_PIPELINE_AGENT_QUESTION;

    // Mark running so AgentStep can show a spinner.
    set({
      f5Result: {
        status: "running",
        answer: null,
        question,
        error: null,
        provider: null,
        model: null,
      },
    });

    pushLog({
      step: "agent",
      feature: "F5",
      tone: "info",
      message: `Sending canned question to LLM: "${question}"`,
    });

    // Run the full F5 pipeline: sanitize → orchestrator → safety guard.
    const result = await runAskAgent({
      question,
      scope: "patient",
      scopeId: "patient-001",
    });

    if (result.status === "error") {
      set({
        f5Result: {
          status: "error",
          answer: null,
          question: result.sanitizedQuestion,
          error: result.error,
          provider: result.provider,
          model: result.model,
        },
      });
      finishStep("agent", {
        status: "error",
        error: result.error,
        wallTimeMs: result.wallTimeMs,
      });
      pushLog({
        step: "agent",
        feature: "F5",
        tone: "error",
        message: `F5 agent failed: ${result.error ?? "unknown error"}`,
        wallTimeMs: result.wallTimeMs,
      });
      throw new Error(result.error ?? "F5 agent failed");
    }

    // Success — store the grounded answer so AgentStep renders it inline.
    set({
      f5Result: {
        status: "success",
        answer: result.answer,
        question: result.sanitizedQuestion,
        error: null,
        provider: result.provider,
        model: result.model,
      },
    });
    finishStep("agent", { status: "success", wallTimeMs: result.wallTimeMs });
    pushLog({
      step: "agent",
      feature: "F5",
      tone: "success",
      message: `Grounded answer received (${result.answer?.groundingStatus ?? "?"}) via ${result.provider ?? "?"}/${result.model ?? "?"} — ${result.answer?.citations.length ?? 0} citations.`,
      provider: result.provider,
      model: result.model,
      wallTimeMs: result.wallTimeMs,
    });
  }

  async function runDoneStep(): Promise<void> {
    startStep("done");
    finishStep("done", { status: "success", wallTimeMs: 0 });
    pushLog({
      step: "done",
      feature: "done",
      tone: "success",
      message: "Pipeline complete. Safety console holds every event from this run.",
    });
    set({ completedAt: new Date().toISOString() });
  }

  async function runStep(step: PipelineStepId): Promise<void> {
    try {
      switch (step) {
        case "input":
          await runInputStep();
          break;
        case "decomposition":
          await runDecompositionStep();
          break;
        case "retrieval":
          await runRetrievalStep();
          break;
        case "evaluation":
          await runEvaluationStep();
          break;
        case "temporal":
          await runTemporalStep();
          break;
        case "agent":
          await runAgentStep();
          break;
        case "done":
          await runDoneStep();
          break;
      }
    } finally {
      set({ isRunning: false });
    }
  }

  return {
    currentStep: "input",
    stepState: emptyStepState(),
    runLog: [],
    isRunning: false,
    startedAt: null,
    completedAt: null,
    f5Result: { ...IDLE_F5 },

    advance: () => {
      const cur = get().currentStep;
      set({ currentStep: nextStep(cur) });
    },

    goTo: (step) => set({ currentStep: step }),

    runStep: async (step) => {
      await runStep(step);
    },

    runAll: async () => {
      // Start from the current cursor. If a prior run errored, restart from
      // input — the user can always call reset() first for a totally fresh deck.
      const start = get().currentStep;
      set({ startedAt: new Date().toISOString(), completedAt: null });
      let step: PipelineStepId = start === "done" ? "input" : start;
      // Walk forward until we hit `done` or something throws.
      // We explicitly loop sequentially so the UI gets a chance to render
      // between steps and the feature stores update visibly.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await runStep(step);
        } catch {
          // runStep already wrote the error state + log entry — stop here.
          return;
        }
        if (step === "done") return;
        step = nextStep(step);
        set({ currentStep: step });
      }
    },

    logEntry: (entry) => pushLog(entry),

    reset: () =>
      set({
        currentStep: "input",
        stepState: emptyStepState(),
        runLog: [],
        isRunning: false,
        startedAt: null,
        completedAt: null,
        f5Result: { ...IDLE_F5 },
      }),
  };
});
