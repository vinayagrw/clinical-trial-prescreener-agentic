import type {
  AuditEvent,
  ComputabilityCell,
  ContradictionSignal,
  CoverageCompositionBarModel,
  CriterionAssessment,
  DemoStory,
  EligibilityAtlasGroup,
  EvidenceSnippet,
  HeatmapRow,
  HotspotPoint,
  HotspotRankedItem,
  MatchRecommendation,
  MissingDataSignal,
  NormalizedCriterion,
  PatientEvidenceBundle,
  PortfolioStageMetric,
  Priority,
  ProtocolTimelineItem,
  ProvenanceGroup,
  QueueDisposition,
  QueueItem,
  QueuePriorityPoint,
  ReadinessStep,
  ResolutionBoardItem,
  StoryRailItem,
  TaskModeCard,
  TimelineEvent,
  TimelineWindowModel,
  TraceNode,
  Trial,
  TrialMetricCard,
  TrialVersion
} from "../types";

const STOP_WORDS = new Set([
  "about",
  "after",
  "against",
  "before",
  "because",
  "brief",
  "could",
  "current",
  "detail",
  "during",
  "evidence",
  "group",
  "needs",
  "queue",
  "review",
  "state",
  "still",
  "that",
  "this",
  "through",
  "trial",
  "which",
  "with"
]);

function parsePercent(value: string): number {
  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseDate(value: string): number {
  const normalized = value.split("|")[0]?.trim() ?? value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function radiusForTrialCount(count: number): number {
  return 18 + count * 6;
}

function priorityUrgency(priority: Priority, changedOvernight = false): number {
  const base =
    priority === "critical"
      ? 90
      : priority === "high"
        ? 74
        : priority === "moderate"
          ? 56
          : 34;
  return Math.min(96, base + (changedOvernight ? 6 : 0));
}

function dispositionReadiness(disposition: QueueDisposition): number {
  switch (disposition) {
    case "candidate_for_outreach":
      return 88;
    case "needs_pi_review":
      return 58;
    case "protocol_question":
      return 38;
    case "reviewed_not_actionable":
      return 22;
    case "closed_not_eligible":
      return 12;
    default:
      return 48;
  }
}

function inferAtlasLane(
  assessment: CriterionAssessment
): EligibilityAtlasGroup["id"] {
  if (assessment.computability === "manual_only" || assessment.status === "manual_review") {
    return "manual_review";
  }

  if (/^no /i.test(assessment.label) || /exclusion/i.test(assessment.summary)) {
    return "exclusion";
  }

  return "inclusion";
}

function deriveLookbackDays(assessment: CriterionAssessment): number | null {
  const sourceText = `${assessment.label} ${assessment.thresholdLabel ?? ""} ${assessment.reasoning}`;

  if (/6 months|180 days/i.test(sourceText)) {
    return 180;
  }

  const dayMatch = sourceText.match(/(\d+)\s*day/i);
  if (dayMatch) {
    return Number.parseInt(dayMatch[1], 10);
  }

  const monthMatch = sourceText.match(/(\d+)\s*month/i);
  if (monthMatch) {
    return Number.parseInt(monthMatch[1], 10) * 30;
  }

  return null;
}

function stageForAuditEvent(event: AuditEvent): TraceNode["stage"] {
  if (event.eventType.includes("screening.job")) {
    return "ingest";
  }

  if (event.eventType.includes("criterion")) {
    return "evaluate";
  }

  if (event.eventType.includes("override")) {
    return "review";
  }

  return "finalize";
}

function linkedCriterionIds(summary: string): string[] {
  const matches = summary.match(/criterion\s+(\d+)/gi) ?? [];
  return matches.map((match) => {
    const digits = match.match(/(\d+)/)?.[1] ?? "0";
    return `criterion-${digits.padStart(3, "0")}`;
  });
}

function timelineTone(days: number): TimelineWindowModel["tone"] {
  if (days >= 180) {
    return "brick";
  }

  if (days >= 30) {
    return "amber";
  }

  return "teal";
}

export function buildQueuePriorityPoints(
  items: QueueItem[],
  matches: MatchRecommendation[],
  patients: { id: string; name: string }[],
  trials: Trial[]
): QueuePriorityPoint[] {
  return items.map((item) => {
    const patient = patients.find((candidate) => candidate.id === item.patientId);
    const trial = trials.find((candidate) => candidate.id === item.trialId);
    const match = matches.find((candidate) => candidate.id === item.matchId);
    const blockerCount = match?.blockers.length ?? 0;

    return {
      id: `matrix-${item.matchId}`,
      matchId: item.matchId,
      patientName: patient?.name ?? "Unknown patient",
      trialLabel: trial?.shortCode ?? "Unknown trial",
      x: Math.min(96, dispositionReadiness(item.nextStep) + Math.max(0, item.score - 70) * 0.16),
      y: Math.max(12, priorityUrgency(item.priority, item.changedOvernight) - blockerCount * 2),
      radius: radiusForTrialCount(item.trialCount),
      disposition: item.nextStep,
      priority: item.priority,
      changedOvernight: Boolean(item.changedOvernight),
      score: item.score,
      label: patient?.name ?? item.matchId,
      detail: item.recommendedAction ?? item.reviewState,
      item
    };
  });
}

export function buildStoryRailItems(
  items: QueueItem[],
  stories: DemoStory[]
): StoryRailItem[] {
  return items.flatMap((item) => {
    const story = stories.find((candidate) => candidate.id === item.storyId);
    if (!story) {
      return [];
    }

    return [
      {
        id: story.id,
        matchId: item.matchId,
        title: story.title,
        category: story.category,
        promise: story.promise,
        managerMetric: story.managerMetric,
        nextAction: story.nextAction,
        wowFactor: story.wowFactor
      }
    ];
  });
}

export function buildEligibilityAtlas(
  assessments: CriterionAssessment[]
): EligibilityAtlasGroup[] {
  const groups: EligibilityAtlasGroup[] = [
    { id: "inclusion", label: "Inclusion fit", tone: "teal", criteria: [] },
    { id: "exclusion", label: "Exclusion pressure", tone: "amber", criteria: [] },
    { id: "manual_review", label: "Manual review boundary", tone: "brick", criteria: [] }
  ];

  assessments.forEach((assessment) => {
    const target = groups.find((group) => group.id === inferAtlasLane(assessment));
    if (target) {
      target.criteria.push(assessment);
    }
  });

  return groups;
}

export function buildTimelineWindows(
  assessment: CriterionAssessment | undefined
): TimelineWindowModel[] {
  if (!assessment) {
    return [];
  }

  const lookbackDays = deriveLookbackDays(assessment);
  const anchorTs = parseDate(assessment.lastEvaluatedAt ?? new Date().toISOString());

  if (!lookbackDays) {
    return [];
  }

  return [
    {
      id: `window-${assessment.id}`,
      label: `${lookbackDays}-day review window`,
      startLabel: new Date(anchorTs - lookbackDays * 24 * 60 * 60 * 1000).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      ),
      endLabel: new Date(anchorTs).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
      startTs: anchorTs - lookbackDays * 24 * 60 * 60 * 1000,
      endTs: anchorTs,
      tone: timelineTone(lookbackDays),
      detail: assessment.thresholdLabel ?? assessment.summary
    }
  ];
}

export function buildResolutionBoard(
  contradictions: ContradictionSignal[],
  missingData: MissingDataSignal[]
): ResolutionBoardItem[] {
  const contradictionRows = contradictions.map<ResolutionBoardItem>((signal) => ({
    id: signal.id,
    lane: "contradictions",
    title: signal.title,
    summary: signal.summary,
    owner: "PI review",
    dueLabel: signal.action,
    tone: signal.severity === "critical" ? "brick" : "amber",
    sortValue: signal.severity === "critical" ? 0 : 1,
    linkedCount: signal.evidenceIds.length,
    detail: `${signal.evidenceIds.length} linked sources`
  }));

  const missingRows = missingData.map<ResolutionBoardItem>((signal) => ({
    id: signal.id,
    lane: "missing_data",
    title: signal.label,
    summary: signal.detail,
    owner: signal.owner,
    dueLabel: signal.dueBy,
    tone: signal.status === "missing" || signal.status === "stale" ? "brick" : "amber",
    sortValue: signal.status === "missing" || signal.status === "stale" ? 0 : 1,
    linkedCount: 0,
    detail: signal.status
  }));

  return [...contradictionRows, ...missingRows].sort(
    (left, right) => left.sortValue - right.sortValue
  );
}

export function buildHotspotPoints(rows: HeatmapRow[]): HotspotPoint[] {
  return rows.map((row) => {
    const uncertainRate = parsePercent(row.uncertainRate);
    const overrideRate = parsePercent(row.overrideRate);
    const interpreted = interpretHotspotRow(row);

    return {
      id: row.family,
      family: row.family,
      uncertainRate,
      overrideRate,
      hotspot: row.hotspot,
      tone: interpreted.tone
    };
  });
}

function interpretHotspotRow(row: HeatmapRow) {
  const uncertaintyRate = parsePercent(row.uncertainRate);
  const overrideRate = parsePercent(row.overrideRate);
  const operationalDragScore = uncertaintyRate + overrideRate;
  const familyLabel = row.family.toLowerCase();
  const isManualBoundary =
    familyLabel.includes("manual-only") ||
    familyLabel.includes("investigator judgment");

  if (isManualBoundary) {
    return {
      uncertaintyRate,
      overrideRate,
      operationalDragScore,
      interpretationLabel: "Human-review boundary" as const,
      whyItMatters:
        "This family is intentionally human-reviewed and should stay visible as a governed clinical boundary.",
      actionLabel:
        "Keep it audit-ready and route it through PI review instead of trying to automate it away.",
      isManualBoundary,
      tone: "paper" as const
    };
  }

  if (uncertaintyRate >= 12 && overrideRate >= 8) {
    return {
      uncertaintyRate,
      overrideRate,
      operationalDragScore,
      interpretationLabel: "Fix first" as const,
      whyItMatters:
        "The engine hesitates here and reviewers still change the answer, so this family compounds cycle time.",
      actionLabel:
        "Tighten rules, normalize protocol wording, and improve cited evidence coverage for this family.",
      isManualBoundary,
      tone: "brick" as const
    };
  }

  if (uncertaintyRate >= 12) {
    return {
      uncertaintyRate,
      overrideRate,
      operationalDragScore,
      interpretationLabel: "Data coverage issue" as const,
      whyItMatters:
        "The system stays uncertain because the evidence arrives late, stale, or incomplete.",
      actionLabel:
        "Improve source freshness, outside-record intake, or retrieval coverage before changing the rule logic.",
      isManualBoundary,
      tone: operationalDragScore >= 10 ? ("amber" as const) : ("teal" as const)
    };
  }

  if (overrideRate >= 8) {
    return {
      uncertaintyRate,
      overrideRate,
      operationalDragScore,
      interpretationLabel: "Rule or policy mismatch" as const,
      whyItMatters:
        "Reviewers often disagree with the current system interpretation even when evidence is available.",
      actionLabel:
        "Refine thresholds, local policy logic, or release-state handling for this criterion family.",
      isManualBoundary,
      tone: operationalDragScore >= 10 ? ("amber" as const) : ("teal" as const)
    };
  }

  return {
    uncertaintyRate,
    overrideRate,
    operationalDragScore,
    interpretationLabel: "Stable watch" as const,
    whyItMatters:
      "This family is visible in review, but it is not driving the largest operational drag right now.",
    actionLabel:
      "Monitor the trend, but spend the next workflow or rules sprint on higher-drag families first.",
    isManualBoundary,
    tone: operationalDragScore >= 10 ? ("amber" as const) : ("teal" as const)
  };
}

export function buildHotspotRankedItems(rows: HeatmapRow[]): HotspotRankedItem[] {
  return rows
    .map((row) => {
      const interpreted = interpretHotspotRow(row);

      return {
        id: row.family,
        family: row.family,
        uncertaintyRate: interpreted.uncertaintyRate,
        overrideRate: interpreted.overrideRate,
        operationalDragScore: interpreted.operationalDragScore,
        interpretationLabel: interpreted.interpretationLabel,
        whyItMatters: row.hotspot || interpreted.whyItMatters,
        actionLabel: interpreted.actionLabel,
        isManualBoundary: interpreted.isManualBoundary,
        tone: interpreted.tone
      };
    })
    .sort((left, right) => {
      if (left.isManualBoundary !== right.isManualBoundary) {
        return left.isManualBoundary ? 1 : -1;
      }

      return right.operationalDragScore - left.operationalDragScore;
    });
}

export function buildPortfolioStageMetrics(
  trials: Trial[],
  metrics: TrialMetricCard[]
): PortfolioStageMetric[] {
  return metrics.flatMap((metric) => {
    const trial = trials.find((candidate) => candidate.id === metric.trialId);
    if (!trial) {
      return [];
    }

    return [
      {
        trialId: metric.trialId,
        shortCode: metric.shortCode,
        screened: metric.screened,
        piEscalations: metric.piEscalations,
        outreachReady: metric.outreachReady,
        enrolled: metric.enrolled,
        blocker: metric.mainBlocker,
        trial
      }
    ];
  });
}

export function buildComputabilityCells(
  criteria: NormalizedCriterion[]
): ComputabilityCell[] {
  const cells: ComputabilityCell[] = [];
  const types = ["inclusion", "exclusion"] as const;
  const computabilities = ["deterministic", "hybrid", "manual_only"] as const;

  types.forEach((type) => {
    computabilities.forEach((computability) => {
      const filtered = criteria.filter(
        (criterion) =>
          criterion.type === type && criterion.computability === computability
      );

      cells.push({
        id: `${type}-${computability}`,
        type,
        computability,
        count: filtered.length,
        criteria: filtered
      });
    });
  });

  return cells;
}

export function buildTraceNodes(events: AuditEvent[]): TraceNode[] {
  return events.map((event) => ({
    id: event.id,
    label: event.eventType.replace(/\./g, " "),
    timestamp: event.timestamp,
    actor: event.actor,
    summary: event.summary,
    stage: stageForAuditEvent(event),
    event,
    linkedCriterionIds: linkedCriterionIds(event.summary)
  }));
}

export function buildProvenanceGroups(
  evidence: EvidenceSnippet[]
): ProvenanceGroup[] {
  const grouped = new Map<string, EvidenceSnippet[]>();

  evidence.forEach((item) => {
    const existing = grouped.get(item.sourceSystem) ?? [];
    existing.push(item);
    grouped.set(item.sourceSystem, existing);
  });

  return Array.from(grouped.entries()).map(([sourceSystem, items]) => {
    const sorted = [...items].sort(
      (left, right) => parseDate(right.sourceDate) - parseDate(left.sourceDate)
    );

    return {
      id: sourceSystem,
      sourceSystem,
      label: sourceSystem,
      freshestDate: sorted[0]?.sourceDate ?? "Unknown",
      supportingCount: items.filter((item) => item.tone === "supporting").length,
      contradictingCount: items.filter((item) => item.tone === "contradicting").length,
      contextCount: items.filter((item) => item.tone === "context").length,
      items: sorted
    };
  });
}

export function buildCoverageComposition(
  evidenceBundle: PatientEvidenceBundle,
  contradictions: ContradictionSignal[],
  missingData: MissingDataSignal[]
): CoverageCompositionBarModel {
  const total = Math.max(1, evidenceBundle.items.length + missingData.length + contradictions.length);
  const fresh = evidenceBundle.items.filter((item) => item.freshness === "fresh").length;
  const agingOrMissing =
    evidenceBundle.items.length - fresh + missingData.length;

  return {
    total,
    fresh,
    agingOrMissing,
    contradictions: contradictions.length
  };
}

export function buildReadinessSteps(
  guardrails: { label: string; detail: string; status: "on_track" | "watch" | "risk" }[]
): ReadinessStep[] {
  return guardrails.map((guardrail) => ({
    id: guardrail.label,
    label: guardrail.label,
    detail: guardrail.detail,
    status: guardrail.status
  }));
}

export function buildProtocolTimeline(
  versions: TrialVersion[]
): ProtocolTimelineItem[] {
  return [...versions]
    .sort((left, right) => parseDate(right.releasedAt) - parseDate(left.releasedAt))
    .map((version) => ({
      id: version.id,
      version: version.version,
      releasedAt: version.releasedAt,
      status: version.status,
      summary: version.summary,
      versionData: version
    }));
}

export function buildLoadRibbon(
  modes: TaskModeCard[],
  items: QueueItem[]
): Array<TaskModeCard & { liveCases: number }> {
  return modes.map((mode) => ({
    ...mode,
    liveCases: items.filter((item) => item.taskModes?.includes(mode.id)).length
  }));
}

export function filterEvidenceForTrace(
  evidence: EvidenceSnippet[],
  traceNode: TraceNode | undefined
): EvidenceSnippet[] {
  if (!traceNode || traceNode.stage === "ingest" || traceNode.stage === "finalize") {
    return evidence;
  }

  if (!traceNode.linkedCriterionIds.length) {
    return evidence;
  }

  return evidence.filter((item) =>
    item.criterionIds.some((criterionId) =>
      traceNode.linkedCriterionIds.includes(criterionId)
    )
  );
}

export function extractHighlightTerms(texts: string[]): string[] {
  const counts = new Map<string, number>();

  texts
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9.%+-]+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
    .forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([token]) => token);
}

export function matchesHighlightTerms(text: string, terms: string[]): boolean {
  if (!terms.length) {
    return false;
  }

  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}
