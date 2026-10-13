import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedPatientCatalogItems } from "../../src/data/patientCatalogSeed.ts";
import type {
  ClinicalNote,
  LabResult,
  Medication,
  Patient,
  PatientCatalogItem,
  PatientCatalogRuntimeStore,
  PatientClinicalRecord,
  PatientParseStatus,
  PatientRemovalRecord,
  PatientRemovalResult,
} from "../../src/types/clinical.ts";
import { readJsonFile, writeJsonFile } from "./storage.ts";

interface PatientCatalogRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
  url: URL;
  readBody: (request: IncomingMessage) => Promise<unknown>;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const runtimeFile = join(currentDir, "..", ".runtime", "patient-catalog.json");

let patientCatalogCache = new Map<string, PatientCatalogItem>();
let removedPatientsCache = new Map<string, PatientRemovalRecord>();
let patientCatalogUpdatedAt: string | null = null;

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[–—]/g, "-");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function extractSection(
  text: string,
  headingPattern: RegExp,
  nextHeadingPatterns: RegExp[],
) {
  const match = headingPattern.exec(text);
  if (!match || match.index == null) {
    return "";
  }

  const remainder = text.slice(match.index + match[0].length);
  let endIndex = remainder.length;
  nextHeadingPatterns.forEach((pattern) => {
    const nextMatch = pattern.exec(remainder);
    if (nextMatch?.index != null) {
      endIndex = Math.min(endIndex, nextMatch.index);
    }
  });

  return remainder.slice(0, endIndex).trim();
}

function inferDiseaseArea(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("lung") || lower.includes("thoracic") || lower.includes("nsclc")) {
    return "Thoracic Oncology";
  }
  if (lower.includes("breast")) {
    return "Breast Oncology";
  }
  if (
    lower.includes("endometrial") ||
    lower.includes("ovarian") ||
    lower.includes("gynec")
  ) {
    return "Gynecologic Oncology";
  }
  if (
    lower.includes("cholangio") ||
    lower.includes("biliary") ||
    lower.includes("pancrea")
  ) {
    return "GI Oncology";
  }
  if (lower.includes("melanoma")) {
    return "Melanoma";
  }

  return "Imported clinical record";
}

function extractBiomarkers(text: string) {
  const library: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /egfr exon ?20|egfr ex20ins/i, label: "EGFR ex20ins" },
    { pattern: /fgfr2/i, label: "FGFR2 fusion" },
    { pattern: /msi-high|msi high/i, label: "MSI-high" },
    { pattern: /mlh1 loss/i, label: "MLH1 loss" },
    { pattern: /pd-l1/i, label: "PD-L1" },
    { pattern: /brca/i, label: "BRCA" },
    { pattern: /braf/i, label: "BRAF" },
    { pattern: /alk/i, label: "ALK" },
    { pattern: /ros1/i, label: "ROS1" },
    { pattern: /her2|her-2/i, label: "HER2" },
  ];

  return library
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => entry.label);
}

function parseProblemList(sectionText: string) {
  const normalized = normalizeText(sectionText);
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+\.\s*/, ""))
    .map((line) => {
      const onsetMatch = line.match(/\(onset:\s*([^)]+)\)/i);
      const withoutOnset = line.replace(/\(onset:\s*([^)]+)\)/i, "").trim();
      const codeMatch = withoutOnset.match(/^([A-Z0-9.]+)\s*-\s*(.+)$/i);

      return {
        code: codeMatch?.[1]?.trim() ?? "UNKNOWN",
        description: codeMatch?.[2]?.trim() ?? withoutOnset,
        onset: onsetMatch?.[1]?.trim() ?? "Unknown",
      };
    });
}

function inferLabCollectionDate(text: string) {
  const match =
    text.match(/LABORATORY RESULTS\s*\(collected\s*([^)]+)\):/i) ??
    text.match(/Labs\s*\(([^)]+)\):/i);
  return toIsoDate(match?.[1]);
}

function parseLabs(sectionText: string, fallbackDate: string): LabResult[] {
  const normalized = normalizeText(sectionText);
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-+\s*/, ""))
    .map((line) => {
      const match = line.match(
        /^([^:]+):\s*([0-9.,<>]+)\s*([^()\-]*?)(?:\s*\(ref\s*([^)]+)\))?(?:\s*-\s*(.+))?$/i,
      );

      return {
        test: match?.[1]?.trim() ?? line.split(":")[0]?.trim() ?? "Unknown lab",
        value: match?.[2]?.trim() ?? "",
        unit: match?.[3]?.trim() ?? "",
        referenceRange: match?.[4]?.trim() ?? "Not reported",
        date: fallbackDate,
        flag: (() => {
          const tail = match?.[5]?.toLowerCase() ?? "";
          if (tail.includes("critical")) return "critical";
          if (tail.includes("low")) return "low";
          if (tail.includes("high")) return "high";
          if (tail.includes("normal")) return "normal";
          return undefined;
        })(),
      } satisfies LabResult;
    });
}

function parseMedicationDates(statusPart: string) {
  const dateText = statusPart.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (!dateText) {
    return { startDate: "Unknown", endDate: undefined as string | undefined };
  }

  const cleaned = normalizeText(dateText)
    .replace(/^started\s+/i, "")
    .trim();
  const rangeParts = cleaned.split(/\s+-\s+/);
  if (rangeParts.length >= 2) {
    return {
      startDate: rangeParts[0].trim(),
      endDate: rangeParts.slice(1).join(" - ").trim(),
    };
  }

  return {
    startDate: cleaned,
    endDate: undefined,
  };
}

function parseMedications(sectionText: string): Medication[] {
  const normalized = normalizeText(sectionText);
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, ""))
    .map((line) => {
      const segments = line.split(/\s+-\s+/);
      const primary = segments[0]?.trim() ?? line;
      const statusPart = segments[1]?.trim() ?? "";
      const { startDate, endDate } = parseMedicationDates(statusPart);
      const status = /completed/i.test(statusPart)
        ? "completed"
        : /discontinued/i.test(statusPart)
          ? "discontinued"
          : "active";
      const routeMatch = primary.match(/\b(IV|PO|SC|IM|oral|topical|intravenous)\b/i);

      return {
        name: primary,
        route: routeMatch?.[1] ?? "Unknown",
        status,
        startDate,
        endDate,
        indication: segments.slice(2).join(" - ").trim() || undefined,
      } satisfies Medication;
    });
}

function inferNoteType(title: string): ClinicalNote["type"] {
  const lower = title.toLowerCase();
  if (lower.includes("pathology")) return "pathology";
  if (lower.includes("genomic") || lower.includes("molecular")) return "genomic";
  if (
    lower.includes("mri") ||
    lower.includes("ct ") ||
    lower.includes("pet") ||
    lower.includes("imaging") ||
    lower.includes("radiology")
  ) {
    return "imaging";
  }
  if (lower.includes("discharge")) return "discharge";
  if (lower.includes("procedure") || lower.includes("biopsy")) return "procedure";
  return "progress";
}

function parseNotes(sectionText: string, fallbackDate: string): ClinicalNote[] {
  const normalized = normalizeText(sectionText);
  const notes: ClinicalNote[] = [];
  const blockPattern = /^---\s*(.+?)\s*---\s*([\s\S]*?)(?=^---\s*.+?\s*---|\Z)/gm;

  let match = blockPattern.exec(normalized);
  while (match) {
    const header = match[1].trim();
    const body = match[2].trim();
    const titleMatch = header.match(/^(.*?)(?:\(([^)]+)\))?$/);
    const title = titleMatch?.[1]?.trim() || header;
    const meta = titleMatch?.[2]?.trim() ?? "";
    const metaParts = meta.split(/\s+-\s+/);
    const noteDate = toIsoDate(metaParts[0]) ?? fallbackDate;
    const author = metaParts.slice(1).join(" - ").trim() || "Imported clinical record";

    notes.push({
      type: inferNoteType(title),
      title,
      date: noteDate,
      author,
      text: body,
    });

    match = blockPattern.exec(normalized);
  }

  if (notes.length === 0 && normalized.trim()) {
    notes.push({
      type: "progress",
      title: "Uploaded clinical note",
      date: fallbackDate,
      author: "Imported clinical record",
      text: normalized.trim(),
    });
  }

  return notes;
}

function inferStage(text: string) {
  const normalized = normalizeText(text);
  const stageMatch = normalized.match(/\b(Stage\s+[IVX]+[A-C]?|pT\dN\dM\d[a-z]?)/i);
  return stageMatch?.[1]?.trim() ?? "Stage unknown";
}

function parsePatientSummary(
  record: PatientClinicalRecord,
  rawRecordText: string,
  patientId: string,
  fileName: string,
  contentHash: string,
): Patient {
  const normalized = normalizeText(rawRecordText);
  const name =
    normalized.match(/Name:\s*([^|\n]+)/i)?.[1]?.trim() ??
    normalized.match(/Patient:\s*([^\n]+)/i)?.[1]?.trim() ??
    `Uploaded patient ${contentHash.slice(0, 6).toUpperCase()}`;
  const mrn =
    normalized.match(/MRN[:\s]+([A-Z0-9*-]+)/i)?.[1]?.trim() ??
    `UPL-${contentHash.slice(0, 6).toUpperCase()}`;
  const diagnosis =
    normalized.match(/Diagnosis:\s*([^\n]+)/i)?.[1]?.trim() ??
    record.problemList[0]?.description ??
    "Clinical record uploaded";
  const diseaseArea = inferDiseaseArea(`${diagnosis}\n${rawRecordText}`);
  const biomarkers = extractBiomarkers(rawRecordText);

  return {
    id: patientId,
    name,
    mrn,
    age: record.demographics.age,
    sex: record.demographics.sex || "Unknown",
    diseaseArea,
    diagnosis,
    stage: inferStage(rawRecordText),
    ecog:
      record.ecogPerformanceStatus == null
        ? "ECOG unknown"
        : `ECOG ${record.ecogPerformanceStatus}`,
    careTeam: "Needs assignment",
    nextAppointment: `Imported from ${fileName}`,
    biomarkers,
    summaryFlags: ["Uploaded clinical record", "Server runtime catalog"],
  };
}

function parseUploadedClinicalRecord(
  rawRecordText: string,
  fileName: string,
): Omit<PatientCatalogItem, "patient"> & { patient: Patient } {
  const normalized = normalizeText(rawRecordText);
  const warnings: string[] = [];
  const contentHash = createHash("sha256")
    .update(normalized.trim())
    .digest("hex")
    .slice(0, 12);
  const patientId = `uploaded-${slugify(fileName) || "record"}-${contentHash.slice(0, 6)}`;
  const fallbackDate = new Date().toISOString().slice(0, 10);

  const demographicsSection = extractSection(normalized, /DEMOGRAPHICS:\s*/i, [
    /\nPROBLEM LIST:\s*/i,
    /\nLABORATORY RESULTS(?:\s*\([^)]*\))?:\s*/i,
    /\nCURRENT MEDICATIONS:\s*/i,
    /\nCLINICAL NOTES:\s*/i,
  ]);
  const problemListSection = extractSection(normalized, /PROBLEM LIST:\s*/i, [
    /\nLABORATORY RESULTS(?:\s*\([^)]*\))?:\s*/i,
    /\nCURRENT MEDICATIONS:\s*/i,
    /\nCLINICAL NOTES:\s*/i,
  ]);
  const labSection = extractSection(
    normalized,
    /LABORATORY RESULTS(?:\s*\([^)]*\))?:\s*/i,
    [/\nCURRENT MEDICATIONS:\s*/i, /\nCLINICAL NOTES:\s*/i],
  );
  const medicationSection = extractSection(normalized, /CURRENT MEDICATIONS:\s*/i, [
    /\nCLINICAL NOTES:\s*/i,
  ]);
  const notesSection = extractSection(normalized, /CLINICAL NOTES:\s*/i, []);

  const ageMatch = normalized.match(/Age:\s*(\d+)/i);
  const sexMatch = normalized.match(/Sex:\s*([^|\n]+)/i);
  const ecogMatch =
    normalized.match(/ECOG Performance Status:\s*(\d)/i) ??
    normalized.match(/ECOG[^:]*:\s*(\d)/i);
  const weightMatch = normalized.match(/Weight:\s*([^|\n]+)/i);
  const heightMatch = normalized.match(/Height:\s*([^|\n]+)/i);
  const bmiMatch = normalized.match(/BMI:\s*([^|\n]+)/i);
  const raceMatch = normalized.match(/Race:\s*([^|\n]+)/i);
  const ethnicityMatch = normalized.match(/Ethnicity:\s*([^|\n]+)/i);

  const problems = parseProblemList(problemListSection);
  const labDate = inferLabCollectionDate(normalized) ?? fallbackDate;
  const labs = parseLabs(labSection, labDate);
  const medications = parseMedications(medicationSection);
  const notes = parseNotes(notesSection, fallbackDate);

  if (!demographicsSection) warnings.push("Demographics were only partially parsed.");
  if (problems.length === 0) warnings.push("Problem list was not detected.");
  if (labs.length === 0) warnings.push("Laboratory results were not detected.");
  if (medications.length === 0) warnings.push("Medication history was not detected.");
  if (notesSection.trim().length === 0) warnings.push("Clinical notes section was not detected.");
  if (!ageMatch) warnings.push("Age was not detected.");
  if (!ecogMatch) warnings.push("ECOG was not detected.");

  const clinicalRecord: PatientClinicalRecord = {
    patientId,
    demographics: {
      age: ageMatch ? Number.parseInt(ageMatch[1], 10) : null,
      sex: sexMatch?.[1]?.trim() ?? "Unknown",
      weight: weightMatch?.[1]?.trim() ?? "—",
      height: heightMatch?.[1]?.trim() ?? "—",
      bmi: bmiMatch?.[1]?.trim() ?? "—",
      race: raceMatch?.[1]?.trim() || undefined,
      ethnicity: ethnicityMatch?.[1]?.trim() || undefined,
    },
    ecogPerformanceStatus: ecogMatch
      ? Number.parseInt(ecogMatch[1], 10)
      : null,
    problemList: problems,
    labs,
    medications,
    notes,
    fullRecordText: rawRecordText,
  };

  const parsedSectionCount = [problems.length > 0, labs.length > 0, medications.length > 0, notes.length > 0].filter(Boolean).length;
  const parseStatus: PatientParseStatus =
    parsedSectionCount >= 3 ? "structured" : parsedSectionCount >= 1 ? "partial" : "failed";
  const uploadedAt = new Date().toISOString();
  const patient = parsePatientSummary(
    clinicalRecord,
    rawRecordText,
    patientId,
    fileName,
    contentHash,
  );

  return {
    patient,
    clinicalRecord,
    source: "upload",
    rawRecordText,
    parseStatus,
    parseWarnings: warnings,
    uploadedAt,
    fileName,
    contentHash,
  };
}

function sortItems(items: PatientCatalogItem[]) {
  return [...items].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "seed" ? -1 : 1;
    }

    return left.patient.name.localeCompare(right.patient.name);
  });
}

function sortRemovedPatients(items: PatientRemovalRecord[]) {
  return [...items].sort((left, right) => {
    const byDate = right.removedAt.localeCompare(left.removedAt);
    if (byDate !== 0) {
      return byDate;
    }

    return left.patientId.localeCompare(right.patientId);
  });
}

function toRuntimePayload(items: PatientCatalogItem[]): PatientCatalogRuntimeStore {
  return {
    updatedAt: patientCatalogUpdatedAt,
    items: sortItems(items),
    removedPatients: sortRemovedPatients([...removedPatientsCache.values()]),
  };
}

async function persistPatientCatalog(): Promise<void> {
  const payload: PatientCatalogRuntimeStore = {
    updatedAt: new Date().toISOString(),
    items: sortItems([...patientCatalogCache.values()]),
    removedPatients: sortRemovedPatients([...removedPatientsCache.values()]),
  };
  await writeJsonFile(runtimeFile, payload);
  patientCatalogUpdatedAt = payload.updatedAt;
}

function backfillSeedItems(
  items: PatientCatalogItem[],
  removedPatients: PatientRemovalRecord[],
) {
  const removedIds = new Set(removedPatients.map((item) => item.patientId));
  const byId = new Map(
    items
      .filter((item) => !removedIds.has(item.patient.id))
      .map((item) => [item.patient.id, item] as const),
  );
  seedPatientCatalogItems.forEach((item) => {
    if (!removedIds.has(item.patient.id) && !byId.has(item.patient.id)) {
      byId.set(item.patient.id, item);
    }
  });
  return sortItems([...byId.values()]);
}

async function readPatientCatalogStore(): Promise<PatientCatalogRuntimeStore> {
  const parsed = await readJsonFile<PatientCatalogRuntimeStore>(runtimeFile);
  if (!parsed) {
    return {
      updatedAt: null,
      items: backfillSeedItems([], []),
      removedPatients: [],
    };
  }

  const removedPatients = parsed.removedPatients ?? [];
  return {
    updatedAt: parsed.updatedAt ?? null,
    items: backfillSeedItems(parsed.items ?? [], removedPatients),
    removedPatients: sortRemovedPatients(removedPatients),
  };
}

export async function bootstrapPatientCatalog(): Promise<void> {
  const payload = await readPatientCatalogStore();
  removedPatientsCache = new Map(
    payload.removedPatients.map((item) => [item.patientId, item] as const),
  );
  patientCatalogCache = new Map(
    payload.items.map((item) => [item.patient.id, item] as const),
  );
  patientCatalogUpdatedAt = payload.updatedAt;

  if (!payload.updatedAt) {
    await persistPatientCatalog();
    return;
  }

  const nextItems = backfillSeedItems(
    [...patientCatalogCache.values()],
    [...removedPatientsCache.values()],
  );
  if (nextItems.length !== payload.items.length) {
    patientCatalogCache = new Map(
      nextItems.map((item) => [item.patient.id, item] as const),
    );
    await persistPatientCatalog();
  }
}

export async function getPatientCatalogRuntimeStore(): Promise<PatientCatalogRuntimeStore> {
  if (
    patientCatalogCache.size === 0 &&
    removedPatientsCache.size === 0 &&
    patientCatalogUpdatedAt == null
  ) {
    await bootstrapPatientCatalog();
  }

  return toRuntimePayload([...patientCatalogCache.values()]);
}

async function upsertUploadedPatient(
  rawRecordText: string,
  fileName: string,
): Promise<PatientCatalogItem> {
  const parsed = parseUploadedClinicalRecord(rawRecordText, fileName);
  const existing = [...patientCatalogCache.values()].find(
    (item) =>
      item.source === "upload" &&
      item.contentHash === parsed.contentHash,
  );

  if (existing) {
    return existing;
  }

  removedPatientsCache.delete(parsed.patient.id);
  patientCatalogCache.set(parsed.patient.id, parsed);
  await persistPatientCatalog();
  return parsed;
}

async function removePatientFromCatalog(
  patientId: string,
): Promise<PatientRemovalResult> {
  const item = patientCatalogCache.get(patientId);
  if (!item) {
    throw new Error("Patient not found.");
  }

  const removalRecord: PatientRemovalRecord = {
    patientId,
    source: item.source,
    removedAt: new Date().toISOString(),
    removalMode: item.source === "upload" ? "hard_delete" : "tombstone",
  };

  patientCatalogCache.delete(patientId);
  removedPatientsCache.set(patientId, removalRecord);
  await persistPatientCatalog();

  return {
    requestedPatientId: patientId,
    removedPatientId: patientId,
    source: item.source,
    removalMode: removalRecord.removalMode,
  };
}

export async function handlePatientCatalogApiRequest({
  request,
  response,
  path,
  url,
  readBody,
}: PatientCatalogRequestContext): Promise<boolean> {
  if (!path.startsWith("/patients/catalog")) {
    return false;
  }

  try {
    if (request.method === "GET" && path === "/patients/catalog") {
      sendJson(response, 200, toRuntimePayload([...patientCatalogCache.values()]));
      return true;
    }

    if (request.method === "POST" && path === "/patients/catalog/uploads") {
      const body = ((await readBody(request)) ?? {}) as {
        fileName?: string;
        rawRecordText?: string;
      };
      const fileName = body.fileName?.trim() || "Uploaded clinical record";
      const rawRecordText = body.rawRecordText?.trim();

      if (!rawRecordText) {
        sendJson(response, 400, { error: "rawRecordText is required." });
        return true;
      }

      const item = await upsertUploadedPatient(rawRecordText, fileName);
      sendJson(response, 200, item);
      return true;
    }

    const deleteMatch = path.match(/^\/patients\/catalog(?:\/uploads)?\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMatch) {
      const patientId = deleteMatch[1];
      if (!patientCatalogCache.has(patientId)) {
        sendJson(response, 404, { error: "Patient not found." });
        return true;
      }
      const result = await removePatientFromCatalog(patientId);
      sendJson(response, 200, result);
      return true;
    }
  } catch (error) {
    sendJson(response, 500, {
      error:
        error instanceof Error ? error.message : "Unknown patient catalog error",
      path,
      query: Object.fromEntries(url.searchParams.entries()),
    });
    return true;
  }

  return false;
}
