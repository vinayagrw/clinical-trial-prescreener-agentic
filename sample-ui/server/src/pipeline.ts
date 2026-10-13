import { seedEncounters } from "./demoData.ts";
import { detectDisagreements } from "./disagreements.ts";
import { buildCitations, detectMissingInfo, extractFacts, ingestDocuments, toWindowHours } from "./extract.ts";
import { buildSummary, summarizeRecord, validateFaithfulness } from "./summarize.ts";
import type { AuditEvent, GenerateHandoffRequest, HandoffRecord, SeedEncounter, WindowHours, WorklistItem } from "./types.ts";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function findEncounter(request: GenerateHandoffRequest): SeedEncounter {
  const encounter = seedEncounters.find((item) => {
    if (request.encounterId) return item.encounterId === request.encounterId;
    if (request.patientId) return item.patientId === request.patientId;
    return false;
  });

  if (!encounter) {
    throw new Error("Encounter not found for the supplied patient or encounter id.");
  }

  return encounter;
}

function buildAuditEvent(
  stage: AuditEvent["stage"],
  summary: string,
  detail: string,
  metrics?: Record<string, string | number | boolean>,
): AuditEvent {
  return {
    id: `audit-${stage}-${Math.random().toString(36).slice(2, 10)}`,
    stage,
    summary,
    detail,
    createdAt: new Date().toISOString(),
    metrics,
  };
}

export function generateHandoff(request: GenerateHandoffRequest): HandoffRecord {
  const encounter = findEncounter(request);
  const windowHours = toWindowHours(request.windowHours);
  const audit: AuditEvent[] = [];
  const documents = ingestDocuments(encounter.documents, windowHours);

  audit.push(
    buildAuditEvent(
      "ingestion",
      "Ingested encounter documents into the normalized handoff window.",
      `Loaded ${documents.length} documents for ${encounter.patientName} in the ${windowHours}-hour window.`,
      {
        encounterId: encounter.encounterId,
        windowHours,
        documentCount: documents.length,
      },
    ),
  );

  const { deterministicFacts, heuristicFacts, facts } = extractFacts(documents);
  audit.push(
    buildAuditEvent(
      "extraction",
      "Derived structured clinical facts from normalized documents.",
      `Extracted ${facts.length} total facts (${deterministicFacts.length} deterministic, ${heuristicFacts.length} heuristic narrative).`,
      {
        factCount: facts.length,
        deterministicFactCount: deterministicFacts.length,
        heuristicFactCount: heuristicFacts.length,
      },
    ),
  );

  const citations = buildCitations(facts, documents);
  const disagreements = detectDisagreements(facts, citations);
  audit.push(
    buildAuditEvent(
      "disagreement_detection",
      "Clustered facts by topic and surfaced multi-service disagreement.",
      `Detected ${disagreements.length} disagreement cluster(s) across ${unique(disagreements.flatMap((item) => item.services)).length} service labels.`,
      {
        disagreementCount: disagreements.length,
        requiresHumanReview: disagreements.some((item) => item.requiresHumanReview),
      },
    ),
  );

  const missingInfo = detectMissingInfo(encounter.encounterId, documents);
  const summary = buildSummary({
    encounter,
    windowHours,
    documents,
    facts,
    citations,
    disagreements,
    missingInfo,
  });
  audit.push(
    buildAuditEvent(
      "summarization",
      "Built SBAR output from curated facts rather than raw notes.",
      `Generated ${summary.situation.length + summary.background.length + summary.assessment.length + summary.recommendations.length} SBAR bullet(s).`,
      {
        situationCount: summary.situation.length,
        backgroundCount: summary.background.length,
        assessmentCount: summary.assessment.length,
        recommendationCount: summary.recommendations.length,
        status: summary.status,
      },
    ),
  );

  validateFaithfulness(summary, documents);
  audit.push(
    buildAuditEvent(
      "validation",
      "Validated that every SBAR sentence is citation-backed and verbatim-traceable.",
      "Faithfulness validation passed for all generated bullets and citations.",
      {
        citationCount: summary.citations.length,
        missingInfoCount: summary.missingInfo.length,
      },
    ),
  );

  const headlineSummary = summarizeRecord(encounter, windowHours, summary);

  return {
    id: headlineSummary.id,
    patientId: encounter.patientId,
    encounterId: encounter.encounterId,
    patientName: encounter.patientName,
    maskedMrn: encounter.maskedMrn,
    age: encounter.age,
    unit: encounter.unit,
    primaryService: encounter.primaryService,
    diagnosis: encounter.diagnosis,
    windowHours,
    headline: headlineSummary.headline,
    nextAction: headlineSummary.nextAction,
    summary,
    documents,
    facts,
    audit,
  };
}

export function generateBaselineHandoffs(): HandoffRecord[] {
  return seedEncounters.map((encounter) =>
    generateHandoff({ encounterId: encounter.encounterId, windowHours: 72 }),
  );
}

export function listDocumentsForPatient(
  patientId: string,
  windowHours: WindowHours,
) {
  const encounter = findEncounter({ patientId, windowHours });
  return ingestDocuments(encounter.documents, windowHours);
}

export function buildWorklistItem(record: HandoffRecord): WorklistItem {
  return {
    handoffId: record.id,
    patientId: record.patientId,
    encounterId: record.encounterId,
    patientName: record.patientName,
    maskedMrn: record.maskedMrn,
    unit: record.unit,
    primaryService: record.primaryService,
    diagnosis: record.diagnosis,
    status: record.summary.status,
    generatedAt: record.summary.generatedAt,
    windowHours: record.windowHours,
    openDisagreements: record.summary.disagreements.length,
    missingInfoCount: record.summary.missingInfo.length,
    headline: record.headline,
    nextAction: record.nextAction,
  };
}
