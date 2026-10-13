/*
 * AI Features demo types — shapes for the 5 top AI features shown on /ai-features.
 *
 * These reuse existing clinical tokens where possible (Computability, MatchStatus,
 * Freshness) so the page stays consistent with the real review workbench.
 * Nothing here touches production data; it's all derived from aiFeaturesData.ts.
 */

import type { Computability, Freshness, MatchStatus } from "./clinical";

/* ---------- F1: Protocol Criterion Decomposition ---------- */

export type DecompositionConfidence = "high" | "medium" | "low";

export interface ProtocolSourceSpan {
  pageRef: string; // "§4.2, p.14"
  originalText: string; // raw excerpt from the protocol PDF
}

export interface DecomposedCriterion {
  id: string;
  label: string;
  type: "inclusion" | "exclusion";
  computability: Computability;
  threshold: string;
  confidence: DecompositionConfidence;
  source: ProtocolSourceSpan;
  normalizedConcepts: string[];
  dependsOn?: string[];
  reviewNote?: string;
}

export interface ProtocolDecomposition {
  trialId: string;
  protocolId: string;
  protocolTitle: string;
  parsedAt: string;
  pageCount: number;
  wallTimeSeconds: number;
  criteria: DecomposedCriterion[];
  stats: {
    inclusion: number;
    exclusion: number;
    deterministic: number;
    hybrid: number;
    manual_only: number;
    flaggedForReview: number;
  };
}

/* ---------- F2: Hybrid Semantic Evidence Retrieval ---------- */

export interface RetrievalQuery {
  criterionId: string;
  criterionLabel: string;
  keywordTerms: string[]; // BM25 lexical terms
  expandedConcepts: string[]; // ontology expansion
  hybridWeights: { bm25: number; embedding: number };
}

export interface RetrievalHighlightSpan {
  start: number;
  end: number;
  term: string;
}

export interface RetrievalResult {
  id: string;
  rank: number;
  source: string;
  sourceSystem: string;
  sourceDate: string;
  author: string;
  excerpt: string;
  highlightSpans: RetrievalHighlightSpan[];
  bm25Score: number;
  embeddingScore: number;
  hybridScore: number;
  rerankerScore: number;
  finalScore: number;
  passesFreshnessGate: boolean;
}

export interface RetrievalRun {
  id: string;
  patientId: string;
  query: RetrievalQuery;
  wallTimeMs: number;
  corpusSizeNotes: number;
  results: RetrievalResult[];
}

/* ---------- F3: Criterion-Level Evaluation Matrix ---------- */

export type UncertaintyReason =
  | "missing_domain"
  | "conflicting_evidence"
  | "protocol_ambiguity"
  | "stale_data"
  | "manual_only";

export interface MatrixCitation {
  evidenceId: string;
  source: string;
  sourceDate: string;
  excerpt: string;
}

export interface CriterionMatrixEntry {
  id: string;
  label: string;
  bucket: "inclusion" | "exclusion";
  status: MatchStatus;
  computability: Computability;
  reasoning: string;
  uncertaintyReason?: UncertaintyReason;
  citations: MatrixCitation[];
  freshness: Freshness;
  thresholdLabel: string;
  lastEvaluatedAt: string;
  reviewRequired: boolean;
}

export interface CriterionEvaluationRun {
  matchId: string;
  patientId: string;
  trialId: string;
  evaluatedAt: string;
  entries: CriterionMatrixEntry[];
  stats: {
    pass: number;
    fail: number;
    uncertain: number;
    manual_review: number;
    biasToUncertainCount: number;
  };
}

/* ---------- F4: Temporal Reasoning & Washout Calculator ---------- */

export type TemporalTone = "ok" | "waiting" | "warning" | "blocked";

export interface TemporalWindow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  tone: TemporalTone;
  detail: string;
  daysFromToday: number;
  computedFrom: string[];
}

export interface TemporalLabFreshness {
  id: string;
  labName: string;
  lastValue: string;
  lastDrawn: string;
  windowDays: number;
  freshThrough: string;
  tone: TemporalTone;
  daysUntilStale: number;
}

export interface TemporalEligibilityDecision {
  earliestEnrollmentDate: string;
  windowLabel: string;
  blockers: string[];
  tone: TemporalTone;
}

export interface TemporalReasoningRun {
  matchId: string;
  patientId: string;
  trialId: string;
  todayIso: string;
  windows: TemporalWindow[];
  labFreshness: TemporalLabFreshness[];
  decision: TemporalEligibilityDecision;
}

/* ---------- F5: Grounded Ask Agent (summary card) ---------- */

export interface AgentTabSummary {
  key: string;
  label: string;
  description: string;
}

export interface AgentScopeExample {
  route: string;
  scopeLabel: string;
  examplePrompt: string;
}

export interface AskAgentFeatureSummary {
  tabs: AgentTabSummary[];
  scopes: AgentScopeExample[];
  guardrails: string[];
}
