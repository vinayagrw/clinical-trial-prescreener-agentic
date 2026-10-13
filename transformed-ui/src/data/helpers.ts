import type { QueueItemEnriched, TaskLane, ChangeDigestItem } from "../types/extended";
import type { CriterionAssessment, MatchStatus } from "@old/types";

// Group queue items by their task lane
export function groupByLane(
  items: QueueItemEnriched[]
): Record<TaskLane, QueueItemEnriched[]> {
  return items.reduce(
    (acc, item) => {
      acc[item.lane].push(item);
      return acc;
    },
    {
      action_now: [] as QueueItemEnriched[],
      needs_pi: [] as QueueItemEnriched[],
      ready_outreach: [] as QueueItemEnriched[],
      watching: [] as QueueItemEnriched[],
    }
  );
}

// Sort by urgency: critical first, then by score descending
export function sortByUrgency(items: QueueItemEnriched[]): QueueItemEnriched[] {
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    moderate: 2,
    watch: 3,
  };
  return [...items].sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    if (pDiff !== 0) return pDiff;
    return b.score - a.score;
  });
}

// Get criterion status distribution for the status bar
export function getCriterionDistribution(
  criteria: CriterionAssessment[]
): { status: MatchStatus; count: number; percentage: number }[] {
  const total = criteria.length;
  if (total === 0) return [];

  const counts: Record<string, number> = {};
  criteria.forEach((c) => {
    counts[c.status] = (counts[c.status] || 0) + 1;
  });

  return (["pass", "fail", "uncertain", "manual_review"] as MatchStatus[])
    .filter((s) => counts[s])
    .map((status) => ({
      status,
      count: counts[status],
      percentage: Math.round((counts[status] / total) * 100),
    }));
}

// Filter digest items by impact level
export function filterDigestByImpact(
  items: ChangeDigestItem[],
  minLevel: "high" | "medium" | "low" = "low"
): ChangeDigestItem[] {
  const levels: Record<string, number> = { high: 2, medium: 1, low: 0 };
  const threshold = levels[minLevel];
  return items.filter((item) => levels[item.impactLevel] >= threshold);
}

// Format a disposition value for display
export function formatDisposition(disposition: string): string {
  const map: Record<string, string> = {
    candidate_for_outreach: "Candidate for Outreach",
    needs_pi_review: "Needs PI Review",
    reviewed_not_actionable: "Reviewed — Not Actionable",
    closed_not_eligible: "Closed — Not Eligible",
    protocol_question: "Protocol Question",
  };
  return map[disposition] ?? disposition;
}

// Get the color tone for a match status
export function statusTone(
  status: MatchStatus
): "moss" | "brick" | "amber" | "slate" {
  switch (status) {
    case "pass": return "moss";
    case "fail": return "brick";
    case "uncertain": return "amber";
    case "manual_review": return "slate";
  }
}

// Parse a date string and return days from today
export function daysFromToday(dateStr: string): number {
  const date = new Date(dateStr);
  const today = new Date("2026-04-06");
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
