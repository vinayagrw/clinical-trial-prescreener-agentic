import { createHash } from "node:crypto";
import { REFERENCE_NOW } from "./demoData.ts";
import type {
  Citation,
  ClinicalDocument,
  ClinicalFact,
  FactCertainty,
  FactPolarity,
  SeedDocument,
  WindowHours,
} from "./types.ts";

interface StructuredLab {
  name: string;
  value: string;
  numericValue?: number;
  unit?: string;
}

interface StructuredVitals {
  [key: string]: string | number | undefined;
}

interface StructuredPayload {
  labs?: StructuredLab[];
  tasks?: string[];
  impression?: string;
  vitals?: StructuredVitals;
}

interface NarrativePattern {
  topic: string;
  pattern: RegExp;
  assertion: string;
  polarity: FactPolarity;
  certainty: FactCertainty;
}

const narrativePatterns: NarrativePattern[] = [
  {
    topic: "disposition readiness",
    pattern: /stable for discharge[^.]*/i,
    assertion: "stable for discharge",
    polarity: "present",
    certainty: "medium",
  },
  {
    topic: "disposition readiness",
    pattern: /needs further [a-z ]*workup[^.]*/i,
    assertion: "needs further workup before discharge",
    polarity: "present",
    certainty: "high",
  },
  {
    topic: "active bleeding",
    pattern: /melena[^.]*/i,
    assertion: "ongoing melena",
    polarity: "present",
    certainty: "high",
  },
  {
    topic: "active bleeding",
    pattern: /no active contrast extravasation[^.]*/i,
    assertion: "no active bleed on imaging",
    polarity: "absent",
    certainty: "high",
  },
  {
    topic: "hemodynamics",
    pattern: /off vasopressors[^.]*/i,
    assertion: "off vasopressors",
    polarity: "present",
    certainty: "high",
  },
  {
    topic: "infection trajectory",
    pattern: /blood cultures negative[^.]*/i,
    assertion: "blood cultures negative at 48 hours",
    polarity: "present",
    certainty: "high",
  },
  {
    topic: "neurologic status",
    pattern: /not at cognitive baseline[^.]*/i,
    assertion: "not at cognitive baseline",
    polarity: "present",
    certainty: "high",
  },
  {
    topic: "neurologic status",
    pattern: /may discharge home[^.]*/i,
    assertion: "may discharge home if family confirms baseline",
    polarity: "present",
    certainty: "medium",
  },
  {
    topic: "fall risk",
    pattern: /fall risk[^.]*/i,
    assertion: "fall risk remains active",
    polarity: "present",
    certainty: "medium",
  },
  {
    topic: "delirium",
    pattern: /intermittent confusion[^.]*/i,
    assertion: "intermittent confusion overnight",
    polarity: "present",
    certainty: "high",
  },
];

const referenceNowMs = Date.parse(REFERENCE_NOW);

function structuredPayloadOf(document: SeedDocument): StructuredPayload {
  return (document.structuredPayload ?? {}) as StructuredPayload;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function extractSentence(rawText: string, fragment: string): string {
  const exactIndex = rawText.toLowerCase().indexOf(fragment.toLowerCase());
  if (exactIndex === -1) return fragment.trim();

  const left = rawText.lastIndexOf(".", exactIndex);
  const right = rawText.indexOf(".", exactIndex + fragment.length);
  const start = left === -1 ? 0 : left + 1;
  const end = right === -1 ? rawText.length : right + 1;
  return rawText.slice(start, end).trim();
}

function factId(documentId: string, topic: string, index: number): string {
  return `fact-${documentId}-${topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${index}`;
}

function hashDocument(document: SeedDocument): ClinicalDocument {
  return {
    ...document,
    hash: sha256(
      JSON.stringify({
        sourceId: document.sourceId,
        authoredAt: document.authoredAt,
        amendedAt: document.amendedAt ?? null,
        rawText: document.rawText,
        structuredPayload: document.structuredPayload ?? null,
      }),
    ),
  };
}

function withinWindow(authoredAt: string, windowHours: WindowHours): boolean {
  const ageHours = (referenceNowMs - Date.parse(authoredAt)) / (1000 * 60 * 60);
  return ageHours >= 0 && ageHours <= windowHours;
}

function sortNewest<T extends { authoredAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => Date.parse(right.authoredAt) - Date.parse(left.authoredAt));
}

function extractDeterministicFacts(document: ClinicalDocument): ClinicalFact[] {
  const payload = structuredPayloadOf(document);
  const facts: ClinicalFact[] = [];
  let index = 0;

  for (const lab of payload.labs ?? []) {
    facts.push({
      id: factId(document.id, lab.name, index++),
      patientId: document.patientId,
      encounterId: document.encounterId,
      topic: lab.name.toLowerCase(),
      assertion: `${lab.name} ${lab.value}`,
      polarity: "present",
      certainty: "high",
      value: lab.value,
      sourceDocId: document.id,
      quotedEvidence: extractSentence(document.rawText, lab.value),
      authoredAt: document.authoredAt,
      service: document.service,
      extractor: "deterministic",
    });
  }

  for (const task of payload.tasks ?? []) {
    facts.push({
      id: factId(document.id, "recommended next step", index++),
      patientId: document.patientId,
      encounterId: document.encounterId,
      topic: "recommended next step",
      assertion: task,
      polarity: "present",
      certainty: "high",
      sourceDocId: document.id,
      quotedEvidence: extractSentence(document.rawText, task),
      authoredAt: document.authoredAt,
      service: document.service,
      extractor: "deterministic",
    });
  }

  if (payload.impression) {
    const quotedEvidence = document.rawText.includes(payload.impression)
      ? payload.impression
      : extractSentence(document.rawText, "Impression");
    facts.push({
      id: factId(document.id, "imaging impression", index++),
      patientId: document.patientId,
      encounterId: document.encounterId,
      topic: "imaging impression",
      assertion: payload.impression,
      polarity: "present",
      certainty: "high",
      sourceDocId: document.id,
      quotedEvidence,
      authoredAt: document.authoredAt,
      service: document.service,
      extractor: "deterministic",
    });
  }

  if (payload.vitals) {
    for (const [key, value] of Object.entries(payload.vitals)) {
      if (value === undefined) continue;
      const valueText = typeof value === "number" ? `${value}` : value;
      facts.push({
        id: factId(document.id, key, index++),
        patientId: document.patientId,
        encounterId: document.encounterId,
        topic: key.toLowerCase(),
        assertion: `${key} ${valueText}`,
        polarity: "present",
        certainty: "high",
        value: valueText,
        sourceDocId: document.id,
        quotedEvidence: extractSentence(document.rawText, valueText),
        authoredAt: document.authoredAt,
        service: document.service,
        extractor: "deterministic",
      });
    }
  }

  return facts;
}

function extractNarrativeFacts(document: ClinicalDocument): ClinicalFact[] {
  const facts: ClinicalFact[] = [];
  let index = 0;

  for (const pattern of narrativePatterns) {
    const match = document.rawText.match(pattern.pattern);
    if (!match) continue;

    facts.push({
      id: factId(document.id, pattern.topic, index++),
      patientId: document.patientId,
      encounterId: document.encounterId,
      topic: pattern.topic,
      assertion: pattern.assertion,
      polarity: pattern.polarity,
      certainty: pattern.certainty,
      sourceDocId: document.id,
      quotedEvidence: match[0].trim(),
      authoredAt: document.authoredAt,
      service: document.service,
      extractor: "heuristic",
    });
  }

  return facts;
}

export function toWindowHours(value: number | undefined): WindowHours {
  if (value === 24 || value === 48 || value === 72) return value;
  return 72;
}

export function ingestDocuments(
  documents: SeedDocument[],
  windowHours: WindowHours,
): ClinicalDocument[] {
  return sortNewest(
    documents.filter((document) => withinWindow(document.authoredAt, windowHours)).map(hashDocument),
  );
}

export function extractFacts(documents: ClinicalDocument[]): {
  deterministicFacts: ClinicalFact[];
  heuristicFacts: ClinicalFact[];
  facts: ClinicalFact[];
} {
  const deterministicFacts = documents.flatMap(extractDeterministicFacts);
  const heuristicFacts = documents.flatMap(extractNarrativeFacts);
  const facts = sortNewest([...deterministicFacts, ...heuristicFacts]);
  return {
    deterministicFacts,
    heuristicFacts,
    facts,
  };
}

export function buildCitations(
  facts: ClinicalFact[],
  documents: ClinicalDocument[],
): Citation[] {
  const documentMap = new Map(documents.map((item) => [item.id, item]));
  return facts.map((fact) => {
    const document = documentMap.get(fact.sourceDocId);
    if (!document) {
      throw new Error(`Missing document for fact ${fact.id}.`);
    }

    return {
      id: `citation-${fact.id}`,
      factId: fact.id,
      documentId: document.id,
      documentTitle: document.title,
      service: fact.service,
      authoredAt: fact.authoredAt,
      quotedEvidence: fact.quotedEvidence,
    };
  });
}

export function detectMissingInfo(
  encounterId: string,
  documents: ClinicalDocument[],
): string[] {
  const docTypes = new Set(documents.map((item) => item.docType));
  const missing: string[] = [];

  if (!docTypes.has("nursing_assessment")) {
    missing.push("No nursing assessment is available in the selected window.");
  }
  if (!docTypes.has("lab_result")) {
    missing.push("No structured lab result is available in the selected window.");
  }
  if (!docTypes.has("imaging_report")) {
    missing.push("No imaging report is available in the selected window.");
  }

  const pendingTask = documents.some((document) =>
    document.rawText.toLowerCase().includes("pending"),
  );
  if (pendingTask) {
    missing.push("At least one ordered follow-up is still pending documentation.");
  }

  if (encounterId === "enc-1003") {
    missing.push("PT and OT evaluation is ordered but not yet posted in the handoff window.");
  }

  return [...new Set(missing)];
}
