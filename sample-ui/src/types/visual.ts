import type {
  Computability,
  CriterionAssessment,
  EvidenceSnippet,
  MatchRecommendation,
  NormalizedCriterion,
  Priority,
  QueueDisposition,
  QueueItem,
  TimelineEvent,
  Trial,
  TrialVersion
} from "./clinical.ts";
import type { AuditEvent, PilotAcceptanceCard } from "./collab.ts";

export interface QueuePriorityPoint {
  id: string;
  matchId: string;
  patientName: string;
  trialLabel: string;
  x: number;
  y: number;
  radius: number;
  disposition: QueueDisposition;
  priority: Priority;
  changedOvernight: boolean;
  score: number;
  label: string;
  detail: string;
  item: QueueItem;
}

export interface StoryRailItem {
  id: string;
  matchId: string;
  title: string;
  category: string;
  promise: string;
  managerMetric: string;
  nextAction: string;
  wowFactor: string;
}

export interface EligibilityAtlasGroup {
  id: string;
  label: string;
  tone: "teal" | "amber" | "brick";
  criteria: CriterionAssessment[];
}

export interface TimelineWindowModel {
  id: string;
  label: string;
  startLabel: string;
  endLabel: string;
  startTs: number;
  endTs: number;
  tone: "teal" | "amber" | "brick";
  detail: string;
}

export interface ResolutionBoardItem {
  id: string;
  lane: "contradictions" | "missing_data";
  title: string;
  summary: string;
  owner: string;
  dueLabel: string;
  tone: "amber" | "brick" | "paper";
  sortValue: number;
  linkedCount: number;
  detail: string;
}

export interface HotspotPoint {
  id: string;
  family: string;
  uncertainRate: number;
  overrideRate: number;
  hotspot: string;
  tone: "teal" | "amber" | "brick" | "paper";
}

export interface HotspotRankedItem {
  id: string;
  family: string;
  uncertaintyRate: number;
  overrideRate: number;
  operationalDragScore: number;
  interpretationLabel:
    | "Fix first"
    | "Data coverage issue"
    | "Rule or policy mismatch"
    | "Stable watch"
    | "Human-review boundary";
  whyItMatters: string;
  actionLabel: string;
  isManualBoundary: boolean;
  tone: "teal" | "amber" | "brick" | "paper";
}

export interface PortfolioStageMetric {
  trialId: string;
  shortCode: string;
  screened: number;
  piEscalations: number;
  outreachReady: number;
  enrolled: number;
  blocker: string;
  trial: Trial;
}

export interface ComputabilityCell {
  id: string;
  type: "inclusion" | "exclusion";
  computability: Computability;
  count: number;
  criteria: NormalizedCriterion[];
}

export interface TraceNode {
  id: string;
  label: string;
  timestamp: string;
  actor: string;
  summary: string;
  stage: "ingest" | "evaluate" | "review" | "finalize";
  event: AuditEvent;
  linkedCriterionIds: string[];
}

export interface ProvenanceGroup {
  id: string;
  sourceSystem: string;
  label: string;
  freshestDate: string;
  items: EvidenceSnippet[];
  supportingCount: number;
  contradictingCount: number;
  contextCount: number;
}

export interface CoverageCompositionBarModel {
  total: number;
  fresh: number;
  agingOrMissing: number;
  contradictions: number;
}

export interface ReadinessStep {
  id: string;
  label: string;
  detail: string;
  status: PilotAcceptanceCard["status"];
}

export interface ProtocolTimelineItem {
  id: string;
  version: string;
  releasedAt: string;
  status: string;
  summary: string;
  versionData: TrialVersion;
}
