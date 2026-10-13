/*
 * constraintGraph — cross-criterion temporal consistency checking.
 *
 * Many trial criteria share temporal anchors (e.g., "last dose date"
 * is relevant to both washout-window and organ-function criteria).
 * If one criterion's evidence says the last dose was 2026-04-06 but
 * another criterion's evidence implies it was 2026-03-20, the
 * screening results are internally inconsistent.
 *
 * This module builds a lightweight dependency graph of criteria that
 * share temporal anchors, then checks for date contradictions after
 * all criteria are individually evaluated.
 */

import type {
  CriterionAssessment,
  NormalizedCriterion,
} from "../../types";
import { extractDatesFromText } from "../nlp/dateExtractor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemporalNode {
  /** Criterion ID this node represents. */
  criterionId: string;
  /** The temporal anchor this criterion depends on. */
  anchor: string;
  /** Lookback window in days, if applicable. */
  windowDays?: number;
  /** The most relevant date extracted from the criterion's evidence. */
  extractedDate?: string;
}

export interface TemporalEdge {
  /** Source criterion ID. */
  from: string;
  /** Target criterion ID. */
  to: string;
  /** The shared temporal anchor. */
  sharedAnchor: string;
}

export interface TemporalInconsistency {
  /** The two criteria that disagree. */
  criterionIds: [string, string];
  /** Which anchor they share. */
  anchor: string;
  /** The conflicting dates. */
  dates: [string, string];
  /** Human-readable description. */
  message: string;
}

// ---------------------------------------------------------------------------
// Anchor detection
// ---------------------------------------------------------------------------

const ANCHOR_PATTERNS: { anchor: string; pattern: RegExp }[] = [
  { anchor: "last_dose", pattern: /last dose|discontinue|washout|stopped/i },
  { anchor: "diagnosis_date", pattern: /diagnos|initial presentation|confirmed/i },
  { anchor: "last_imaging", pattern: /imaging|ct scan|mri|recist|restaging/i },
  { anchor: "surgery_date", pattern: /surgery|resection|operative|post-op/i },
  { anchor: "screening_date", pattern: /screen|enrollment|within \d+ days/i },
  { anchor: "last_therapy", pattern: /prior therapy|previous treatment|systemic therapy/i },
];

function detectAnchor(criterion: NormalizedCriterion): string | undefined {
  // Use the criterion's explicit temporal anchor if set.
  if (criterion.temporalAnchor) return criterion.temporalAnchor;

  const text = `${criterion.label} ${criterion.threshold} ${criterion.note}`;
  for (const { anchor, pattern } of ANCHOR_PATTERNS) {
    if (pattern.test(text)) return anchor;
  }
  return undefined;
}

function parseWindowDays(criterion: NormalizedCriterion): number | undefined {
  const text = `${criterion.label} ${criterion.threshold}`;
  const dayMatch = /(\d+)\s*(?:-?\s*)day/i.exec(text);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  const monthMatch = /(\d+)\s*month/i.exec(text);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;
  return undefined;
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

/**
 * Build a temporal constraint graph from evaluated criteria.
 *
 * For each criterion, detects its temporal anchor and extracts dates from
 * the assessment reasoning. Criteria sharing the same anchor are connected
 * by edges.
 */
export function buildConstraintGraph(
  criteria: NormalizedCriterion[],
  assessments: Record<string, CriterionAssessment>,
  referenceDate: string,
): { nodes: TemporalNode[]; edges: TemporalEdge[] } {
  const nodes: TemporalNode[] = [];

  for (const criterion of criteria) {
    const anchor = detectAnchor(criterion);
    if (!anchor) continue;

    const assessment = assessments[criterion.id];
    let extractedDate: string | undefined;

    // Try to extract a date from the assessment reasoning.
    if (assessment?.reasoning) {
      const dates = extractDatesFromText(assessment.reasoning, referenceDate);
      // Pick the most confident, most recent date.
      const best = dates
        .filter((d) => d.confidence === "exact" || d.confidence === "approximate")
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      extractedDate = best?.date;
    }

    nodes.push({
      criterionId: criterion.id,
      anchor,
      windowDays: parseWindowDays(criterion),
      extractedDate,
    });
  }

  // Build edges between criteria sharing the same anchor.
  const edges: TemporalEdge[] = [];
  const byAnchor = new Map<string, TemporalNode[]>();
  for (const node of nodes) {
    const group = byAnchor.get(node.anchor) ?? [];
    group.push(node);
    byAnchor.set(node.anchor, group);
  }

  for (const [, group] of byAnchor) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        edges.push({
          from: group[i].criterionId,
          to: group[j].criterionId,
          sharedAnchor: group[i].anchor,
        });
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Consistency checking
// ---------------------------------------------------------------------------

/** Default tolerance: dates within 7 days of each other are considered consistent. */
const DATE_TOLERANCE_DAYS = 7;

/**
 * Check for temporal inconsistencies between criteria sharing anchors.
 *
 * Returns a list of inconsistencies where two criteria sharing a temporal
 * anchor have extracted dates that differ by more than `DATE_TOLERANCE_DAYS`.
 */
export function checkTemporalConsistency(
  nodes: TemporalNode[],
  edges: TemporalEdge[],
): TemporalInconsistency[] {
  const inconsistencies: TemporalInconsistency[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.criterionId, n]));

  for (const edge of edges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode?.extractedDate || !toNode?.extractedDate) continue;

    const diffMs = Math.abs(
      new Date(`${fromNode.extractedDate}T00:00:00Z`).getTime() -
      new Date(`${toNode.extractedDate}T00:00:00Z`).getTime(),
    );
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > DATE_TOLERANCE_DAYS) {
      inconsistencies.push({
        criterionIds: [edge.from, edge.to],
        anchor: edge.sharedAnchor,
        dates: [fromNode.extractedDate, toNode.extractedDate],
        message:
          `Criteria ${edge.from} and ${edge.to} share anchor "${edge.sharedAnchor}" ` +
          `but disagree on dates by ${diffDays} days ` +
          `(${fromNode.extractedDate} vs ${toNode.extractedDate}).`,
      });
    }
  }

  return inconsistencies;
}
