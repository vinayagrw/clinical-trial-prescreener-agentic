import type { QueueItem, MatchStatus, Priority, QueueDisposition } from "@old/types";

export type TaskLane = "action_now" | "needs_pi" | "ready_outreach" | "watching";
export type Theme = "light" | "dark";
export type AgentMode = "ask" | "compare" | "summarize" | "explore" | "draft";

export interface TaskLaneConfig {
  id: TaskLane;
  label: string;
  description: string;
  icon: string;
  accentColor: string;
  sortKey: number;
}

export interface WhyNowContext {
  patientId: string;
  matchId: string;
  whatChanged: string;
  whyUrgent: string;
  primaryBlocker: string;
  recommendedAction: string;
  dueBy: string;
  changeTimestamp: string;
}

export interface ChangeDigestItem {
  id: string;
  timestamp: string;
  patientId: string;
  matchId: string;
  changeType: "new_evidence" | "score_change" | "status_change" | "rescreen" | "external_import";
  summary: string;
  impactLevel: "high" | "medium" | "low";
}

export interface CollaborationThread {
  id: string;
  matchId: string;
  initiator: string;
  escalatedTo: string;
  status: "open" | "resolved" | "waiting";
  question: string;
  responses: CollaborationResponse[];
  createdAt: string;
}

export interface CollaborationResponse {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface QueueItemEnriched extends Omit<QueueItem, "whyNow"> {
  lane: TaskLane;
  whyNow: WhyNowContext;
  recentChanges: ChangeDigestItem[];
  collaborationCount: number;
}

export interface KeyboardState {
  activeLane: TaskLane | null;
  activeCardIndex: number;
  activeCriterionIndex: number;
  commandPaletteOpen: boolean;
  focusTarget: "lanes" | "criteria" | "evidence" | "command" | null;
}

// Ask Agent types
export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  table?: AgentTableData;
  citations?: AgentCitation[];
  confidenceNote?: string;
}

export interface AgentTableData {
  headers: string[];
  rows: string[][];
}

export interface AgentCitation {
  id: string;
  label: string;
  sourceDate: string;
  tone: "supporting" | "contradicting" | "context";
}

export interface AgentConversationThread {
  id: string;
  title: string;
  messages: AgentMessage[];
  context: {
    page: string;
    patientId?: string;
    matchId?: string;
    trialId?: string;
  };
}

export interface SuggestedPrompt {
  id: string;
  text: string;
  category: "queue" | "patient" | "trial" | "operations" | "evidence";
  icon: string;
}

// Trial Config — release gates
export interface ReleaseGate {
  id: string;
  trialId: string;
  label: string;
  detail: string;
  status: "complete" | "pending" | "blocked";
}

// Mission Control — task modes (ported from sample-ui)
export type TaskMode =
  | "today"
  | "clinic_prep"
  | "needs_pi_review"
  | "ready_for_outreach"
  | "watchlist"
  | "ops";

export interface TaskModeCard {
  id: TaskMode;
  label: string;
  metric: string;
  detail: string;
}

// Mission Control — curated demo stories (ported from sample-ui)
export interface DemoStory {
  id: string;
  category: string;
  title: string;
  wowFactor: string;
  patientId: string;
  trialId: string;
  matchId: string;
  visibleBlocker: string;
  nextAction: string;
  managerMetric: string;
  promise: string;
}
