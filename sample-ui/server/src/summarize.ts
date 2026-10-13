import type {
  Citation,
  ClinicalDocument,
  ClinicalFact,
  Disagreement,
  HandoffRecord,
  SbarBullet,
  SeedEncounter,
  WindowHours,
} from "./types.ts";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sortNewest<T extends { authoredAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => Date.parse(right.authoredAt) - Date.parse(left.authoredAt));
}

function clip(value: string, max = 220): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

function findLatestFact(facts: ClinicalFact[], topic: string): ClinicalFact | undefined {
  return sortNewest(facts.filter((fact) => fact.topic === topic))[0];
}

function findTopicFacts(facts: ClinicalFact[], topic: string): ClinicalFact[] {
  return sortNewest(facts.filter((fact) => fact.topic === topic));
}

function citationIdsForFacts(facts: ClinicalFact[]): string[] {
  return unique(facts.map((fact) => `citation-${fact.id}`));
}

function buildLabTrendBullet(
  topic: string,
  label: string,
  facts: ClinicalFact[],
): SbarBullet | null {
  const topicFacts = findTopicFacts(facts, topic);
  if (topicFacts.length < 2) return null;

  const latest = topicFacts[0];
  const previous = topicFacts[1];
  const latestValue = Number.parseFloat(latest.value ?? "");
  const previousValue = Number.parseFloat(previous.value ?? "");

  if (Number.isNaN(latestValue) || Number.isNaN(previousValue)) return null;

  const delta = latestValue - previousValue;
  const direction = delta < 0 ? "down" : "up";
  const deltaText = Math.abs(delta).toFixed(1);

  return {
    id: `bullet-${topic}-trend`,
    text: `${label} is ${direction} from ${previous.value} to ${latest.value} in the selected window (delta ${deltaText}).`,
    citationIds: citationIdsForFacts([latest, previous]),
  };
}

export function buildSummary(params: {
  encounter: SeedEncounter;
  windowHours: WindowHours;
  documents: ClinicalDocument[];
  facts: ClinicalFact[];
  citations: Citation[];
  disagreements: Disagreement[];
  missingInfo: string[];
}): HandoffRecord["summary"] {
  const { encounter, facts, citations, disagreements, missingInfo } = params;
  const situation: SbarBullet[] = [];
  const background: SbarBullet[] = [];
  const assessment: SbarBullet[] = [];
  const recommendations: SbarBullet[] = [];

  const dispositionDisagreement = disagreements.find(
    (item) => item.topic === "disposition readiness",
  );
  if (dispositionDisagreement) {
    situation.push({
      id: "bullet-situation-disposition",
      text: `Discharge readiness is unresolved: ${dispositionDisagreement.summary}`,
      citationIds: dispositionDisagreement.evidenceRefs,
    });
  }

  const activeBleedingFact = findLatestFact(facts, "active bleeding");
  if (activeBleedingFact) {
    situation.push({
      id: "bullet-situation-active-bleeding",
      text: `Recent bedside evidence still suggests ${activeBleedingFact.assertion}.`,
      citationIds: citationIdsForFacts([activeBleedingFact]),
    });
  }

  const neurologicDisagreement = disagreements.find(
    (item) => item.topic === "neurologic status",
  );
  if (neurologicDisagreement) {
    situation.push({
      id: "bullet-situation-neuro",
      text: `Cognitive baseline remains contested during sign-out: ${neurologicDisagreement.summary}`,
      citationIds: neurologicDisagreement.evidenceRefs,
    });
  }

  background.push({
    id: "bullet-background-admission",
    text: `${encounter.patientName} was admitted because ${encounter.admissionReason.toLowerCase()}`,
    citationIds:
      citations.length > 0
        ? [citations[citations.length - 1]!.id]
        : [],
  });

  const imagingFact = findLatestFact(facts, "imaging impression");
  if (imagingFact) {
    background.push({
      id: "bullet-background-imaging",
      text: `Latest imaging summary: ${imagingFact.assertion}`,
      citationIds: citationIdsForFacts([imagingFact]),
    });
  }

  const hemoglobinTrend = buildLabTrendBullet("hemoglobin", "Hemoglobin", facts);
  if (hemoglobinTrend) {
    assessment.push(hemoglobinTrend);
  }

  const sodiumFact = findLatestFact(facts, "sodium");
  if (sodiumFact) {
    assessment.push({
      id: "bullet-assessment-sodium",
      text: `Sodium remains ${sodiumFact.value}, which may contribute to ongoing confusion risk.`,
      citationIds: citationIdsForFacts([sodiumFact]),
    });
  }

  const lactateFact = findLatestFact(facts, "lactate");
  if (lactateFact) {
    assessment.push({
      id: "bullet-assessment-lactate",
      text: `Current lactate is ${lactateFact.value}, supporting improved perfusion.`,
      citationIds: citationIdsForFacts([lactateFact]),
    });
  }

  if (neurologicDisagreement) {
    assessment.push({
      id: "bullet-assessment-neuro-disagreement",
      text: "Neurologic baseline needs bedside reconciliation before a discharge plan is treated as settled.",
      citationIds: neurologicDisagreement.evidenceRefs,
    });
  }

  const recommendationFacts = findTopicFacts(facts, "recommended next step").slice(0, 3);
  for (const [index, fact] of recommendationFacts.entries()) {
    recommendations.push({
      id: `bullet-recommendation-${index + 1}`,
      text: fact.assertion,
      citationIds: citationIdsForFacts([fact]),
    });
  }

  if (disagreements.length > 0) {
    recommendations.unshift({
      id: "bullet-recommendation-reconcile",
      text: "Review open multi-service disagreements before signing out the plan as settled.",
      citationIds: disagreements.flatMap((item) => item.evidenceRefs),
    });
  }

  if (missingInfo.length > 0) {
    recommendations.push({
      id: "bullet-recommendation-missing",
      text: `Outstanding information gap: ${missingInfo[0]}`,
      citationIds: recommendations[recommendations.length - 1]?.citationIds ?? [],
    });
  }

  const status =
    disagreements.some((item) => item.severity !== "moderate") || missingInfo.length > 1
      ? "needs_review"
      : "completed";

  return {
    situation,
    background,
    assessment,
    recommendations,
    disagreements,
    missingInfo,
    citations,
    generatedAt: new Date().toISOString(),
    status,
  };
}

export function validateFaithfulness(
  summary: HandoffRecord["summary"],
  documents: ClinicalDocument[],
): void {
  const citationsById = new Map(summary.citations.map((item) => [item.id, item]));
  const documentById = new Map(documents.map((item) => [item.id, item]));
  const sections = [
    ...summary.situation,
    ...summary.background,
    ...summary.assessment,
    ...summary.recommendations,
  ];

  for (const bullet of sections) {
    if (bullet.citationIds.length === 0) {
      throw new Error(`Bullet ${bullet.id} is missing citations.`);
    }

    for (const citationId of bullet.citationIds) {
      const citation = citationsById.get(citationId);
      if (!citation) {
        throw new Error(`Bullet ${bullet.id} references unknown citation ${citationId}.`);
      }
      const document = documentById.get(citation.documentId);
      if (!document) {
        throw new Error(`Citation ${citation.id} references missing document ${citation.documentId}.`);
      }
      if (!document.rawText.includes(citation.quotedEvidence)) {
        throw new Error(
          `Citation ${citation.id} quote is not present verbatim in ${document.id}.`,
        );
      }
    }
  }
}

export function summarizeRecord(
  encounter: SeedEncounter,
  windowHours: WindowHours,
  summary: HandoffRecord["summary"],
): Pick<HandoffRecord, "id" | "headline" | "nextAction"> {
  const headline =
    summary.situation[0]?.text ??
    `Generated SBAR for ${encounter.patientName} with ${summary.disagreements.length} open disagreement(s).`;
  const nextAction =
    summary.recommendations[0]?.text ??
    "Open the case and review sentence-level provenance before sign-out.";

  return {
    id: `handoff-${encounter.encounterId}-${windowHours}`,
    headline: clip(headline),
    nextAction: clip(nextAction),
  };
}
