/*
 * Collaboration + external-facing types — audit, PI handoff, referral packets,
 * sponsor views, compliance artifacts.
 *
 * Deidentification invariant: any type consumed by a sponsor-facing component
 * must not contain @phi-tagged fields from clinical.ts.
 */

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  eventType: string;
  summary: string;
  ruleVersion: string;
  promptVersion: string;
  modelVersion: string;
}

export interface PiHandoffPacket {
  id: string;
  owner: string;
  dueBy: string;
  decisionNeeded: string;
  summary: string;
  questions: string[];
  recommendedArtifacts: string[];
}

// --- External-facing (M3) ---

export interface ReferralPacket {
  referralId: string;
  publicToken: string;
  referringPhysician: { name: string; npi: string; email: string };
  patientIntake: {
    firstName: string;
    age: number;
    diagnosis: string;
    diseaseArea: string;
  };
  relatedTrialShortCode?: string;
  statusTimeline: Array<{ label: string; at: string; actor: string }>;
}

/**
 * Patient type the sponsor view is allowed to see.
 * Compare to Patient in clinical.ts — no name, no MRN, no exact age.
 * The deidentify() transform in src/features/sponsor/data/deidentify.ts
 * is the ONLY source of DeidentifiedPatient instances.
 */
export interface DeidentifiedPatient {
  ageBucket: "<50" | "50-64" | "65-74" | "75+";
  sex: "M" | "F" | "other" | "unknown";
  diseaseArea: string;
  stage: string;
  ecog: number;
  biomarkers: string[];
}

export interface SponsorView {
  sponsorKey: string;
  trialIds: string[];
  enrollmentVelocity: Array<{
    week: string;
    screened: number;
    enrolled: number;
  }>;
  siteBenchmarks: Array<{
    siteId: string;
    screened: number;
    enrolled: number;
    medianReviewHours: number;
  }>;
  deidentificationPolicyVersion: string;
}

export interface ComplianceArtifact {
  id: string;
  type: "spirit" | "consort" | "ich_e6" | "deviation_log";
  status: "draft" | "in_review" | "approved";
  trialId: string;
  lastEditedBy: string;
  diffBaseVersion?: string;
}

// --- Platform contract types (previously in src/types.ts) ---

export interface ApiEndpointContract {
  method: "GET" | "POST";
  path: string;
  summary: string;
  requestShape: string;
  responseShape: string;
  owner: string;
}

export interface EntityContract {
  name: string;
  purpose: string;
  keyFields: string[];
}

export interface IntegrationFeed {
  name: string;
  mode: string;
  freshness: string;
  role: string;
}

export interface PilotAcceptanceCard {
  label: string;
  status: "on_track" | "watch" | "risk";
  detail: string;
}
