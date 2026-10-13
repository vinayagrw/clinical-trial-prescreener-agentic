export type WindowHours = 24 | 48 | 72;

export type ClinicalDocumentType =
  | "progress_note"
  | "consult_note"
  | "lab_result"
  | "imaging_report"
  | "nursing_assessment"
  | "vitals"
  | "medication_admin"
  | "order";

export type FactPolarity = "present" | "absent" | "ambiguous";
export type FactCertainty = "high" | "medium" | "low";
export type HandoffStatus = "completed" | "needs_review";
export type DisagreementSeverity = "critical" | "high" | "moderate";

export interface SeedDocument {
  id: string;
  sourceId: string;
  patientId: string;
  encounterId: string;
  title: string;
  service: string;
  author: string;
  docType: ClinicalDocumentType;
  authoredAt: string;
  amendedAt?: string;
  sourceSystem: string;
  rawText: string;
  structuredPayload?: Record<string, unknown>;
}

export interface SeedEncounter {
  patientId: string;
  encounterId: string;
  patientName: string;
  maskedMrn: string;
  age: number;
  unit: string;
  primaryService: string;
  diagnosis: string;
  admissionReason: string;
  documents: SeedDocument[];
}

export interface ClinicalDocument extends SeedDocument {
  hash: string;
}

export interface ClinicalFact {
  id: string;
  patientId: string;
  encounterId: string;
  topic: string;
  assertion: string;
  polarity: FactPolarity;
  certainty: FactCertainty;
  value?: string;
  sourceDocId: string;
  quotedEvidence: string;
  authoredAt: string;
  service: string;
  extractor: "deterministic" | "heuristic";
}

export interface Citation {
  id: string;
  factId: string;
  documentId: string;
  documentTitle: string;
  service: string;
  authoredAt: string;
  quotedEvidence: string;
}

export interface DisagreementPosition {
  service: string;
  assertion: string;
  certainty: FactCertainty;
  authoredAt: string;
  citationIds: string[];
}

export interface Disagreement {
  id: string;
  topic: string;
  severity: DisagreementSeverity;
  summary: string;
  services: string[];
  positions: DisagreementPosition[];
  evidenceRefs: string[];
  recencyOrder: string[];
  requiresHumanReview: boolean;
}

export interface SbarBullet {
  id: string;
  text: string;
  citationIds: string[];
}

export interface SbarSummary {
  situation: SbarBullet[];
  background: SbarBullet[];
  assessment: SbarBullet[];
  recommendations: SbarBullet[];
  disagreements: Disagreement[];
  missingInfo: string[];
  citations: Citation[];
  generatedAt: string;
  status: HandoffStatus;
}

export interface AuditEvent {
  id: string;
  stage:
    | "ingestion"
    | "extraction"
    | "disagreement_detection"
    | "summarization"
    | "validation"
    | "persistence";
  summary: string;
  createdAt: string;
  detail: string;
  metrics?: Record<string, string | number | boolean>;
}

export interface HandoffRecord {
  id: string;
  patientId: string;
  encounterId: string;
  patientName: string;
  maskedMrn: string;
  age: number;
  unit: string;
  primaryService: string;
  diagnosis: string;
  windowHours: WindowHours;
  headline: string;
  nextAction: string;
  summary: SbarSummary;
  documents: ClinicalDocument[];
  facts: ClinicalFact[];
  audit: AuditEvent[];
}

export interface WorklistItem {
  handoffId: string;
  patientId: string;
  encounterId: string;
  patientName: string;
  maskedMrn: string;
  unit: string;
  primaryService: string;
  diagnosis: string;
  status: HandoffStatus;
  generatedAt: string;
  windowHours: WindowHours;
  openDisagreements: number;
  missingInfoCount: number;
  headline: string;
  nextAction: string;
}

export interface GenerateHandoffRequest {
  patientId?: string;
  encounterId?: string;
  windowHours?: number;
}

export interface RuntimeStorePayload {
  updatedAt: string;
  handoffs: HandoffRecord[];
}
