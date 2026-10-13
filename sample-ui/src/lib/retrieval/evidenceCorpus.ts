/*
 * evidenceCorpus — the canned, in-memory EHR corpus used by F2 demo retrieval.
 *
 * Each entry looks and feels like a real Epic / outside-records note, but it
 * is 100% fabricated for patient-001 so the `/ai-features` page can run a
 * real BM25 + embedding search without any PHI, network, or backend.
 *
 * Dates are all in 2025–2026 and hand-picked relative to `today = 2026-04-14`
 * so the freshness gate (P2 hybrid.ts) has something to actually trip on.
 * The corpus is intentionally diverse: labs, oncology notes, imaging reports,
 * medications, outside records, triage — so different queries surface
 * different top hits.
 */

import type { Bm25Doc } from "./bm25.ts";

export type EvidenceNoteCategory =
  | "lab"
  | "oncology_note"
  | "imaging"
  | "medication"
  | "triage"
  | "outside_records"
  | "vitals";

export interface EvidenceNote extends Bm25Doc {
  /** Human-readable source label ("Epic — Lab result"). */
  source: string;
  /** System of record ("Epic Hyperspace", "Outside records ingest", …). */
  sourceSystem: string;
  /** Author name / service line. */
  author: string;
  /** ISO date the note was authored. */
  sourceDate: string;
  /** Document category for filtering. */
  category: EvidenceNoteCategory;
  /** Optional patient id this note belongs to (all are patient-001 for now). */
  patientId: string;
  /** ISO date of the clinical event (may differ from note authoring date). */
  clinicalDate?: string;
  /** Links back to the originating document for audit trail. */
  sourceDocumentId?: string;
}

/**
 * Canned corpus. ~25 notes, mostly for patient-001. Fields intentionally
 * verbose so BM25 has enough lexical signal and embeddings have enough
 * context per document.
 */
export const EVIDENCE_CORPUS: EvidenceNote[] = [
  {
    id: "ev-101",
    patientId: "patient-001",
    source: "Epic — Lab result",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Clinical Lab",
    sourceDate: "2026-04-08",
    clinicalDate: "2026-04-08",
    sourceDocumentId: "doc-lab-20260408-001",
    category: "lab",
    text:
      "CBC with Diff — ANC 2,180/μL (ref 1500-8000), WBC 5.4, Plt 234, Hgb 12.1. " +
      "Absolute neutrophil count within range. Drawn 2026-04-08 09:14, signed 2026-04-08 10:02.",
  },
  {
    id: "ev-102",
    patientId: "patient-001",
    source: "Epic — Oncology note",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. L. Martinez, Thoracic Oncology",
    sourceDate: "2026-04-10",
    category: "oncology_note",
    text:
      "Patient tolerating prior therapy. Counts recovered: ANC 2.2, plt 234, hgb 12.1. " +
      "No infectious concerns. Plan to rescreen for clinical trial next week. " +
      "EGFR L858R NSCLC, stage IIIB, osimertinib last dose 2026-04-06.",
  },
  {
    id: "ev-103",
    patientId: "patient-001",
    source: "Epic — Infusion visit",
    sourceSystem: "Epic Hyperspace",
    author: "Infusion center",
    sourceDate: "2026-03-22",
    category: "lab",
    text:
      "Pre-treatment labs within range. ANC 1,920, platelets 178, neutrophils segmented normal. " +
      "Patient cleared for infusion. No dose reduction required.",
  },
  {
    id: "ev-104",
    patientId: "patient-001",
    source: "Epic — CT chest",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. R. Chen, Radiology",
    sourceDate: "2026-03-08",
    category: "imaging",
    text:
      "CT chest with contrast. RUL primary mass stable at 3.2 cm (prior 3.4 cm). No new nodules. " +
      "Mediastinal nodes stable. No pleural effusion. Impression: stable disease per RECIST 1.1. " +
      "Compared to CT 2025-12-14.",
  },
  {
    id: "ev-105",
    patientId: "patient-001",
    source: "Outside records — St Mary's",
    sourceSystem: "Outside records ingest",
    author: "St Mary's Hematology",
    sourceDate: "2025-12-18",
    category: "outside_records",
    text:
      "Hematology consult. Baseline counts: WBC 6.2, neutrophils 4.1, platelets 210, hemoglobin 13.0. " +
      "No prior thrombocytopenia or neutropenia. No transfusion history.",
  },
  {
    id: "ev-106",
    patientId: "patient-001",
    source: "Epic — Triage note",
    sourceSystem: "Epic Hyperspace",
    author: "RN Triage",
    sourceDate: "2026-04-12",
    category: "triage",
    text:
      "Patient called re scheduling. No acute issues reported. Neutropenia precautions still in place from prior cycle; next CBC tomorrow. " +
      "No fever, no chills, no bleeding.",
  },
  {
    id: "ev-107",
    patientId: "patient-001",
    source: "Epic — Lab result",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Clinical Lab",
    sourceDate: "2026-03-20",
    category: "lab",
    text:
      "Comprehensive Metabolic Panel — Creatinine 0.9 mg/dL (ref 0.6-1.2), eGFR 92, " +
      "Na 139, K 4.1, Cl 102, CO2 26, BUN 14, glucose 98. Liver panel: ALT 28, AST 22, alk phos 78, tbili 0.7.",
  },
  {
    id: "ev-108",
    patientId: "patient-001",
    source: "Epic — Medication administration",
    sourceSystem: "Epic Hyperspace",
    author: "Outpatient pharmacy",
    sourceDate: "2026-04-06",
    clinicalDate: "2026-04-06",
    sourceDocumentId: "doc-med-20260406-001",
    category: "medication",
    text:
      "Osimertinib 80 mg PO daily — last dose administered 2026-04-06 08:00. " +
      "Active order discontinued same day per oncology. Prior EGFR-TKI, washout required for clinical trial enrollment.",
  },
  {
    id: "ev-109",
    patientId: "patient-001",
    source: "Epic — MRI brain",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. P. Singh, Neuroradiology",
    sourceDate: "2026-02-18",
    category: "imaging",
    text:
      "MRI brain with and without contrast. No intracranial metastases. No midline shift. No enhancing lesions. " +
      "CNS stable. Compared to MRI 2025-09-02.",
  },
  {
    id: "ev-110",
    patientId: "patient-001",
    source: "Epic — Oncology note",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. L. Martinez, Thoracic Oncology",
    sourceDate: "2026-02-20",
    category: "oncology_note",
    text:
      "Stage IIIB EGFR L858R NSCLC on osimertinib since 2025-09-15. " +
      "PS 1, tolerating therapy. Discussed clinical trial options with patient. " +
      "No new CNS symptoms. Will pursue pre-screening for Phase II TKI combo trial.",
  },
  {
    id: "ev-111",
    patientId: "patient-001",
    source: "Epic — Lab result",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Clinical Lab",
    sourceDate: "2026-04-08",
    category: "lab",
    text:
      "Hepatic function panel — ALT 28, AST 22, alk phos 78, albumin 4.1, total bilirubin 0.7. " +
      "All within normal limits. No evidence of hepatic dysfunction.",
  },
  {
    id: "ev-112",
    patientId: "patient-001",
    source: "Epic — Vitals",
    sourceSystem: "Epic Hyperspace",
    author: "Nursing",
    sourceDate: "2026-04-10",
    category: "vitals",
    text:
      "BP 128/78, HR 82, RR 16, SpO2 97% on RA, T 36.8 C, weight 72 kg. ECOG PS 1. " +
      "Ambulatory, no distress.",
  },
  {
    id: "ev-113",
    patientId: "patient-001",
    source: "Epic — Pathology",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Pathology",
    sourceDate: "2025-08-22",
    clinicalDate: "2025-08-22",
    sourceDocumentId: "doc-path-20250822-001",
    category: "outside_records",
    text:
      "Lung RUL core biopsy. Non-small cell lung carcinoma, adenocarcinoma. " +
      "EGFR mutation detected: L858R exon 21. ALK, ROS1, KRAS negative. PD-L1 TPS 20%.",
  },
  {
    id: "ev-114",
    patientId: "patient-001",
    source: "Epic — Problem list",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Primary Care",
    sourceDate: "2026-01-02",
    category: "oncology_note",
    text:
      "Active problems: NSCLC stage IIIB EGFR L858R, HTN well-controlled, no diabetes, " +
      "no atrial fibrillation, no prior MI, no CHF. No autoimmune disease. No active infection.",
  },
  {
    id: "ev-115",
    patientId: "patient-001",
    source: "Epic — Lab result",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Clinical Lab",
    sourceDate: "2026-04-08",
    category: "lab",
    text:
      "Coagulation panel — PT 11.8, INR 1.0, PTT 28. No anticoagulation. Normal coag profile.",
  },
  {
    id: "ev-116",
    patientId: "patient-001",
    source: "Epic — CT chest",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. R. Chen, Radiology",
    sourceDate: "2025-12-14",
    category: "imaging",
    text:
      "CT chest with contrast. RUL primary mass 3.4 cm. Mediastinal nodes borderline. " +
      "Baseline for current therapy line. No pleural effusion. No distant mets identified on chest imaging.",
  },
  {
    id: "ev-117",
    patientId: "patient-001",
    source: "Epic — Oncology note",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. L. Martinez, Thoracic Oncology",
    sourceDate: "2025-09-15",
    category: "oncology_note",
    text:
      "Initiated osimertinib 80 mg PO daily. Discussed side effect profile including rash, diarrhea, " +
      "cardiotoxicity risk (QTc monitoring). Counseled re contraception and interaction with CYP3A4 inhibitors.",
  },
  {
    id: "ev-118",
    patientId: "patient-001",
    source: "Outside records — Regional Cancer Center",
    sourceSystem: "Outside records ingest",
    author: "Dr. S. Patel, Medical Oncology",
    sourceDate: "2025-07-30",
    category: "outside_records",
    text:
      "Second opinion note. Agree with CTP plan. Stage IIIB NSCLC EGFR L858R. " +
      "Recommend first-line osimertinib per NCCN. No evidence of brain metastases on MRI 2025-07-28.",
  },
  {
    id: "ev-119",
    patientId: "patient-001",
    source: "Epic — Echocardiogram",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. T. Wong, Cardiology",
    sourceDate: "2026-02-28",
    clinicalDate: "2026-02-28",
    sourceDocumentId: "doc-echo-20260228-001",
    category: "imaging",
    text:
      "Echocardiogram. LVEF 62% (prior 60%). Normal wall motion. No pericardial effusion. " +
      "Mild mitral regurgitation, trace tricuspid regurgitation. Cardiac function preserved.",
  },
  {
    id: "ev-120",
    patientId: "patient-001",
    source: "Epic — ECG",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. T. Wong, Cardiology",
    sourceDate: "2026-04-10",
    category: "vitals",
    text:
      "ECG 12-lead. Normal sinus rhythm, rate 78. QTc 432 ms (within normal). " +
      "No ischemic changes. No arrhythmia. QTc safe for continued EGFR-TKI therapy.",
  },
  {
    id: "ev-121",
    patientId: "patient-001",
    source: "Epic — Medication list",
    sourceSystem: "Epic Hyperspace",
    author: "Outpatient pharmacy",
    sourceDate: "2026-04-10",
    category: "medication",
    text:
      "Active meds: lisinopril 10 mg PO daily (HTN), ondansetron 4 mg PO PRN nausea, " +
      "famotidine 20 mg PO BID. No warfarin, no DOAC. No strong CYP3A4 inhibitor / inducer.",
  },
  {
    id: "ev-122",
    patientId: "patient-001",
    source: "Epic — Social history",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Primary Care",
    sourceDate: "2024-10-15",
    category: "outside_records",
    text:
      "Former smoker, 20 pack-year, quit 2018. No alcohol. No recreational drugs. " +
      "Lives with spouse. Employed. Preferred language English.",
  },
  {
    id: "ev-123",
    patientId: "patient-001",
    source: "Epic — Immunizations",
    sourceSystem: "Epic Hyperspace",
    author: "CTP Primary Care",
    sourceDate: "2025-11-01",
    category: "outside_records",
    text:
      "Influenza 2025-10-04, COVID-19 booster 2025-10-04, pneumococcal up to date. " +
      "No live vaccines in last 90 days.",
  },
  {
    id: "ev-124",
    patientId: "patient-001",
    source: "Epic — Oncology note",
    sourceSystem: "Epic Hyperspace",
    author: "Dr. L. Martinez, Thoracic Oncology",
    sourceDate: "2026-03-30",
    category: "oncology_note",
    text:
      "Progression noted on recent CT — will discontinue osimertinib and evaluate for second-line trial. " +
      "EGFR-TKI washout required per protocol (≥ 14 days). Plan to refer for Phase II TKI combo screening.",
  },
  {
    id: "ev-125",
    patientId: "patient-001",
    source: "Epic — Nursing note",
    sourceSystem: "Epic Hyperspace",
    author: "RN Clinic",
    sourceDate: "2026-04-11",
    category: "triage",
    text:
      "Patient counseled on trial screening process. Reviewed washout requirement and re-imaging timeline. " +
      "Patient verbalized understanding. No acute symptoms.",
  },
];

/** Convenience accessor for just the BM25-compatible fields. */
export function toBm25Docs(notes: EvidenceNote[] = EVIDENCE_CORPUS): Bm25Doc[] {
  return notes.map((n) => ({ id: n.id, text: n.text }));
}

/** Look up a single note by id — used by hybrid.ts when joining hits → doc metadata. */
export function getNoteById(
  id: string,
  corpus: EvidenceNote[] = EVIDENCE_CORPUS,
): EvidenceNote | undefined {
  return corpus.find((n) => n.id === id);
}

// ---------- Item 9: dynamic corpus from uploaded patient bundles ----------

import type { PatientEvidenceBundle } from "../../types/index.ts";

/**
 * Map a sourceType from PatientEvidenceItem to an EvidenceNoteCategory
 * so that dynamically built evidence notes have meaningful category labels.
 */
function mapSourceTypeToCategory(sourceType: string): EvidenceNoteCategory {
  const map: Record<string, EvidenceNoteCategory> = {
    lab: "lab",
    imaging: "imaging",
    medication: "medication",
    vitals: "vitals",
    oncology_note: "oncology_note",
    progress: "oncology_note",
    problem_list: "oncology_note",
    procedure: "outside_records",
    uploaded_record: "outside_records",
    outside_records: "outside_records",
    triage: "triage",
  };
  return map[sourceType] ?? "outside_records";
}

/**
 * Convert a PatientEvidenceBundle into EvidenceNote[] so the hybrid
 * retrieval pipeline can search over uploaded patient records.
 */
export function bundleToEvidenceNotes(
  bundle: PatientEvidenceBundle,
  patientId: string,
): EvidenceNote[] {
  return bundle.items.map((item, i) => ({
    id: `dyn-${patientId}-${i}`,
    patientId,
    text: `${item.label}: ${item.excerpt ?? item.numericValue ?? ""}${item.unit ? ` ${item.unit}` : ""}`,
    source: item.sourceSystem ?? item.sourceType,
    sourceSystem: item.sourceSystem ?? "Uploaded record",
    author: "Patient upload",
    sourceDate: item.sourceDate ?? new Date().toISOString().slice(0, 10),
    clinicalDate: item.temporalDate ?? item.sourceDate,
    category: mapSourceTypeToCategory(item.sourceType),
  }));
}
