/*
 * EvaluationStep — step 4 (F3 Criterion Evaluation matrix).
 *
 * The F3 evaluation uses a canned evidence corpus hardcoded for patient-001
 * (Angela Brooks). The patient context banner below makes this transparent
 * so reviewers know exactly whose data the LLM is reading.
 */

import { useMemo } from "react";
import { StatusChip } from "../../../components/StatusChip";
import { CriterionEvaluationMatrix } from "../../../components/aiFeatures/CriterionEvaluationMatrix";
import { getPatient } from "../../../data/mockData";
import { EVIDENCE_CORPUS } from "../../../lib/retrieval/evidenceCorpus";
import { StepShell } from "./StepShell";

/** The evidence corpus is hardcoded for this patient. */
const TARGET_PATIENT_ID = "patient-001";
const TARGET_TRIAL_CODE = "LU-021";

function PatientContextBanner() {
  const patient = getPatient(TARGET_PATIENT_ID);

  const evidenceStats = useMemo(() => {
    const notes = EVIDENCE_CORPUS.filter(
      (n) => n.patientId === TARGET_PATIENT_ID,
    );
    const categories = new Set(notes.map((n) => n.category));
    const dateRange =
      notes.length > 0
        ? `${notes[notes.length - 1].sourceDate} – ${notes[0].sourceDate}`
        : "—";
    return { count: notes.length, categories: categories.size, dateRange };
  }, []);

  if (!patient) return null;

  return (
    <div className="aif-patient-context">
      <div className="aif-patient-context__header">
        <div className="aif-patient-context__identity">
          <span className="aif-patient-context__eyebrow">
            Evaluating patient record
          </span>
          <strong className="aif-patient-context__name">{patient.name}</strong>
          <span className="aif-patient-context__detail">
            {patient.diagnosis} · {patient.stage} · {patient.ecog}
          </span>
        </div>
        <div className="aif-patient-context__chips">
          {patient.biomarkers.map((bm) => (
            <StatusChip key={bm} label={bm} tone="teal" compact />
          ))}
          <StatusChip label={`Trial ${TARGET_TRIAL_CODE}`} tone="paper" compact />
        </div>
      </div>
      <div className="aif-patient-context__evidence">
        <span className="aif-patient-context__evidence-label">
          Evidence corpus
        </span>
        <span>
          {evidenceStats.count} notes · {evidenceStats.categories} categories ·{" "}
          {evidenceStats.dateRange}
        </span>
        <span className="aif-patient-context__evidence-hint">
          All evidence is synthetic, fabricated for {patient.name} ({patient.mrn}
          ). No real PHI.
        </span>
      </div>
    </div>
  );
}

export function EvaluationStep() {
  return (
    <StepShell step="evaluation" runLabel="Run F3 evaluation">
      <PatientContextBanner />
      <CriterionEvaluationMatrix />
    </StepShell>
  );
}
