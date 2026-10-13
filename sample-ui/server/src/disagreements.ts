import type {
  Citation,
  ClinicalFact,
  Disagreement,
  DisagreementPosition,
  DisagreementSeverity,
} from "./types.ts";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sortNewest<T extends { authoredAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => Date.parse(right.authoredAt) - Date.parse(left.authoredAt));
}

function severityForTopic(topic: string): DisagreementSeverity {
  if (topic === "disposition readiness" || topic === "active bleeding") return "critical";
  if (topic === "neurologic status") return "high";
  return "moderate";
}

function buildDisagreementSummary(topic: string, positions: DisagreementPosition[]): string {
  const phrase = positions
    .map((position) => `${position.service} says "${position.assertion}"`)
    .join("; ");
  return `${topic} remains unresolved: ${phrase}.`;
}

export function detectDisagreements(
  facts: ClinicalFact[],
  citations: Citation[],
): Disagreement[] {
  const citationByFactId = new Map(citations.map((item) => [item.factId, item.id]));
  const grouped = new Map<string, ClinicalFact[]>();

  for (const fact of facts) {
    const current = grouped.get(fact.topic) ?? [];
    current.push(fact);
    grouped.set(fact.topic, current);
  }

  const disagreements: Array<Disagreement & { authoredAt: string }> = [];

  for (const [topic, topicFacts] of grouped) {
    const serviceMap = new Map<string, ClinicalFact[]>();
    for (const fact of topicFacts) {
      const current = serviceMap.get(fact.service) ?? [];
      current.push(fact);
      serviceMap.set(fact.service, current);
    }

    if (serviceMap.size < 2) continue;

    const latestPerService = [...serviceMap.values()].map((serviceFacts) => {
      return sortNewest(serviceFacts)[0] ?? serviceFacts[0]!;
    });

    const uniqueAssertions = unique(
      latestPerService.map((fact) => `${fact.polarity}:${fact.assertion.toLowerCase()}`),
    );

    if (uniqueAssertions.length < 2) continue;

    const positions: DisagreementPosition[] = sortNewest(latestPerService).map((fact) => ({
      service: fact.service,
      assertion: fact.assertion,
      certainty: fact.certainty,
      authoredAt: fact.authoredAt,
      citationIds: [citationByFactId.get(fact.id) ?? `citation-${fact.id}`],
    }));

    disagreements.push({
      id: `disagreement-${topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      topic,
      severity: severityForTopic(topic),
      summary: buildDisagreementSummary(topic, positions),
      services: positions.map((item) => item.service),
      positions,
      evidenceRefs: positions.flatMap((item) => item.citationIds),
      recencyOrder: positions.map((item) => item.service),
      requiresHumanReview: true,
      authoredAt: positions[0]?.authoredAt ?? new Date().toISOString(),
    });
  }

  return sortNewest(disagreements).map(({ authoredAt: _authoredAt, ...item }) => item);
}
