/*
 * Per-session token budget tracker.
 *
 * The real Claude API bills by token. Even in demo mode we want the UI to
 * surface "this demo has consumed X / Y tokens" so stakeholders can talk
 * cost with real numbers. Wire into an AgentClient via withBudget() in
 * src/agent/client.ts.
 *
 * Not persisted — a reload resets the counter. If we ever need cumulative
 * org-level accounting, that lives on the server, not here.
 */

export interface BudgetState {
  used: number;
  soft: number;
  hard: number;
  /** "ok" until 75% of soft cap, "warn" between 75-100%, "blocked" at hard cap. */
  status: "ok" | "warn" | "blocked";
}

export interface BudgetTracker {
  readonly state: BudgetState;
  addUsage(tokens: number): BudgetState;
  reset(): void;
  subscribe(listener: (state: BudgetState) => void): () => void;
}

/**
 * Defaults chosen to match a comfortable demo session: ~50k tokens of soft
 * budget (roughly 25-40 back-and-forth turns against a 8k system prompt),
 * hard stop at 100k. Real deployments override via env.
 */
const DEFAULT_SOFT = 50_000;
const DEFAULT_HARD = 100_000;

function computeStatus(used: number, soft: number, hard: number): BudgetState["status"] {
  if (used >= hard) return "blocked";
  if (used >= soft * 0.75) return "warn";
  return "ok";
}

export function createBudgetTracker(
  soft: number = DEFAULT_SOFT,
  hard: number = DEFAULT_HARD,
): BudgetTracker {
  let state: BudgetState = {
    used: 0,
    soft,
    hard,
    status: "ok",
  };
  const listeners = new Set<(state: BudgetState) => void>();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  return {
    get state() {
      return state;
    },
    addUsage(tokens: number) {
      const nextUsed = state.used + Math.max(0, tokens);
      state = {
        used: nextUsed,
        soft,
        hard,
        status: computeStatus(nextUsed, soft, hard),
      };
      notify();
      return state;
    },
    reset() {
      state = { used: 0, soft, hard, status: "ok" };
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Singleton used by the default AgentClient wiring in main.tsx. */
export const sessionBudget = createBudgetTracker();
