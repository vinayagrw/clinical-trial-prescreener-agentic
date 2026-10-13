// Re-export all original types
export type {
  MatchStatus,
  Priority,
  Freshness,
  QueueDisposition,
  Computability,
  AlertItem,
  Patient,
  Trial,
  QueueItem,
  CriterionAssessment,
  EvidenceSnippet,
  TimelineEvent,
  AuditEvent,
  MatchRecommendation,
  TrialVersion,
  NormalizedCriterion,
  FunnelMetric,
  HeatmapRow,
} from "@old/types";

// Export extended types
export * from "./extended";
