import type {
  Patient,
  PatientCatalogItem,
  PatientClinicalRecord,
} from "../types/clinical.ts";
import { clinicalRecords } from "./clinicalRecords.ts";
import { seedPatients } from "./patientSeedData.ts";

function buildFallbackPatient(record: PatientClinicalRecord): Patient {
  const primaryProblem = record.problemList[0];
  const diagnosis = primaryProblem?.description ?? "Uploaded clinical record";
  const lowerText = record.fullRecordText.toLowerCase();
  const diseaseArea =
    lowerText.includes("lung") || lowerText.includes("thoracic")
      ? "Thoracic Oncology"
      : lowerText.includes("breast")
        ? "Breast Oncology"
        : lowerText.includes("endometrial") || lowerText.includes("ovarian")
          ? "Gynecologic Oncology"
          : lowerText.includes("cholangio") || lowerText.includes("biliary")
            ? "GI Oncology"
            : "Imported clinical record";

  return {
    id: record.patientId,
    name: "Unknown patient",
    mrn: "MRN unavailable",
    age: record.demographics.age,
    sex: record.demographics.sex || "Unknown",
    diseaseArea,
    diagnosis,
    stage: "Stage unknown",
    ecog:
      record.ecogPerformanceStatus == null
        ? "ECOG unknown"
        : `ECOG ${record.ecogPerformanceStatus}`,
    careTeam: "Needs assignment",
    nextAppointment: "Not scheduled",
    biomarkers: [],
    summaryFlags: ["Seeded from clinical record"],
  };
}

const seededPatientIndex = new Map(
  seedPatients.map((patient: Patient) => [patient.id, patient] as const),
);

export const seedPatientCatalogItems: PatientCatalogItem[] = clinicalRecords.map(
  (record: PatientClinicalRecord) => ({
    patient: seededPatientIndex.get(record.patientId) ?? buildFallbackPatient(record),
    clinicalRecord: record,
    source: "seed",
    rawRecordText: record.fullRecordText,
    parseStatus: "structured",
    parseWarnings: [],
  }),
);
