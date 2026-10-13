import type { AgentContextSnippet } from "../lib/ai/prompts/askAgent";
import type {
  AssistantResponse,
  AssistantSession,
  CitationRef,
  Freshness,
  SupportingTable,
  WidgetPageContext,
} from "../types";
import type {
  ClinicalDocument,
  Citation,
  HandoffAuditResponse,
  HandoffRecord,
  WorklistItem,
} from "../types/handoff";

export interface HandoffAssistantResources {
  worklistItems?: WorklistItem[];
  record?: HandoffRecord;
  audit?: HandoffAuditResponse;
  documents?: ClinicalDocument[];
  isLoading?: boolean;
  errorMessage?: string | null;
}

function toFreshness(authoredAt?: string): Freshness {
  if (!authoredAt) return "missing";

  const diffMs = Date.now() - new Date(authoredAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 24) return "fresh";
  if (diffHours <= 72) return "aging";
  return "stale";
}

function truncate(value: string, max = 96) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}...`;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function toCitationRef(citation: Citation): CitationRef {
  return {
    id: citation.id,
    label: citation.documentTitle,
    detail: `${citation.service} | ${new Date(citation.authoredAt).toLocaleString()} | "${citation.quotedEvidence}"`,
    freshness: toFreshness(citation.authoredAt),
    tone: "supporting",
  };
}

function toWarningCitationRef(citation: Citation): CitationRef {
  return {
    ...toCitationRef(citation),
    tone: "warning",
  };
}

function citationsById(record: HandoffRecord | undefined) {
  return new Map((record?.summary.citations ?? []).map((citation) => [citation.id, citation]));
}

function citationsForIds(record: HandoffRecord | undefined, citationIds: string[]) {
  const byId = citationsById(record);
  return uniqueById(
    citationIds
      .map((citationId) => byId.get(citationId))
      .filter((citation): citation is Citation => Boolean(citation)),
  );
}

function citationsForBulletIds(
  record: HandoffRecord | undefined,
  bulletIds: Array<{ citationIds: string[] }>,
) {
  return citationsForIds(
    record,
    bulletIds.flatMap((bullet) => bullet.citationIds),
  );
}

function allCitationRefs(record: HandoffRecord | undefined) {
  return (record?.summary.citations ?? []).map(toCitationRef);
}

function auditCitationRefs(audit: HandoffAuditResponse | undefined): CitationRef[] {
  return (audit?.audit ?? []).slice(0, 5).map((event) => ({
    id: `audit-${event.id}`,
    label: event.stage.replace(/_/g, " "),
    detail: `${new Date(event.createdAt).toLocaleString()} | ${event.summary} | ${event.detail}`,
    freshness: toFreshness(event.createdAt),
    tone: "context",
  }));
}

function worklistCitationRefs(items: WorklistItem[] | undefined): CitationRef[] {
  return (items ?? []).slice(0, 5).map((item) => ({
    id: `worklist-${item.handoffId}`,
    label: `${item.patientName} | ${item.status.replace("_", " ")}`,
    detail: `${item.headline} | ${item.nextAction} | ${item.openDisagreements} disagreements | ${item.missingInfoCount} missing items`,
    freshness: toFreshness(item.generatedAt),
    tone: item.status === "needs_review" ? "warning" : "supporting",
  }));
}

function tableForCitations(title: string, citations: Citation[]): SupportingTable | undefined {
  if (citations.length === 0) {
    return undefined;
  }

  return {
    title,
    columns: ["Document", "Service", "Evidence"],
    rows: citations.slice(0, 5).map((citation) => [
      citation.documentTitle,
      citation.service,
      truncate(citation.quotedEvidence, 72),
    ]),
  };
}

function loadingResponse(
  id: string,
  promptId: string,
  userQuestion: string,
  scope: AssistantResponse["scope"],
  summary: string,
): AssistantResponse {
  return {
    id,
    promptId,
    userQuestion,
    scope,
    mode: "quick_answer",
    groundingStatus: "partial",
    trustBadge: "Waiting on live handoff data",
    summary,
    citations: [],
    howDerived: "The handoff workspace has not finished loading the current case or worklist yet.",
    recommendedNextAction: "Let the live handoff payload load, then ask again for case-specific reasoning.",
  };
}

function unavailableResponse(
  id: string,
  promptId: string,
  userQuestion: string,
  scope: AssistantResponse["scope"],
  errorMessage?: string | null,
): AssistantResponse {
  return {
    id,
    promptId,
    userQuestion,
    scope,
    mode: "quick_answer",
    groundingStatus: "uncertain",
    trustBadge: "Workspace fallback",
    summary:
      errorMessage ??
      "The current handoff data is unavailable, so I can only offer workspace-level guidance right now.",
    citations: [],
    howDerived: "No live handoff payload was available for this route.",
    recommendedNextAction: "Reload the case or worklist and use the stored SBAR once the record returns.",
  };
}

function buildWorklistSession(resources: HandoffAssistantResources): AssistantSession {
  const items = resources.worklistItems ?? [];

  if (resources.isLoading && items.length === 0) {
    return {
      id: "handoff-worklist",
      promptGroup: "Handoff worklist prompts",
      context: {
        title: "Ask Agent",
        scopeLabel: "Handoff worklist",
        description: "Loading the live handoff worklist and current review priorities.",
      },
      defaultPromptId: "handoff-worklist-prompt-001",
      prompts: [
        {
          id: "handoff-worklist-prompt-001",
          label: "What changed in the last 24 hours?",
          prompt: "What changed in the handoff worklist in the last 24 hours?",
          mode: "quick_answer",
          scope: "workspace",
        },
        {
          id: "handoff-worklist-prompt-002",
          label: "Which handoffs need review?",
          prompt: "Which handoffs need review right now?",
          mode: "workspace_research",
          scope: "workspace",
        },
        {
          id: "handoff-worklist-prompt-003",
          label: "What should I prioritize first?",
          prompt: "What should I prioritize first from this handoff worklist?",
          mode: "workspace_research",
          scope: "workspace",
        },
      ],
      responses: [
        loadingResponse(
          "handoff-worklist-response-001",
          "handoff-worklist-prompt-001",
          "What changed in the handoff worklist in the last 24 hours?",
          "workspace",
          "The handoff worklist is still loading, so I do not have live case counts or disagreement flags yet.",
        ),
        loadingResponse(
          "handoff-worklist-response-002",
          "handoff-worklist-prompt-002",
          "Which handoffs need review right now?",
          "workspace",
          "I can identify review-needed handoffs once the live worklist finishes loading.",
        ),
        loadingResponse(
          "handoff-worklist-response-003",
          "handoff-worklist-prompt-003",
          "What should I prioritize first from this handoff worklist?",
          "workspace",
          "I need the live worklist rows before I can rank handoff priority.",
        ),
      ],
    };
  }

  if (resources.errorMessage && items.length === 0) {
    return {
      id: "handoff-worklist",
      promptGroup: "Handoff worklist prompts",
      context: {
        title: "Ask Agent",
        scopeLabel: "Handoff worklist",
        description: "Worklist-level guidance grounded in the current resident handoff queue.",
      },
      defaultPromptId: "handoff-worklist-prompt-001",
      prompts: [
        {
          id: "handoff-worklist-prompt-001",
          label: "What changed in the last 24 hours?",
          prompt: "What changed in the handoff worklist in the last 24 hours?",
          mode: "quick_answer",
          scope: "workspace",
        },
        {
          id: "handoff-worklist-prompt-002",
          label: "Which handoffs need review?",
          prompt: "Which handoffs need review right now?",
          mode: "workspace_research",
          scope: "workspace",
        },
        {
          id: "handoff-worklist-prompt-003",
          label: "What should I prioritize first?",
          prompt: "What should I prioritize first from this handoff worklist?",
          mode: "workspace_research",
          scope: "workspace",
        },
      ],
      responses: [
        unavailableResponse(
          "handoff-worklist-response-001",
          "handoff-worklist-prompt-001",
          "What changed in the handoff worklist in the last 24 hours?",
          "workspace",
          resources.errorMessage,
        ),
        unavailableResponse(
          "handoff-worklist-response-002",
          "handoff-worklist-prompt-002",
          "Which handoffs need review right now?",
          "workspace",
          resources.errorMessage,
        ),
        unavailableResponse(
          "handoff-worklist-response-003",
          "handoff-worklist-prompt-003",
          "What should I prioritize first from this handoff worklist?",
          "workspace",
          resources.errorMessage,
        ),
      ],
    };
  }

  const needsReview = items.filter((item) => item.status === "needs_review");
  const priorityItem =
    [...items].sort((left, right) => {
      const leftScore = left.openDisagreements * 10 + left.missingInfoCount;
      const rightScore = right.openDisagreements * 10 + right.missingInfoCount;
      return rightScore - leftScore;
    })[0] ?? items[0];
  const worklistRefs = worklistCitationRefs(items);

  return {
    id: "handoff-worklist",
    promptGroup: "Handoff worklist prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "Handoff worklist",
      description:
        "Workspace-level guidance for which shift handoffs need attention, grounded in the live worklist.",
    },
    defaultPromptId: "handoff-worklist-prompt-001",
    prompts: [
      {
        id: "handoff-worklist-prompt-001",
        label: "What changed in the last 24 hours?",
        prompt: "What changed in the handoff worklist in the last 24 hours?",
        mode: "quick_answer",
        scope: "workspace",
      },
      {
        id: "handoff-worklist-prompt-002",
        label: "Which handoffs need review?",
        prompt: "Which handoffs need review right now?",
        mode: "workspace_research",
        scope: "workspace",
      },
      {
        id: "handoff-worklist-prompt-003",
        label: "What should I prioritize first?",
        prompt: "What should I prioritize first from this handoff worklist?",
        mode: "workspace_research",
        scope: "workspace",
      },
    ],
    responses: [
      {
        id: "handoff-worklist-response-001",
        promptId: "handoff-worklist-prompt-001",
        userQuestion: "What changed in the handoff worklist in the last 24 hours?",
        scope: "workspace",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Worklist-backed answer",
        summary: `${items.length} live handoffs are on the board, with ${needsReview.length} marked needs review and ${items.reduce((count, item) => count + item.openDisagreements, 0)} open disagreement flags across the worklist.`,
        bullets: items.slice(0, 3).map(
          (item) =>
            `${item.patientName}: ${item.headline} ${item.openDisagreements > 0 ? `(${item.openDisagreements} disagreement flags)` : "(no active disagreement flags)"}`,
        ),
        supportingTable: {
          title: "Current handoff worklist",
          columns: ["Patient", "Status", "Flags"],
          rows: items.slice(0, 4).map((item) => [
            item.patientName,
            item.status.replace("_", " "),
            `${item.openDisagreements} disagreements / ${item.missingInfoCount} missing`,
          ]),
        },
        citations: worklistRefs,
        howDerived:
          "Summarized the live handoff worklist counts, status labels, disagreement totals, and next-action text already rendered in the workspace.",
        recommendedNextAction: priorityItem
          ? `Start with ${priorityItem.patientName}: ${priorityItem.nextAction}`
          : "Open the first handoff record once the worklist is populated.",
      },
      {
        id: "handoff-worklist-response-002",
        promptId: "handoff-worklist-prompt-002",
        userQuestion: "Which handoffs need review right now?",
        scope: "workspace",
        mode: "workspace_research",
        groundingStatus: "grounded",
        trustBadge: "Review-queue answer",
        summary:
          needsReview.length > 0
            ? `${needsReview.length} handoffs are currently marked needs review. ${needsReview[0]?.patientName} is the most urgent visible case based on disagreement density and follow-up burden.`
            : "No handoffs are currently marked needs review in the live worklist.",
        bullets:
          needsReview.length > 0
            ? needsReview.slice(0, 4).map(
                (item) =>
                  `${item.patientName}: ${item.openDisagreements} disagreements, ${item.missingInfoCount} missing items, next step is ${item.nextAction}`,
              )
            : ["All visible handoffs are currently marked completed."],
        citations: worklistRefs.filter((citation) => citation.tone === "warning"),
        howDerived:
          "Filtered the live worklist by its current status flag and read the open-disagreement and missing-information counts per row.",
        recommendedNextAction:
          needsReview[0]?.nextAction ??
          "Keep monitoring the worklist and regenerate if new source documentation lands.",
      },
      {
        id: "handoff-worklist-response-003",
        promptId: "handoff-worklist-prompt-003",
        userQuestion: "What should I prioritize first from this handoff worklist?",
        scope: "workspace",
        mode: "workspace_research",
        groundingStatus: "grounded",
        trustBadge: "Priority-ranked answer",
        summary: priorityItem
          ? `${priorityItem.patientName} is the highest-value first stop because the case combines the densest disagreement burden with an explicit next action.`
          : "No live worklist item is available to prioritize yet.",
        bullets: priorityItem
          ? [
              `${priorityItem.openDisagreements} disagreement flags remain unresolved.`,
              `${priorityItem.missingInfoCount} missing-information markers are still open.`,
              `Current next action: ${priorityItem.nextAction}`,
            ]
          : undefined,
        citations: priorityItem
          ? worklistRefs.filter((citation) => citation.id === `worklist-${priorityItem.handoffId}`)
          : [],
        howDerived:
          "Ranked the visible handoff rows by disagreement burden, missing-information count, and the current next-action guidance.",
        recommendedNextAction:
          priorityItem?.nextAction ?? "Open the worklist once at least one handoff record is available.",
      },
    ],
  };
}

function buildCaseSession(
  context: WidgetPageContext,
  resources: HandoffAssistantResources,
): AssistantSession {
  const record = resources.record;

  if (resources.isLoading && !record) {
    return {
      id: context.sessionId,
      promptGroup: "Case-scoped handoff prompts",
      context: {
        title: "Ask Agent",
        scopeLabel: "This handoff case",
        description: "Case-scoped SBAR reasoning is loading for the selected handoff.",
        handoffId: context.handoffId,
      },
      defaultPromptId: "handoff-case-prompt-001",
      prompts: [
        {
          id: "handoff-case-prompt-001",
          label: "What changed in the last 24 hours?",
          prompt: "What changed in the last 24 hours for this handoff case?",
          mode: "quick_answer",
          scope: "this_patient",
        },
        {
          id: "handoff-case-prompt-002",
          label: "Why is this recommendation included?",
          prompt: "Why is this recommendation included in the SBAR?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
        {
          id: "handoff-case-prompt-003",
          label: "What are the active disagreements?",
          prompt: "What are the active disagreements in this handoff?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
        {
          id: "handoff-case-prompt-004",
          label: "Show supporting sources",
          prompt: "Show the supporting sources for this handoff summary.",
          mode: "case_reasoning",
          scope: "this_patient",
        },
      ],
      responses: [
        loadingResponse(
          "handoff-case-response-001",
          "handoff-case-prompt-001",
          "What changed in the last 24 hours for this handoff case?",
          "this_patient",
          "The live handoff case is still loading, so I do not yet have SBAR bullets or citations for this patient.",
        ),
        loadingResponse(
          "handoff-case-response-002",
          "handoff-case-prompt-002",
          "Why is this recommendation included in the SBAR?",
          "this_patient",
          "I can explain the recommendation once the current SBAR summary and provenance finish loading.",
        ),
        loadingResponse(
          "handoff-case-response-003",
          "handoff-case-prompt-003",
          "What are the active disagreements in this handoff?",
          "this_patient",
          "I need the live disagreement bundle before I can explain which services still conflict.",
        ),
        loadingResponse(
          "handoff-case-response-004",
          "handoff-case-prompt-004",
          "Show the supporting sources for this handoff summary.",
          "this_patient",
          "I need the current provenance list before I can show document-backed sources for this handoff.",
        ),
      ],
    };
  }

  if (!record) {
    return {
      id: context.sessionId,
      promptGroup: "Case-scoped handoff prompts",
      context: {
        title: "Ask Agent",
        scopeLabel: "This handoff case",
        description: "Case-scoped SBAR reasoning for the selected handoff.",
        handoffId: context.handoffId,
      },
      defaultPromptId: "handoff-case-prompt-001",
      prompts: [
        {
          id: "handoff-case-prompt-001",
          label: "What changed in the last 24 hours?",
          prompt: "What changed in the last 24 hours for this handoff case?",
          mode: "quick_answer",
          scope: "this_patient",
        },
        {
          id: "handoff-case-prompt-002",
          label: "Why is this recommendation included?",
          prompt: "Why is this recommendation included in the SBAR?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
        {
          id: "handoff-case-prompt-003",
          label: "What are the active disagreements?",
          prompt: "What are the active disagreements in this handoff?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
        {
          id: "handoff-case-prompt-004",
          label: "Show supporting sources",
          prompt: "Show the supporting sources for this handoff summary.",
          mode: "case_reasoning",
          scope: "this_patient",
        },
      ],
      responses: [
        unavailableResponse(
          "handoff-case-response-001",
          "handoff-case-prompt-001",
          "What changed in the last 24 hours for this handoff case?",
          "this_patient",
          resources.errorMessage,
        ),
        unavailableResponse(
          "handoff-case-response-002",
          "handoff-case-prompt-002",
          "Why is this recommendation included in the SBAR?",
          "this_patient",
          resources.errorMessage,
        ),
        unavailableResponse(
          "handoff-case-response-003",
          "handoff-case-prompt-003",
          "What are the active disagreements in this handoff?",
          "this_patient",
          resources.errorMessage,
        ),
        unavailableResponse(
          "handoff-case-response-004",
          "handoff-case-prompt-004",
          "Show the supporting sources for this handoff summary.",
          "this_patient",
          resources.errorMessage,
        ),
      ],
    };
  }

  const situationCitations = citationsForBulletIds(record, record.summary.situation);
  const recommendationCitations = citationsForBulletIds(record, record.summary.recommendations);
  const disagreementCitations = citationsForIds(
    record,
    record.summary.disagreements.flatMap((item) => item.evidenceRefs),
  );
  const sourceCitations = record.summary.citations;
  const documents = resources.documents ?? record.documents;
  const disagreementBullets =
    record.summary.disagreements.length > 0
      ? record.summary.disagreements.flatMap((item) =>
          item.positions.map(
            (position) =>
              `${position.service}: ${position.assertion} (${position.certainty} certainty, ${new Date(position.authoredAt).toLocaleString()})`,
          ),
        )
      : ["No unresolved service-level disagreements are visible in the current summary."];

  return {
    id: context.sessionId,
    promptGroup: "Case-scoped handoff prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "This handoff case",
      description:
        "Case-scoped SBAR reasoning for the selected inpatient handoff, grounded in the current summary and provenance.",
      patientId: record.patientId,
      handoffId: record.id,
      encounterId: record.encounterId,
      windowHours: record.windowHours,
    },
    defaultPromptId: "handoff-case-prompt-001",
    prompts: [
      {
        id: "handoff-case-prompt-001",
        label: "What changed in the last 24 hours?",
        prompt: "What changed in the last 24 hours for this handoff case?",
        mode: "quick_answer",
        scope: "this_patient",
      },
      {
        id: "handoff-case-prompt-002",
        label: "Why is this recommendation included?",
        prompt: "Why is this recommendation included in the SBAR?",
        mode: "case_reasoning",
        scope: "this_patient",
      },
      {
        id: "handoff-case-prompt-003",
        label: "What are the active disagreements?",
        prompt: "What are the active disagreements in this handoff?",
        mode: "case_reasoning",
        scope: "this_patient",
      },
      {
        id: "handoff-case-prompt-004",
        label: "Show supporting sources",
        prompt: "Show the supporting sources for this handoff summary.",
        mode: "case_reasoning",
        scope: "this_patient",
      },
    ],
    responses: [
      {
        id: "handoff-case-response-001",
        promptId: "handoff-case-prompt-001",
        userQuestion: "What changed in the last 24 hours for this handoff case?",
        scope: "this_patient",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Live SBAR answer",
        summary:
          record.summary.situation[0]?.text ??
          "No immediate situation bullet was generated in the current SBAR window.",
        bullets: record.summary.situation.map((bullet) => bullet.text),
        citations: situationCitations.map(toCitationRef),
        howDerived:
          "Read the live Situation section from the current SBAR summary and pulled its sentence-level provenance.",
        recommendedNextAction: record.nextAction,
      },
      {
        id: "handoff-case-response-002",
        promptId: "handoff-case-prompt-002",
        userQuestion: "Why is this recommendation included in the SBAR?",
        scope: "this_patient",
        mode: "case_reasoning",
        groundingStatus: "grounded",
        trustBadge: "Recommendation trace",
        summary:
          record.summary.recommendations[0]?.text ??
          "No recommendation bullet is present in the current SBAR.",
        bullets: [
          ...record.summary.recommendations.map((bullet) => bullet.text),
          ...(record.summary.disagreements.length > 0
            ? ["Unresolved service disagreement remains visible in the current assessment bundle."]
            : []),
          ...(record.summary.missingInfo.length > 0
            ? [`Missing information still open: ${record.summary.missingInfo[0]}`]
            : []),
        ],
        citations: recommendationCitations.map(toCitationRef),
        howDerived:
          "Explained the current Recommendation section using its attached citations, then checked the disagreement and missing-information panels for unresolved blockers.",
        recommendedNextAction: record.nextAction,
      },
      {
        id: "handoff-case-response-003",
        promptId: "handoff-case-prompt-003",
        userQuestion: "What are the active disagreements in this handoff?",
        scope: "this_patient",
        mode: "case_reasoning",
        groundingStatus: record.summary.disagreements.length > 0 ? "grounded" : "partial",
        trustBadge: "Conflict-aware answer",
        summary:
          record.summary.disagreements.length > 0
            ? `${record.summary.disagreements.length} unresolved disagreement topics remain visible in this handoff. ${record.summary.disagreements[0]?.summary}`
            : "No unresolved service-level disagreement is currently attached to this handoff.",
        bullets: disagreementBullets,
        citations:
          disagreementCitations.length > 0
            ? disagreementCitations.map(toWarningCitationRef)
            : allCitationRefs(record).slice(0, 2),
        howDerived:
          "Read the live disagreement bundle and preserved each service position instead of collapsing them into a single consensus answer.",
        recommendedNextAction:
          record.summary.disagreements.length > 0
            ? "Keep the disagreement visible during sign-out and verify whether a later note or addendum resolves it."
            : record.nextAction,
      },
      {
        id: "handoff-case-response-004",
        promptId: "handoff-case-prompt-004",
        userQuestion: "Show the supporting sources for this handoff summary.",
        scope: "this_patient",
        mode: "case_reasoning",
        groundingStatus: sourceCitations.length > 0 ? "grounded" : "partial",
        trustBadge: "Provenance-backed answer",
        summary: `This handoff is backed by ${sourceCitations.length} cited excerpts across ${documents.length} source documents in the current ${record.windowHours}-hour window.`,
        supportingTable: tableForCitations("Supporting sources", sourceCitations),
        citations: sourceCitations.map(toCitationRef),
        howDerived:
          "Pulled the cited evidence excerpts and document metadata from the live provenance panel and document feed.",
        recommendedNextAction:
          "Open the provenance cards if you need the exact evidence excerpt behind any SBAR sentence.",
      },
    ],
  };
}

function buildAuditSession(
  context: WidgetPageContext,
  resources: HandoffAssistantResources,
): AssistantSession {
  const record = resources.record;
  const audit = resources.audit;

  if (resources.isLoading && (!record || !audit)) {
    return {
      id: context.sessionId,
      promptGroup: "Audit-scoped handoff prompts",
      context: {
        title: "Ask Agent",
        scopeLabel: "This handoff audit",
        description: "Audit trace reasoning is loading for the selected handoff.",
        handoffId: context.handoffId,
      },
      defaultPromptId: "handoff-audit-prompt-001",
      prompts: [
        {
          id: "handoff-audit-prompt-001",
          label: "What happened in this pipeline run?",
          prompt: "What happened in this handoff pipeline run?",
          mode: "quick_answer",
          scope: "this_patient",
        },
        {
          id: "handoff-audit-prompt-002",
          label: "Why does this case need review?",
          prompt: "Why does this handoff case need review?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
        {
          id: "handoff-audit-prompt-003",
          label: "Which sources back the summary?",
          prompt: "Which sources back the current handoff summary?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
      ],
      responses: [
        loadingResponse(
          "handoff-audit-response-001",
          "handoff-audit-prompt-001",
          "What happened in this handoff pipeline run?",
          "this_patient",
          "The audit trace is still loading, so I cannot yet summarize the pipeline stages for this handoff.",
        ),
        loadingResponse(
          "handoff-audit-response-002",
          "handoff-audit-prompt-002",
          "Why does this handoff case need review?",
          "this_patient",
          "I need the live handoff status and disagreement bundle before I can explain whether review is still required.",
        ),
        loadingResponse(
          "handoff-audit-response-003",
          "handoff-audit-prompt-003",
          "Which sources back the current handoff summary?",
          "this_patient",
          "I need the current citations list before I can show source-backed provenance for this handoff.",
        ),
      ],
    };
  }

  if (!record || !audit) {
    return {
      id: context.sessionId,
      promptGroup: "Audit-scoped handoff prompts",
      context: {
        title: "Ask Agent",
        scopeLabel: "This handoff audit",
        description: "Audit trace reasoning for the selected handoff.",
        handoffId: context.handoffId,
      },
      defaultPromptId: "handoff-audit-prompt-001",
      prompts: [
        {
          id: "handoff-audit-prompt-001",
          label: "What happened in this pipeline run?",
          prompt: "What happened in this handoff pipeline run?",
          mode: "quick_answer",
          scope: "this_patient",
        },
        {
          id: "handoff-audit-prompt-002",
          label: "Why does this case need review?",
          prompt: "Why does this handoff case need review?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
        {
          id: "handoff-audit-prompt-003",
          label: "Which sources back the summary?",
          prompt: "Which sources back the current handoff summary?",
          mode: "case_reasoning",
          scope: "this_patient",
        },
      ],
      responses: [
        unavailableResponse(
          "handoff-audit-response-001",
          "handoff-audit-prompt-001",
          "What happened in this handoff pipeline run?",
          "this_patient",
          resources.errorMessage,
        ),
        unavailableResponse(
          "handoff-audit-response-002",
          "handoff-audit-prompt-002",
          "Why does this handoff case need review?",
          "this_patient",
          resources.errorMessage,
        ),
        unavailableResponse(
          "handoff-audit-response-003",
          "handoff-audit-prompt-003",
          "Which sources back the current handoff summary?",
          "this_patient",
          resources.errorMessage,
        ),
      ],
    };
  }

  const auditRefs = auditCitationRefs(audit);
  const sourceCitations = record.summary.citations;
  const disagreementCitations = citationsForIds(
    record,
    record.summary.disagreements.flatMap((item) => item.evidenceRefs),
  );

  return {
    id: context.sessionId,
    promptGroup: "Audit-scoped handoff prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "This handoff audit",
      description:
        "Explain the stored pipeline trace and source provenance for the selected handoff run.",
      patientId: record.patientId,
      handoffId: record.id,
      encounterId: record.encounterId,
      windowHours: record.windowHours,
    },
    defaultPromptId: "handoff-audit-prompt-001",
    prompts: [
      {
        id: "handoff-audit-prompt-001",
        label: "What happened in this pipeline run?",
        prompt: "What happened in this handoff pipeline run?",
        mode: "quick_answer",
        scope: "this_patient",
      },
      {
        id: "handoff-audit-prompt-002",
        label: "Why does this case need review?",
        prompt: "Why does this handoff case need review?",
        mode: "case_reasoning",
        scope: "this_patient",
      },
      {
        id: "handoff-audit-prompt-003",
        label: "Which sources back the summary?",
        prompt: "Which sources back the current handoff summary?",
        mode: "case_reasoning",
        scope: "this_patient",
      },
    ],
    responses: [
      {
        id: "handoff-audit-response-001",
        promptId: "handoff-audit-prompt-001",
        userQuestion: "What happened in this handoff pipeline run?",
        scope: "this_patient",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Pipeline-trace answer",
        summary: `${audit.audit.length} pipeline events ran for this handoff, from ${audit.audit[0]?.stage.replace(/_/g, " ") ?? "ingestion"} through ${audit.audit[audit.audit.length - 1]?.stage.replace(/_/g, " ") ?? "persistence"}.`,
        bullets: audit.audit.map(
          (event) => `${event.stage.replace(/_/g, " ")}: ${event.summary}`,
        ),
        citations: auditRefs,
        howDerived:
          "Summarized the stored audit events in their recorded order and kept the explanation read-only.",
        recommendedNextAction: record.nextAction,
      },
      {
        id: "handoff-audit-response-002",
        promptId: "handoff-audit-prompt-002",
        userQuestion: "Why does this handoff case need review?",
        scope: "this_patient",
        mode: "case_reasoning",
        groundingStatus: record.summary.status === "needs_review" ? "grounded" : "partial",
        trustBadge: "Review-state explanation",
        summary:
          record.summary.status === "needs_review"
            ? `This handoff still needs review because ${record.summary.disagreements.length} disagreement topics and ${record.summary.missingInfo.length} missing-information markers remain unresolved.`
            : "This handoff is currently marked completed, with no remaining review blocker in the stored summary status.",
        bullets:
          record.summary.status === "needs_review"
            ? [
                ...record.summary.disagreements.map((item) => item.summary),
                ...record.summary.missingInfo.map((item) => `Missing information: ${item}`),
              ]
            : ["No active review blocker is recorded in the current status field."],
        citations:
          disagreementCitations.length > 0
            ? disagreementCitations.map(toWarningCitationRef)
            : auditRefs.slice(0, 2),
        howDerived:
          "Read the stored summary status, disagreement bundle, and missing-information markers from the current handoff record.",
        recommendedNextAction:
          record.summary.status === "needs_review"
            ? "Use the disagreement and provenance panels to confirm whether a later note resolves the remaining conflict."
            : record.nextAction,
      },
      {
        id: "handoff-audit-response-003",
        promptId: "handoff-audit-prompt-003",
        userQuestion: "Which sources back the current handoff summary?",
        scope: "this_patient",
        mode: "case_reasoning",
        groundingStatus: sourceCitations.length > 0 ? "grounded" : "partial",
        trustBadge: "Source-backed provenance",
        summary: `The current handoff summary cites ${sourceCitations.length} evidence excerpts, each stored alongside the audit trail for traceability.`,
        supportingTable: tableForCitations("Summary provenance", sourceCitations),
        citations: sourceCitations.map(toCitationRef),
        howDerived:
          "Pulled the stored citation list attached to this handoff record and presented it alongside the audit trace.",
        recommendedNextAction:
          "Use the provenance panel when you need the exact evidence excerpt behind a summary sentence.",
      },
    ],
  };
}

export function buildHandoffAssistantSession(
  context: WidgetPageContext,
  resources: HandoffAssistantResources,
): AssistantSession {
  switch (context.routeKind) {
    case "handoff_worklist":
      return buildWorklistSession(resources);
    case "handoff_case":
      return buildCaseSession(context, resources);
    case "handoff_audit":
      return buildAuditSession(context, resources);
    default:
      throw new Error(`Unsupported handoff route kind: ${context.routeKind}`);
  }
}

export function buildHandoffAgentSnippets(
  context: WidgetPageContext,
  resources: HandoffAssistantResources,
): AgentContextSnippet[] {
  switch (context.routeKind) {
    case "handoff_worklist":
      return (resources.worklistItems ?? []).slice(0, 8).map((item) => ({
        evidenceId: `worklist-${item.handoffId}`,
        label: `${item.patientName} | ${item.status.replace("_", " ")} | ${new Date(item.generatedAt).toLocaleDateString()}`,
        content: `${item.headline}. ${item.nextAction}. Open disagreements: ${item.openDisagreements}. Missing information markers: ${item.missingInfoCount}.`,
      }));
    case "handoff_case":
      if (!resources.record) return [];
      return [
        ...resources.record.summary.citations.map((citation) => ({
          evidenceId: citation.id,
          label: `${citation.documentTitle} | ${citation.service} | ${new Date(citation.authoredAt).toLocaleDateString()}`,
          content: citation.quotedEvidence,
        })),
        ...resources.record.summary.disagreements.map((item) => ({
          evidenceId: `disagreement-${item.id}`,
          label: `${item.topic} disagreement`,
          content: `${item.summary} ${item.positions
            .map((position) => `${position.service} says ${position.assertion}`)
            .join(" ")}`,
        })),
      ].slice(0, 8);
    case "handoff_audit":
      return [
        ...(resources.audit?.audit ?? []).map((event) => ({
          evidenceId: `audit-${event.id}`,
          label: `${event.stage.replace(/_/g, " ")} | ${new Date(event.createdAt).toLocaleDateString()}`,
          content: `${event.summary} ${event.detail}`,
        })),
        ...(resources.record?.summary.citations ?? []).slice(0, 3).map((citation) => ({
          evidenceId: citation.id,
          label: `${citation.documentTitle} | ${citation.service}`,
          content: citation.quotedEvidence,
        })),
      ].slice(0, 8);
    default:
      return [];
  }
}
