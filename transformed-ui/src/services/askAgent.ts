// Ask Agent service — the single highest-leverage feature in the POC.
//
// Responsibilities:
// 1. Resolve the current context (patient, match, trial, criteria, evidence,
//    timeline, audit) into a compact evidence bundle.
// 2. Send the bundle + user query to Claude via `claudeClient`.
// 3. Parse `[cite:evidence-xxx]` markers out of the response and resolve them
//    into `AgentCitation` chips.
// 4. On any failure (no API key, timeout, network, bad response), transparently
//    serve a scripted fallback from `agentFallbacks` — the demo must never
//    show a broken agent.

import {
  assessments,
  evidenceSnippets,
  timelineEvents,
  auditEvents,
  getMatch,
  getPatient,
  getTrial,
} from "../data/index";
import type {
  AgentCitation,
  AgentMessage,
  AgentTableData,
} from "../types/extended";
import {
  callClaude,
  ClaudeApiError,
  ClaudeTimeoutError,
} from "./claudeClient";
import { lookupFallback } from "../data/agentFallbacks";

export interface AskAgentContext {
  page: "mission-control" | "review" | "insights" | "trial-config";
  matchId?: string;
  patientId?: string;
  trialId?: string;
}

export interface AskAgentResult {
  content: string;
  citations?: AgentCitation[];
  table?: AgentTableData;
  confidenceNote?: string;
  source: "live" | "fallback";
  fallbackReason?: string;
}

const CITE_PATTERN = /\[cite:(evidence-[a-z0-9-]+)\]/gi;

// ---------- Evidence bundle packing ----------

function packBundle(ctx: AskAgentContext): string {
  // If we have a specific match in context, scope the bundle to that match's
  // patient. Otherwise build a queue-wide bundle.
  if (ctx.matchId) {
    return packMatchBundle(ctx.matchId);
  }
  return packQueueBundle();
}

function packMatchBundle(matchId: string): string {
  const match = getMatch(matchId);
  if (!match) return "(no match found)";
  const patient = getPatient(match.patientId);
  const trial = getTrial(match.trialId);
  const criteria = assessments.filter((a) => match.criterionIds.includes(a.id));
  const evidence = evidenceSnippets.filter((e) => e.patientId === match.patientId);
  const timeline = timelineEvents.filter((e) => e.patientId === match.patientId);
  const audit = auditEvents.filter((a) => match.auditIds.includes(a.id));

  const lines: string[] = [];

  if (patient) {
    lines.push(`PATIENT: ${patient.name} (${patient.id}) — ${patient.mrn}`);
    lines.push(`  Age/Sex: ${patient.age} ${patient.sex}, ECOG ${patient.ecog}`);
    lines.push(`  Diagnosis: ${patient.diagnosis}, ${patient.stage}`);
    lines.push(`  Biomarkers: ${patient.biomarkers.join(", ")}`);
    lines.push(`  Care team: ${patient.careTeam}`);
    lines.push(`  Next appointment: ${patient.nextAppointment}`);
    lines.push("");
  }

  if (trial) {
    lines.push(`TRIAL: ${trial.shortCode} — ${trial.title}`);
    lines.push(`  Phase: ${trial.phase} | PI: ${trial.pi}`);
    lines.push(`  Protocol: ${trial.protocolVersion}`);
    lines.push(`  Screening window: ${trial.screeningWindow}`);
    lines.push(`  Activation: ${trial.activationState} | Release: ${trial.releaseState}`);
    lines.push("");
  }

  lines.push(`MATCH: ${match.id} — recommendation: ${match.recommendation}, fit score ${match.fitScore}`);
  lines.push(`  Rationale: ${match.rationale}`);
  if (match.blockers.length > 0) {
    lines.push(`  Blockers: ${match.blockers.join("; ")}`);
  }
  if (match.contradictionSummary) {
    lines.push(`  Contradiction: ${match.contradictionSummary}`);
  }
  lines.push("");

  lines.push("CRITERIA:");
  for (const c of criteria) {
    lines.push(
      `  ${c.id} [${c.status}] ${c.label} — threshold: ${c.thresholdLabel ?? "n/a"}`
    );
    lines.push(`    reasoning: ${c.reasoning}`);
    if (c.unresolvedReason) lines.push(`    unresolved: ${c.unresolvedReason}`);
    if (c.evidenceIds.length > 0) {
      lines.push(`    cited evidence: ${c.evidenceIds.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("EVIDENCE:");
  for (const e of evidence) {
    lines.push(
      `  ${e.id} [${e.tone}] ${e.type} | ${e.sourceDocument} (${e.sourceSystem}) | ${e.sourceDate} | ${e.author}`
    );
    lines.push(`    "${e.excerpt}"`);
  }
  lines.push("");

  lines.push("TIMELINE:");
  for (const t of timeline) {
    lines.push(`  ${t.date} [${t.tone}] ${t.title} — ${t.detail}`);
  }
  lines.push("");

  if (audit.length > 0) {
    lines.push("AUDIT TRAIL:");
    for (const a of audit) {
      lines.push(
        `  ${a.timestamp} | ${a.actor} | ${a.eventType} | ${a.summary}`
      );
      lines.push(
        `    rule: ${a.ruleVersion} | prompt: ${a.promptVersion} | model: ${a.modelVersion}`
      );
    }
  }

  return lines.join("\n");
}

function packQueueBundle(): string {
  // Queue-wide view — every match with its top-line facts.
  const lines: string[] = [];
  lines.push("QUEUE: 4 active patient-trial matches under pilot review");
  lines.push("");

  const matchIds = ["match-001", "match-002", "match-003", "match-004"];
  for (const mid of matchIds) {
    const match = getMatch(mid);
    if (!match) continue;
    const patient = getPatient(match.patientId);
    const trial = getTrial(match.trialId);
    lines.push(
      `${match.id}: ${patient?.name ?? "?"} × ${trial?.shortCode ?? "?"} — ${match.recommendation}, fit ${match.fitScore}`
    );
    if (match.blockers.length > 0) {
      lines.push(`  blockers: ${match.blockers.join("; ")}`);
    }
    lines.push(`  rationale: ${match.rationale}`);
  }

  lines.push("");
  lines.push("For deeper evidence, ask about a specific patient or criterion.");
  return lines.join("\n");
}

// ---------- System prompt ----------

const SYSTEM_PROMPT = `You are an eligibility analyst assistant for a clinical trial pre-screener used by oncology research coordinators at an academic cancer center.

You help coordinators and PIs understand why a specific patient-trial match has its current status. You never adjudicate clinical decisions — you surface evidence and recommend next actions.

STRICT RULES:
1. Use ONLY facts from the EVIDENCE BUNDLE below. Never invent patients, dates, labs, or protocol language.
2. Cite every factual claim with a marker like [cite:evidence-005]. Use the exact evidence ID from the bundle.
3. Use explicit dates (e.g., "November 5, 2025") when temporal logic matters. Do the day-math yourself from the dates in the bundle.
4. When evidence conflicts, say so explicitly and classify the uncertainty as "contradiction" — do NOT pick a side. Recommend PI review.
5. When information is missing from the bundle, say "uncertain — evidence not available" and stop. Do not speculate.
6. Keep responses to 4-6 sentences of prose. Use **bold** for the most important fact. Do not use headings.
7. Never make an enrollment decision. Only recommend next actions such as "escalate to PI", "hold for tumor board", or "ready for coordinator outreach".
8. Do not claim the bundle contains information that is not in it.

OUTPUT: plain prose (Markdown bold allowed) with inline [cite:evidence-xxx] markers. No JSON, no XML.`;

function buildUserMessage(query: string, bundle: string): string {
  return `EVIDENCE BUNDLE:\n${bundle}\n\n---\n\nQUESTION: ${query}`;
}

// ---------- Citation extraction ----------

function extractCitations(text: string): {
  cleanedText: string;
  citations: AgentCitation[];
} {
  const seen = new Map<string, AgentCitation>();
  // Match + strip the markers; we leave a subtle "†" superscript footprint
  // so coordinators can see citations are inline without cluttering prose.
  const cleanedText = text.replace(CITE_PATTERN, (_full, id: string) => {
    const evidence = evidenceSnippets.find((e) => e.id === id);
    if (evidence && !seen.has(id)) {
      seen.set(id, {
        id: evidence.id,
        label: evidence.sourceDocument,
        sourceDate: evidence.sourceDate,
        tone: evidence.tone,
      });
    }
    return "";
  });

  return {
    cleanedText: cleanedText.replace(/\s{2,}/g, " ").trim(),
    citations: Array.from(seen.values()),
  };
}

// ---------- Public API ----------

export async function ask(
  query: string,
  context: AskAgentContext
): Promise<AskAgentResult> {
  const bundle = packBundle(context);
  const userMessage = buildUserMessage(query, bundle);

  try {
    const result = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      timeoutMs: 6000,
    });

    const { cleanedText, citations } = extractCitations(result.text);

    // If Claude returned nothing usable, fall back silently.
    if (!cleanedText || cleanedText.length < 8) {
      return buildFallback(query, "empty_response");
    }

    return {
      content: cleanedText,
      citations: citations.length > 0 ? citations : undefined,
      source: "live",
    };
  } catch (err) {
    const reason =
      err instanceof ClaudeTimeoutError
        ? "timeout"
        : err instanceof ClaudeApiError
          ? `api_${err.status}`
          : "network";
    // eslint-disable-next-line no-console
    console.warn(`[askAgent] Falling back (${reason}):`, err);
    return buildFallback(query, reason);
  }
}

function buildFallback(query: string, reason: string): AskAgentResult {
  const fb = lookupFallback(query);
  return {
    content: fb.content,
    citations: fb.citations,
    table: fb.table,
    confidenceNote: fb.confidenceNote,
    source: "fallback",
    fallbackReason: reason,
  };
}

// Convenience helper for components to turn an AskAgentResult into an
// AgentMessage-compatible object (just assign an id + timestamp).
export function toAgentMessage(
  id: string,
  result: AskAgentResult
): Omit<AgentMessage, "id"> & { id: string } {
  return {
    id,
    role: "agent",
    content: result.content,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
    citations: result.citations,
    table: result.table,
    confidenceNote: result.confidenceNote,
  };
}
