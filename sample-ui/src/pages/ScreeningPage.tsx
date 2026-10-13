import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/AppShell";
import { HumanReviewPanel } from "../components/HumanReviewPanel";
import { StatusChip } from "../components/StatusChip";
import { useDeleteUploadedPatientMutation, useUploadPatientRecordMutation } from "../data/queries/patientCatalog";
import { useTrialReviewCommitQuery } from "../data/queries/trialReviews";
import { getPatient, getNormalizedCriteriaForTrial, listScreenableTrials } from "../data/mockData";
import type { ProviderName, ProviderStatus } from "../lib/ai/providers";
import { isLocalApiOfflineError, normalizeLocalApiError } from "../lib/localApiErrors";
import { getEffectiveReviewOutput, useAiReviewRunSync } from "../lib/reviews";
import { getRuntimeMetadata } from "../lib/runtimeMetadata";
import { summarizeTrialAutomationReadiness } from "../lib/screening/patientTrialEvaluator";
import type { PatientClinicalRecord } from "../types";
import { useAiProvidersStore } from "../stores/aiProviders";
import { isImportedTrialId, useImportedTrialsStore } from "../stores/importedTrials";
import { useInstitutionalTrialsStore } from "../stores/institutionalTrials";
import {
  getClinicalRecordByPatientId,
  getPatientCatalogItemById,
  getScreenablePatientItems,
  usePatientCatalogStore,
} from "../stores/patientCatalog";
import { useScreeningStore } from "../stores/screening";
import { useUiStore } from "../stores/ui";
import {
  type ScreeningDiagnosticOutcome,
  type ScreeningDiagnosticRun,
  useScreeningDiagnosticsStore,
} from "../stores/screeningDiagnostics";
import type { PatientCatalogItem } from "../types";

function verdictTone(status: string): "moss" | "brick" | "amber" | "paper" {
  switch (status) {
    case "pass":
      return "moss";
    case "fail":
      return "brick";
    case "uncertain":
      return "amber";
    case "manual_review":
      return "paper";
    default:
      return "paper";
  }
}

function verdictLabel(status: string): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "uncertain":
      return "Uncertain";
    case "manual_review":
      return "Manual Review";
    default:
      return status;
  }
}

function eligibilityLabel(
  value: "eligible" | "not_eligible" | "requires_review" | null,
): string {
  switch (value) {
    case "eligible":
      return "ELIGIBLE";
    case "not_eligible":
      return "NOT ELIGIBLE";
    case "requires_review":
      return "REQUIRES REVIEW";
    default:
      return "Pending";
  }
}

function eligibilityTone(
  value: "eligible" | "not_eligible" | "requires_review" | null,
): "moss" | "brick" | "amber" | "paper" {
  switch (value) {
    case "eligible":
      return "moss";
    case "not_eligible":
      return "brick";
    case "requires_review":
      return "amber";
    default:
      return "paper";
  }
}

function formatWallTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function computeTotalWallTime(
  assessments: Record<string, { wallTimeMs?: number }>,
): number {
  return Object.values(assessments).reduce(
    (sum, assessment) => sum + (assessment.wallTimeMs ?? 0),
    0,
  );
}

function providerLabel(provider: ProviderName): string {
  switch (provider) {
    case "ollama":
      return "Ollama";
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Gemini";
    case "groq":
      return "Groq";
    case "anthropic":
      return "Anthropic";
    case "demo":
      return "Demo fixture";
    default:
      return provider;
  }
}

function providerTone(
  status: ProviderStatus,
): "moss" | "brick" | "amber" | "paper" {
  switch (status) {
    case "healthy":
      return "moss";
    case "unhealthy":
      return "brick";
    case "unknown":
      return "amber";
    case "disabled":
    default:
      return "paper";
  }
}

function providerStatusLabel(status: ProviderStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "unhealthy":
      return "Unhealthy";
    case "unknown":
      return "Unknown";
    case "disabled":
      return "Disabled";
    default:
      return status;
  }
}

function diagnosticOutcomeTone(
  outcome: ScreeningDiagnosticOutcome | null,
): "moss" | "amber" | "brick" | "paper" {
  switch (outcome) {
    case "f6_success":
      return "moss";
    case "live_failed_demo_fallback":
    case "f6_failed_deterministic_fallback":
      return "amber";
    case "fatal":
      return "brick";
    default:
      return "paper";
  }
}

function diagnosticOutcomeLabel(
  outcome: ScreeningDiagnosticOutcome | null,
): string {
  switch (outcome) {
    case "f6_success":
      return "F6 success";
    case "live_failed_demo_fallback":
      return "Demo fallback";
    case "f6_failed_deterministic_fallback":
      return "Deterministic fallback";
    case "fatal":
      return "Fatal";
    default:
      return "Pending";
  }
}

function diagnosticAttemptTone(
  run: ScreeningDiagnosticRun,
  status: ScreeningDiagnosticRun["providerAttempts"][number]["status"],
): "teal" | "moss" | "brick" | "amber" | "paper" {
  if (status === "succeeded") {
    return run.runtimeMode === "live" && run.finalProvider === "demo"
      ? "amber"
      : "moss";
  }
  if (status === "failed") return "brick";
  if (status === "started") return "teal";
  return "paper";
}

function formatDiagnosticTimestamp(value: string | null | undefined): string {
  if (!value) return "Pending";
  return new Date(value).toLocaleString();
}

function formatSchemaDetail(
  schemaPath: string | null | undefined,
  schemaMessage: string | null | undefined,
): string | null {
  if (schemaPath && schemaMessage) {
    return `${schemaPath}: ${schemaMessage}`;
  }
  return schemaPath ?? schemaMessage ?? null;
}

export function ScreeningPage() {
  // Individual selectors — each returns a stable reference, preventing the
  // infinite render loop that `useScreeningStore()` (no selector) caused.
  const screeningStatus = useScreeningStore((s) => s.status);
  const screeningAssessments = useScreeningStore((s) => s.assessments);
  const screeningCurrentCriterionId = useScreeningStore((s) => s.currentCriterionId);
  const screeningOverallEligibility = useScreeningStore((s) => s.overallEligibility);
  const screeningError = useScreeningStore((s) => s.error);
  const screeningMode = useScreeningStore((s) => s.screeningMode);
  const llmRuntime = useScreeningStore((s) => s.llmRuntime);
  const setPatient = useScreeningStore((s) => s.setPatient);
  const setTrial = useScreeningStore((s) => s.setTrial);
  const setScreeningMode = useScreeningStore((s) => s.setScreeningMode);
  const runScreening = useScreeningStore((s) => s.runScreening);
  const resetScreening = useScreeningStore((s) => s.reset);
  const aiProviderHealth = useAiProvidersStore((state) => state.health);
  const aiProviderOrder = useAiProvidersStore((state) => state.order);
  const aiDemoMode = useAiProvidersStore((state) => state.demoMode);
  const setAiDemoMode = useAiProvidersStore((state) => state.setDemoMode);
  const refreshAiProviders = useAiProvidersStore((state) => state.refresh);
  const diagnosticRuns = useScreeningDiagnosticsStore((state) => state.runs);
  const clearDiagnostics = useScreeningDiagnosticsStore((state) => state.clear);

  const importedTrialsUpdatedAt = useImportedTrialsStore((state) => state.updatedAt);
  const importedTrialItems = useImportedTrialsStore((state) => state.items);
  const institutionalTrialsUpdatedAt = useInstitutionalTrialsStore(
    (state) => state.updatedAt,
  );
  const patientCatalogItems = usePatientCatalogStore((state) => state.items);
  const patientCatalogStatus = usePatientCatalogStore((state) => state.status);
  const patientCatalogError = usePatientCatalogStore((state) => state.error);
  const pushToast = useUiStore((state) => state.pushToast);
  const resultsRef = useRef<HTMLDivElement>(null);
  const uploadMutation = useUploadPatientRecordMutation();
  const deleteMutation = useDeleteUploadedPatientMutation();
  const isPatientCatalogOffline = isLocalApiOfflineError(patientCatalogError);
  const patientCatalogStatusLabel =
    patientCatalogStatus === "loading"
      ? "Catalog loading"
      : patientCatalogStatus === "error"
        ? isPatientCatalogOffline
          ? "API offline"
          : "Catalog error"
        : "Server catalog ready";
  const normalizedUploadError = uploadMutation.isError
    ? normalizeLocalApiError(uploadMutation.error, "Unable to upload patient record.")
    : null;
  const runtimeMetadata = useMemo(() => getRuntimeMetadata(), []);

  const screenablePatientItems = useMemo(
    () => getScreenablePatientItems(),
    [patientCatalogItems],
  );
  const uploadedPatientItems = useMemo(
    () => screenablePatientItems.filter((item) => item.source === "upload"),
    [screenablePatientItems],
  );
  const patientOptions = useMemo(
    () =>
      screenablePatientItems.map((item) => ({
        id: item.patient.id,
        label: `${item.patient.name} | ${item.patient.mrn}`,
      })),
    [screenablePatientItems],
  );
  const trialOptions = useMemo(
    () => listScreenableTrials(),
    [importedTrialsUpdatedAt, institutionalTrialsUpdatedAt],
  );

  const [selectedPatientId, setSelectedPatientId] = useState(
    () => patientOptions[0]?.id ?? "",
  );
  const [selectedTrialId, setSelectedTrialId] = useState(
    () => trialOptions[0]?.id ?? "",
  );
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    setPatient(selectedPatientId);
  }, [selectedPatientId, setPatient]);

  useEffect(() => {
    setTrial(selectedTrialId);
  }, [selectedTrialId, setTrial]);

  useEffect(() => {
    if (
      selectedPatientId &&
      patientOptions.some((option) => option.id === selectedPatientId)
    ) {
      return;
    }

    setSelectedPatientId(patientOptions[0]?.id ?? "");
  }, [patientOptions, selectedPatientId]);

  useEffect(() => {
    if (
      selectedTrialId &&
      trialOptions.some((option) => option.id === selectedTrialId)
    ) {
      return;
    }

    setSelectedTrialId(trialOptions[0]?.id ?? "");
  }, [selectedTrialId, trialOptions]);

  const prevTrialRef = useRef(selectedTrialId);
  useEffect(() => {
    if (prevTrialRef.current !== selectedTrialId && screeningStatus !== "idle") {
      resetScreening();
    }
    prevTrialRef.current = selectedTrialId;
  }, [selectedTrialId, screeningStatus, resetScreening]);

  useEffect(() => {
    if (screeningStatus === "running" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [screeningStatus]);

  const clinicalRecord: PatientClinicalRecord | undefined = useMemo(
    () => getClinicalRecordByPatientId(selectedPatientId),
    [patientCatalogItems, selectedPatientId],
  );
  const selectedPatientItem = useMemo(
    () => getPatientCatalogItemById(selectedPatientId),
    [patientCatalogItems, selectedPatientId],
  );
  const patientName = useMemo(() => {
    const patient = getPatient(selectedPatientId);
    if (patient) return patient.name;
    return selectedPatientId;
  }, [selectedPatientId, patientCatalogItems]);
  const selectedImportedProjection = useMemo(
    () =>
      importedTrialItems.find((item) => item.projection.id === selectedTrialId)
        ?.projection ?? null,
    [importedTrialItems, selectedTrialId],
  );
  const excludedScreeningTrialsCount = useMemo(
    () =>
      importedTrialItems.filter(
        (item) => item.projection.screeningIntent === "retrospective_manual_only",
      ).length,
    [importedTrialItems],
  );
  const criteria = useMemo(
    () => getNormalizedCriteriaForTrial(selectedTrialId),
    [importedTrialsUpdatedAt, institutionalTrialsUpdatedAt, selectedTrialId],
  );
  const selectedTrialReadiness = useMemo(
    () =>
      summarizeTrialAutomationReadiness(
        criteria,
        selectedImportedProjection,
      ),
    [criteria, selectedImportedProjection],
  );
  const totalWallTime = useMemo(
    () => computeTotalWallTime(screeningAssessments),
    [screeningAssessments],
  );

  const criteriaIdSet = useMemo(
    () => new Set(criteria.map((criterion) => criterion.id)),
    [criteria],
  );
  const unmappedAssessments = useMemo(
    () =>
      Object.entries(screeningAssessments).filter(
        ([criterionId]) => !criteriaIdSet.has(criterionId),
      ),
    [criteriaIdSet, screeningAssessments],
  );
  const assessedCount = useMemo(
    () =>
      criteria.reduce(
        (count, criterion) =>
          screeningAssessments[criterion.id] ? count + 1 : count,
        0,
      ),
    [criteria, screeningAssessments],
  );
  const uploadedCount = uploadedPatientItems.length;
  const activeProviderOrder = useMemo(
    () => (aiDemoMode ? (["demo"] as ProviderName[]) : aiProviderOrder),
    [aiDemoMode, aiProviderOrder],
  );
  const fullRecordModeLabel = aiDemoMode
    ? "Full-record LLM (Demo fixture)"
    : "Full-record LLM (Live provider)";
  const fullRecordModeDescription = aiDemoMode
    ? "Demo fixture reads the full record with no live external provider call."
    : "Live provider chain reads the full record, then falls back visibly if the active provider fails.";
  const activeDiagnosticRun = useMemo(
    () =>
      llmRuntime.diagnosticRunId
        ? diagnosticRuns.find((run) => run.id === llmRuntime.diagnosticRunId) ??
          diagnosticRuns[0] ??
          null
        : diagnosticRuns[0] ?? null,
    [diagnosticRuns, llmRuntime.diagnosticRunId],
  );
  const runtimeSummary = useMemo(() => {
    if (llmRuntime.summary) return llmRuntime.summary;
    if (screeningMode !== "full_record_llm") return null;
    if (aiDemoMode) {
      return "Demo fixture is active. Switch to Live providers to attempt a real LLM call from Screening.";
    }
    return "Live providers are active. Health badges reflect connectivity, while runtime quota errors still surface during a run.";
  }, [aiDemoMode, llmRuntime.summary, screeningMode]);
  const runtimeSummaryTone = useMemo(() => {
    if (llmRuntime.outcome) return diagnosticOutcomeTone(llmRuntime.outcome);
    return aiDemoMode ? "amber" : "paper";
  }, [aiDemoMode, llmRuntime.outcome]);
  const screeningReviewRun = useAiReviewRunSync(
    screeningStatus === "done"
      ? {
          sourceKey: `screening:${selectedPatientId}:${selectedTrialId}:${screeningMode}`,
          featureKey:
            screeningMode === "full_record_llm"
              ? "F6_full_record_eligibility"
              : "screening_deterministic_first",
          featureLabel:
            screeningMode === "full_record_llm"
              ? "F6 Full-record eligibility"
              : "Deterministic-first screening",
          stageKey: "screening",
          workspace: "trial_screening",
          entityType: "patient_trial_screen",
          entityId: `${selectedPatientId}:${selectedTrialId}`,
          entityLabel: `${patientName} × ${selectedTrialId}`,
          deepLink: "/screening",
          summary: `${Object.keys(screeningAssessments).length} criteria evaluated with an overall ${screeningOverallEligibility ?? "pending"} result.`,
          promptSnapshot: {
            screeningMode,
            runtimeMode: llmRuntime.runtimeMode,
            providerOrder: llmRuntime.attemptedProviders,
          },
          inputSnapshot: {
            patientId: selectedPatientId,
            trialId: selectedTrialId,
            screeningMode,
          },
          outputSnapshot: {
            assessments: screeningAssessments,
            overallEligibility: screeningOverallEligibility,
            screeningMode,
          },
          provider:
            llmRuntime.finalProvider ??
            Object.values(screeningAssessments)[0]?.provider ??
            null,
          model:
            Object.values(screeningAssessments)[0]?.model ??
            null,
          policy: "required_before_apply",
          allowedActions: [
            "approve_as_is",
            "edit_output",
            "modify_evidence",
            "edit_input_and_rerun",
            "override",
            "reject",
            "escalate_manual_review",
            "finalize_apply",
            "revert_to_ai_draft",
          ],
          commitTargetType: "trial_review",
          commitTargetId: `${selectedPatientId}:${selectedTrialId}`,
          editableFields: ["inputSnapshot", "outputSnapshot", "citations"],
          requiredFields: ["rationale"],
          citations: Object.values(screeningAssessments).flatMap((assessment) =>
            assessment.evidenceIds.map((evidenceId) => ({
              id: `${assessment.id}-${evidenceId}`,
              label: `${assessment.label} · ${evidenceId}`,
              detail: assessment.summary,
              quote: assessment.reasoning,
              tone:
                assessment.status === "pass"
                  ? "supporting"
                  : assessment.status === "fail"
                    ? "warning"
                    : "context",
            })),
          ),
          safetyFlags: [
            ...Object.values(screeningAssessments)
              .filter(
                (assessment) =>
                  assessment.status === "uncertain" ||
                  assessment.status === "manual_review",
              )
              .map((assessment) => ({
                id: `review-${assessment.id}`,
                label: `${assessment.label} needs reviewer resolution`,
                detail: assessment.reasoning,
                severity: "warning" as const,
              })),
            ...(unmappedAssessments.length > 0
              ? [
                  {
                    id: "screening-contract-drift",
                    label: "Result / criterion contract drift",
                    detail: "Some returned assessments were not mapped to canonical trial criteria.",
                    severity: "critical" as const,
                  },
                ]
              : []),
          ],
        }
      : null,
  );
  const trialReviewEntityId =
    selectedPatientId && selectedTrialId
      ? `${selectedPatientId}:${selectedTrialId}`
      : undefined;
  const committedTrialReviewQuery = useTrialReviewCommitQuery(trialReviewEntityId);
  const reviewedScreeningResult = getEffectiveReviewOutput(screeningReviewRun.run, {
    assessments: screeningAssessments,
    overallEligibility: screeningOverallEligibility,
    screeningMode,
  });
  const displayAssessments = reviewedScreeningResult.assessments ?? screeningAssessments;
  const displayOverallEligibility =
    reviewedScreeningResult.overallEligibility ?? screeningOverallEligibility;

  const handleUploadRecord = useCallback(
    async (rawRecordText: string, fileName: string) => {
      const item = await uploadMutation.mutateAsync({
        fileName,
        rawRecordText,
      });
      setUploadedFileName(fileName);
      setSelectedPatientId(item.patient.id);
      if (screeningStatus !== "idle") {
        resetScreening();
      }
    },
    [screeningStatus, resetScreening, uploadMutation],
  );

  const handleRemovePatient = useCallback(
    async (item: PatientCatalogItem) => {
      const confirmationTitle =
        item.source === "upload"
          ? `Permanently delete uploaded patient ${item.patient.name}?`
          : `Permanently remove demo patient ${item.patient.name} from this app?`;
      const confirmationBody =
        item.source === "upload"
          ? "This removes the uploaded clinical record from the shared runtime store and it will stay deleted after refresh or server restart."
          : "This hides the seeded demo patient everywhere in the app and keeps it removed across refresh and server restart.";
      if (
        typeof window !== "undefined" &&
        !window.confirm(`${confirmationTitle}\n\n${confirmationBody}`)
      ) {
        return;
      }

      await deleteMutation.mutateAsync(item.patient.id);
      if (selectedPatientId === item.patient.id) {
        const fallback =
          screenablePatientItems.find((candidate) => candidate.patient.id !== item.patient.id)
            ?.patient.id ?? "";
        setSelectedPatientId(fallback);
      }
      if (screeningStatus !== "idle") {
        resetScreening();
      }
      pushToast({
        title:
          item.source === "upload"
            ? `Deleted uploaded patient ${item.patient.name}`
            : `Removed demo patient ${item.patient.name}`,
        description:
          item.source === "upload"
            ? "The uploaded patient record was permanently deleted from the app."
            : "The demo patient was removed from all shared patient surfaces in the app.",
        tone: "success",
      });
    },
    [
      deleteMutation,
      pushToast,
      resetScreening,
      screenablePatientItems,
      screeningStatus,
      selectedPatientId,
    ],
  );
  const handleRuntimeToggle = useCallback(
    (mode: "demo" | "live") => {
      setAiDemoMode(mode === "demo");
      void refreshAiProviders();
      if (screeningStatus !== "idle") {
        resetScreening();
      }
    },
    [refreshAiProviders, resetScreening, screeningStatus, setAiDemoMode],
  );

  return (
    <AppShell
      title="Live Eligibility Screening"
      subtitle="Select a patient and trial, then run the AI screening pipeline to evaluate each criterion in real time."
    >
      <div className="screening-workspace">
        <section className="surface screening-workspace__patients">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Patients in system</p>
              <h3>Select a patient to screen against clinical trials</h3>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <StatusChip
                label={`${screenablePatientItems.length} patients loaded`}
                tone="teal"
                compact
              />
              <StatusChip
                label={patientCatalogStatusLabel}
                tone={
                  patientCatalogStatus === "error"
                    ? "brick"
                    : patientCatalogStatus === "loading"
                      ? "amber"
                      : "paper"
                }
                compact
              />
            </div>
          </div>

          {patientCatalogError ? (
            <p style={{ color: "var(--brick)", marginTop: "var(--space-2)" }}>
              {patientCatalogError}
            </p>
          ) : null}

          <div className="screening-patients-grid">
            {screenablePatientItems.map((item, index) => {
              const patient = item.patient;
              const record = item.clinicalRecord;
              const isSelected = selectedPatientId === patient.id;
              const isUploaded = item.source === "upload";
              const primaryDiagnosis =
                record.problemList[0]?.description ?? patient.diagnosis ?? "Unknown";
              const flaggedLabs = record.labs.filter(
                (lab) => lab.flag && lab.flag !== "normal",
              ).length;

              return (
                <button
                  key={patient.id}
                  type="button"
                  className={`screening-patient-card ${isUploaded ? "screening-patient-card--uploaded" : ""} ${isSelected ? "screening-patient-card--selected" : ""}`}
                  style={{ ["--i" as string]: index }}
                  onClick={() => {
                    setSelectedPatientId(patient.id);
                    if (screeningStatus !== "idle") resetScreening();
                  }}
                >
                  <div className="screening-patient-card__name">{patient.name}</div>
                  <div className="screening-patient-card__diagnosis">
                    {primaryDiagnosis}
                  </div>
                  <div className="screening-patient-card__facts">
                    {record.demographics.age != null ? (
                      <StatusChip
                        label={`Age ${record.demographics.age}`}
                        tone="paper"
                        compact
                      />
                    ) : null}
                    {record.demographics.sex ? (
                      <StatusChip
                        label={record.demographics.sex}
                        tone="paper"
                        compact
                      />
                    ) : null}
                    {record.ecogPerformanceStatus != null ? (
                      <StatusChip
                        label={`ECOG ${record.ecogPerformanceStatus}`}
                        tone={record.ecogPerformanceStatus <= 1 ? "moss" : "amber"}
                        compact
                      />
                    ) : null}
                    {patient.biomarkers.slice(0, 2).map((biomarker) => (
                      <StatusChip key={biomarker} label={biomarker} tone="teal" compact />
                    ))}
                    {isUploaded ? (
                      <StatusChip label="Uploaded" tone="amber" compact />
                    ) : null}
                    {isUploaded && item.parseStatus !== "structured" ? (
                      <StatusChip label={item.parseStatus} tone="paper" compact />
                    ) : null}
                  </div>
                  <div className="screening-patient-card__meta">
                    <span>
                      {record.labs.length} labs captured | {flaggedLabs} flagged
                    </span>
                    <span>{record.notes.length} clinical notes</span>
                  </div>
                  {isSelected ? <StatusChip label="Selected" tone="teal" compact /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="surface screening-workspace__selectors">
          <div>
            <p className="eyebrow-label">Live eligibility screening</p>
            <h3>Select a patient and trial to begin</h3>
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <select
                value={selectedPatientId}
                onChange={(event) => setSelectedPatientId(event.target.value)}
                aria-label="Select patient"
              >
                {patientOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedPatientItem?.source === "upload" ? (
                <StatusChip label="Uploaded patient" tone="amber" compact />
              ) : (
                <StatusChip label="Seed patient" tone="paper" compact />
              )}
              {selectedPatientItem?.source === "upload" &&
              selectedPatientItem.parseStatus !== "structured" ? (
                <StatusChip
                  label={selectedPatientItem.parseStatus}
                  tone="paper"
                  compact
                />
              ) : null}
            </div>

            <select
              value={selectedTrialId}
              onChange={(event) => setSelectedTrialId(event.target.value)}
              aria-label="Select trial"
            >
              {trialOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {excludedScreeningTrialsCount > 0 ? (
            <p
              style={{
                marginTop: "var(--space-3)",
                fontSize: "var(--text-sm, 0.875rem)",
                color: "var(--text-muted, rgba(25, 39, 33, 0.68))",
              }}
            >
              {excludedScreeningTrialsCount} imported retrospective/manual-only{" "}
              {excludedScreeningTrialsCount === 1 ? "trial stays" : "trials stay"}{" "}
              available in Trial Admin for onboarding context, but are
              intentionally excluded from live prospective screening.
            </p>
          ) : null}

          <div style={{ marginTop: "var(--space-3)" }}>
            <p className="eyebrow-label">Screening Mode</p>
            <div
              style={{
                display: "flex",
                gap: "var(--space-4)",
                marginTop: "var(--space-2)",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-2)",
                  cursor: screeningStatus === "running" ? "not-allowed" : "pointer",
                  opacity: screeningStatus === "running" ? 0.5 : 1,
                }}
              >
                <input
                  type="radio"
                  name="screeningMode"
                  value="deterministic_first"
                  checked={screeningMode === "deterministic_first"}
                  onChange={() => setScreeningMode("deterministic_first")}
                  disabled={screeningStatus === "running"}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: "var(--text-sm, 0.875rem)" }}>
                    Deterministic-first
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs, 0.75rem)",
                      opacity: 0.6,
                    }}
                  >
                    Per-criterion evaluation with deterministic rules and AI fallback
                  </div>
                </div>
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-2)",
                  cursor: screeningStatus === "running" ? "not-allowed" : "pointer",
                  opacity: screeningStatus === "running" ? 0.5 : 1,
                }}
              >
                <input
                  type="radio"
                  name="screeningMode"
                  value="full_record_llm"
                  checked={screeningMode === "full_record_llm"}
                  onChange={() => setScreeningMode("full_record_llm")}
                  disabled={screeningStatus === "running"}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: "var(--text-sm, 0.875rem)" }}>
                    {fullRecordModeLabel}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs, 0.75rem)",
                      opacity: 0.6,
                    }}
                  >
                    {fullRecordModeDescription}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <section className="screening-runtime-panel">
            <div className="screening-runtime-panel__header">
              <div>
                <p className="eyebrow-label">AI runtime</p>
                <h4>Full-record mode and provider chain</h4>
              </div>
              <div className="stacked-chips">
                <StatusChip
                  label={aiDemoMode ? "Demo runtime" : "Live runtime"}
                  tone={aiDemoMode ? "amber" : "teal"}
                  compact
                />
                <StatusChip
                  label={runtimeMetadata.buildMode === "dev" ? "Dev build" : "Preview build"}
                  tone={runtimeMetadata.buildMode === "dev" ? "teal" : "paper"}
                  compact
                />
                {runtimeMetadata.clientPort ? (
                  <StatusChip label={`Port ${runtimeMetadata.clientPort}`} tone="paper" compact />
                ) : null}
                <StatusChip
                  label={`Build ${runtimeMetadata.buildStamp}`}
                  tone="paper"
                  compact
                />
              </div>
            </div>

            <div className="screening-runtime-panel__controls">
              <div className="tab-strip" role="tablist" aria-label="Full-record runtime mode">
                <button
                  type="button"
                  className={`tab-button ${aiDemoMode ? "tab-button--active" : ""}`.trim()}
                  disabled={screeningStatus === "running"}
                  onClick={() => handleRuntimeToggle("demo")}
                >
                  Demo fixture
                </button>
                <button
                  type="button"
                  className={`tab-button ${!aiDemoMode ? "tab-button--active" : ""}`.trim()}
                  disabled={screeningStatus === "running"}
                  onClick={() => handleRuntimeToggle("live")}
                >
                  Live providers
                </button>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={screeningStatus === "running"}
                onClick={() => {
                  void refreshAiProviders();
                }}
              >
                Refresh provider health
              </button>
            </div>

            <p className="screening-runtime-panel__caption">
              Demo fixture guarantees a safe offline run. Live runtime uses the configured
              provider order and still falls back visibly if a provider errors out.
              Health badges reflect connectivity, while quota failures appear during the
              actual run.
            </p>

            <div className="screening-runtime-panel__providers">
              {activeProviderOrder.map((provider) => (
                <article key={provider} className="screening-runtime-provider">
                  <div className="screening-runtime-provider__top">
                    <strong>{providerLabel(provider)}</strong>
                    <StatusChip
                      label={providerStatusLabel(aiProviderHealth[provider] ?? "unknown")}
                      tone={providerTone(aiProviderHealth[provider] ?? "unknown")}
                      compact
                    />
                  </div>
                  <p>
                    {provider === "demo"
                      ? "Fixture-backed local fallback used for safe demos and offline testing."
                      : "Checked in the current client session and available in the live failover chain."}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: "var(--space-3)",
            }}
          >
            <button
              className="primary-button"
              disabled={
                screeningStatus === "running" ||
                !selectedPatientId ||
                !selectedTrialId
              }
              onClick={() => runScreening()}
            >
              Run Screening
            </button>

            {screeningStatus !== "idle" ? (
              <button className="secondary-button" onClick={() => resetScreening()}>
                Reset
              </button>
            ) : null}

            {screeningStatus === "running" ? (
              <StatusChip label="Evaluating..." tone="amber" />
            ) : null}

            {screeningStatus === "done" && displayOverallEligibility ? (
              <StatusChip
                label={eligibilityLabel(displayOverallEligibility)}
                tone={eligibilityTone(displayOverallEligibility)}
              />
            ) : null}

            {screeningStatus === "error" ? (
              <StatusChip label="Error" tone="brick" />
            ) : null}

            {isImportedTrialId(selectedTrialId) ? (
              <>
                <StatusChip label="Registry draft" tone="paper" compact />
                <StatusChip
                  label={selectedTrialReadiness.label}
                  tone={
                    selectedTrialReadiness.label === "Screenable"
                      ? "moss"
                      : selectedTrialReadiness.label === "Partial automation"
                        ? "amber"
                        : "paper"
                  }
                  compact
                />
              </>
            ) : null}
          </div>

          {screeningError ? (
            <p style={{ color: "var(--brick)", marginTop: "var(--space-2)" }}>
              {screeningError}
            </p>
          ) : null}

          {screeningMode === "full_record_llm" && runtimeSummary ? (
            <div className="screening-runtime-summary">
              <div className="screening-runtime-summary__top">
                <div>
                  <p className="eyebrow-label">Full-record status</p>
                  <strong>{runtimeSummary}</strong>
                </div>
                <div className="stacked-chips">
                  <StatusChip
                    label={
                      llmRuntime.outcome
                        ? diagnosticOutcomeLabel(llmRuntime.outcome)
                        : aiDemoMode
                          ? "Demo fixture armed"
                          : "Live path armed"
                    }
                    tone={runtimeSummaryTone}
                    compact
                  />
                  {llmRuntime.finalProvider ? (
                    <StatusChip
                      label={`Final ${providerLabel(llmRuntime.finalProvider)}`}
                      tone={llmRuntime.finalProvider === "demo" ? "amber" : "teal"}
                      compact
                    />
                  ) : null}
                  {llmRuntime.fallbackPath !== "none" ? (
                    <StatusChip
                      label={`Fallback ${llmRuntime.fallbackPath.replace(/_/g, " ")}`}
                      tone="amber"
                      compact
                    />
                  ) : null}
                </div>
              </div>
              <p className="screening-runtime-summary__hint">
                {aiDemoMode
                  ? "Demo fixture is active, so Screening will not attempt a live external provider until you switch runtime modes."
                  : "Live runtime is active. If the primary provider fails, Screening keeps the page alive and records the fallback path below."}
              </p>
            </div>
          ) : null}

          {isImportedTrialId(selectedTrialId) ? (
            <p style={{ marginTop: "var(--space-2)", opacity: 0.72 }}>
              Imported trial readiness: {selectedTrialReadiness.detail}. Local activation
              remains unverified, so screening stays read-only and human-reviewed.
            </p>
          ) : null}
        </section>

        <section className="screening-upload-area screening-workspace__upload">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Upload patient record</p>
              <h3>Upload or paste a de-identified clinical record (.txt)</h3>
            </div>
            {uploadedCount > 0 ? (
              <StatusChip label={`${uploadedCount} uploaded`} tone="teal" compact />
            ) : null}
          </div>

          <div className="screening-upload-controls">
            <label className="screening-file-input">
              <input
                type="file"
                accept=".txt,.text"
                disabled={uploadMutation.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (loadEvent) => {
                    const text = loadEvent.target?.result;
                    if (typeof text === "string") {
                      void handleUploadRecord(text, file.name);
                    }
                  };
                  reader.readAsText(file);
                  event.target.value = "";
                }}
              />
              <span className="primary-button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 1v10M4 5l4-4 4 4M2 14h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {uploadMutation.isPending ? "Uploading..." : "Upload .txt file"}
              </span>
            </label>

            <span className="screening-upload-or">or paste below</span>

            <div className="screening-sample-links">
              <span className="eyebrow-label">Download samples:</span>
              <a
                href="/sample-patients/angela-brooks-clinical-record.txt"
                download
                className="ghost-link"
              >
                Angela Brooks
              </a>
              <a
                href="/sample-patients/diane-foster-clinical-record.txt"
                download
                className="ghost-link"
              >
                Diane Foster
              </a>
              <a
                href="/sample-patients/robert-hale-clinical-record.txt"
                download
                className="ghost-link"
              >
                Robert Hale
              </a>
            </div>
          </div>

          <textarea
            className="textarea screening-paste-area"
            placeholder="Paste a clinical record here - demographics, labs, medications, pathology, imaging, progress notes..."
            value={pasteText}
            onChange={(event) => {
              setPasteText(event.target.value);
            }}
            rows={4}
          />

          {pasteText.trim().length > 50 ? (
            <button
              type="button"
              className="primary-button"
              disabled={uploadMutation.isPending}
              onClick={() => {
                void handleUploadRecord(pasteText, "Pasted record");
                setPasteText("");
              }}
            >
              {uploadMutation.isPending
                ? "Saving uploaded patient..."
                : "Add pasted record to patient list"}
            </button>
          ) : null}

          {pasteText.trim().length > 0 && pasteText.trim().length <= 50 ? (
            <p className="screening-upload-status">
              <span>Type at least 50 characters to enable adding the record</span>
            </p>
          ) : null}

          {uploadedFileName ? (
            <p className="screening-upload-status">
              <span>Last uploaded: {uploadedFileName}</span>
            </p>
          ) : null}

          {uploadMutation.isError ? (
            <p style={{ color: "var(--brick)" }}>
              {normalizedUploadError}
            </p>
          ) : null}
        </section>

        <div className="screening-workspace__record-col screening-workspace__record">
          {clinicalRecord ? (
            <details open className="surface">
              <summary>Patient clinical record &mdash; {patientName}</summary>

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                  marginTop: "var(--space-3)",
                  alignItems: "center",
                }}
              >
                <StatusChip
                  label={
                    selectedPatientItem?.source === "upload"
                      ? "Server catalog upload"
                      : "Seed clinical record"
                  }
                  tone={selectedPatientItem?.source === "upload" ? "amber" : "paper"}
                  compact
                />
                {selectedPatientItem?.parseStatus &&
                selectedPatientItem.parseStatus !== "structured" ? (
                  <StatusChip
                    label={selectedPatientItem.parseStatus}
                    tone="paper"
                    compact
                  />
                ) : null}
                {selectedPatientItem?.fileName ? (
                  <StatusChip label={selectedPatientItem.fileName} tone="slate" compact />
                ) : null}
                {selectedPatientItem?.uploadedAt ? (
                  <StatusChip
                    label={`Uploaded ${new Date(
                      selectedPatientItem.uploadedAt,
                    ).toLocaleString()}`}
                    tone="slate"
                    compact
                  />
                ) : null}
                {selectedPatientItem ? (
                  <button
                    type="button"
                    className="ghost-link"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      void handleRemovePatient(selectedPatientItem);
                    }}
                  >
                    {deleteMutation.isPending
                      ? "Removing..."
                      : selectedPatientItem.source === "upload"
                        ? "Delete uploaded patient"
                        : "Remove demo patient"}
                  </button>
                ) : null}
              </div>

              {selectedPatientItem?.parseWarnings?.length ? (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <p className="eyebrow-label">Parse warnings</p>
                  <ul
                    style={{
                      paddingLeft: "var(--space-4)",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    {selectedPatientItem.parseWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {deleteMutation.isError ? (
                <p style={{ color: "var(--brick)", marginTop: "var(--space-2)" }}>
                  {deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : "Unable to remove patient."}
                </p>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                  marginTop: "var(--space-3)",
                }}
              >
                {clinicalRecord.demographics.age != null ? (
                  <StatusChip
                    label={`Age ${clinicalRecord.demographics.age}`}
                    tone="slate"
                    compact
                  />
                ) : null}
                {clinicalRecord.demographics.sex ? (
                  <StatusChip
                    label={clinicalRecord.demographics.sex}
                    tone="slate"
                    compact
                  />
                ) : null}
                {clinicalRecord.ecogPerformanceStatus != null ? (
                  <StatusChip
                    label={`ECOG ${clinicalRecord.ecogPerformanceStatus}`}
                    tone="slate"
                    compact
                  />
                ) : null}
                {clinicalRecord.demographics.weight ? (
                  <StatusChip
                    label={clinicalRecord.demographics.weight}
                    tone="slate"
                    compact
                  />
                ) : null}
                {clinicalRecord.demographics.bmi ? (
                  <StatusChip
                    label={`BMI ${clinicalRecord.demographics.bmi}`}
                    tone="slate"
                    compact
                  />
                ) : null}
              </div>

              <div style={{ marginTop: "var(--space-4)" }}>
                <p className="eyebrow-label">Problem list</p>
                {clinicalRecord.problemList.length > 0 ? (
                  <ul
                    style={{
                      paddingLeft: "var(--space-4)",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    {clinicalRecord.problemList.map((problem, index) => (
                      <li key={index}>
                        {problem.code} &mdash; {problem.description} (onset {problem.onset})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ marginTop: "var(--space-2)", opacity: 0.72 }}>
                    No structured problems parsed yet.
                  </p>
                )}
              </div>

              <div style={{ marginTop: "var(--space-4)" }}>
                <p className="eyebrow-label">Laboratory results</p>
                {clinicalRecord.labs.length > 0 ? (
                  <table
                    className="data-table"
                    style={{ marginTop: "var(--space-2)", width: "100%" }}
                  >
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Value</th>
                        <th>Reference Range</th>
                        <th>Flag</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicalRecord.labs.map((lab, index) => (
                        <tr key={index}>
                          <td>{lab.test}</td>
                          <td>
                            {lab.value} {lab.unit}
                          </td>
                          <td>{lab.referenceRange}</td>
                          <td>
                            {lab.flag && lab.flag !== "normal" ? (
                              <StatusChip
                                label={lab.flag.toUpperCase()}
                                tone={
                                  lab.flag === "low" || lab.flag === "high"
                                    ? "amber"
                                    : lab.flag === "critical"
                                      ? "brick"
                                      : "slate"
                                }
                                compact
                              />
                            ) : (
                              <span style={{ opacity: 0.5 }}>normal</span>
                            )}
                          </td>
                          <td>{lab.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ marginTop: "var(--space-2)", opacity: 0.72 }}>
                    No structured labs parsed yet.
                  </p>
                )}
              </div>

              <div style={{ marginTop: "var(--space-4)" }}>
                <p className="eyebrow-label">Current medications</p>
                {clinicalRecord.medications.length > 0 ? (
                  <table
                    className="data-table"
                    style={{ marginTop: "var(--space-2)", width: "100%" }}
                  >
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Route</th>
                        <th>Status</th>
                        <th>Dates</th>
                        <th>Indication</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicalRecord.medications.map((medication, index) => (
                        <tr key={index}>
                          <td>{medication.name}</td>
                          <td>{medication.route}</td>
                          <td>
                            <StatusChip
                              label={medication.status}
                              tone={medication.status === "active" ? "moss" : "slate"}
                              compact
                            />
                          </td>
                          <td>
                            {medication.startDate}
                            {medication.endDate ? ` - ${medication.endDate}` : ""}
                          </td>
                          <td>{medication.indication ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ marginTop: "var(--space-2)", opacity: 0.72 }}>
                    No structured medications parsed yet.
                  </p>
                )}
              </div>

              <div style={{ marginTop: "var(--space-4)" }}>
                <p className="eyebrow-label">Clinical notes</p>
                {clinicalRecord.notes.length > 0 ? (
                  clinicalRecord.notes.map((note, index) => (
                    <article
                      key={index}
                      className="evidence-card"
                      style={{ marginTop: "var(--space-3)" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "var(--space-2)",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <StatusChip label={note.type} tone="teal" compact />
                        <span>{note.date}</span>
                        <span style={{ opacity: 0.7 }}>{note.author}</span>
                      </div>
                      <pre
                        className="screening-note-text"
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {note.text}
                      </pre>
                    </article>
                  ))
                ) : (
                  <p style={{ marginTop: "var(--space-2)", opacity: 0.72 }}>
                    No structured notes parsed yet.
                  </p>
                )}
              </div>
            </details>
          ) : null}
        </div>

        {screeningStatus !== "idle" ? (
          <div className="screening-workspace__results" ref={resultsRef}>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                marginBottom: "var(--space-4)",
              }}
            >
              <h3>Assessment results</h3>
              <StatusChip
                label={`${assessedCount} / ${criteria.length} criteria`}
                tone="slate"
                compact
              />
              {unmappedAssessments.length > 0 ? (
                <StatusChip
                  label={`+${unmappedAssessments.length} unmapped`}
                  tone="amber"
                  compact
                />
              ) : null}
            </div>

            {unmappedAssessments.length > 0 ? (
              <div
                className="surface"
                style={{
                  marginBottom: "var(--space-4)",
                  border: "1px solid color-mix(in srgb, var(--amber) 45%, white)",
                  background:
                    "color-mix(in srgb, var(--amber) 12%, var(--surface, white))",
                }}
              >
                <p className="eyebrow-label">Contract drift detected</p>
                <p style={{ marginTop: "var(--space-2)" }}>
                  Some screening results did not match the canonical trial
                  criteria and would otherwise be hidden from the main results
                  grid.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    flexWrap: "wrap",
                    marginTop: "var(--space-3)",
                  }}
                >
                  {unmappedAssessments.map(([criterionId, assessment]) => (
                    <StatusChip
                      key={criterionId}
                      label={`${criterionId}: ${verdictLabel(assessment.status)}`}
                      tone={verdictTone(assessment.status)}
                      compact
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {screeningMode === "full_record_llm" && activeDiagnosticRun ? (
              <details className="surface screening-diagnostics" open>
                <summary>
                  Diagnostics
                  <span>
                    {diagnosticOutcomeLabel(activeDiagnosticRun.outcome)} |{" "}
                    {activeDiagnosticRun.runtimeMode === "demo" ? "Demo runtime" : "Live runtime"}
                  </span>
                </summary>

                <div className="screening-diagnostics__meta">
                  <div className="screening-diagnostics__meta-grid">
                    <div>
                      <p className="eyebrow-label">Run</p>
                      <strong>{formatDiagnosticTimestamp(activeDiagnosticRun.startedAt)}</strong>
                    </div>
                    <div>
                      <p className="eyebrow-label">Runtime</p>
                      <strong>
                        {activeDiagnosticRun.runtimeMode === "demo"
                          ? "Demo fixture"
                          : "Live provider chain"}
                      </strong>
                    </div>
                    <div>
                      <p className="eyebrow-label">Prompt size</p>
                      <strong>{activeDiagnosticRun.promptChars.toLocaleString()} chars</strong>
                    </div>
                    <div>
                      <p className="eyebrow-label">Record size</p>
                      <strong>{activeDiagnosticRun.rawRecordChars.toLocaleString()} chars</strong>
                    </div>
                  </div>

                  <div className="stacked-chips">
                    <StatusChip
                      label={diagnosticOutcomeLabel(activeDiagnosticRun.outcome)}
                      tone={diagnosticOutcomeTone(activeDiagnosticRun.outcome)}
                      compact
                    />
                    <StatusChip
                      label={
                        activeDiagnosticRun.buildMode === "dev" ? "Dev bundle" : "Preview bundle"
                      }
                      tone={activeDiagnosticRun.buildMode === "dev" ? "teal" : "paper"}
                      compact
                    />
                    {activeDiagnosticRun.clientPort ? (
                      <StatusChip
                        label={`Port ${activeDiagnosticRun.clientPort}`}
                        tone="paper"
                        compact
                      />
                    ) : null}
                    <StatusChip
                      label={`Build ${activeDiagnosticRun.buildStamp}`}
                      tone="paper"
                      compact
                    />
                    {activeDiagnosticRun.finalProvider ? (
                      <StatusChip
                        label={`Final ${providerLabel(activeDiagnosticRun.finalProvider)}`}
                        tone={
                          activeDiagnosticRun.finalProvider === "demo" ? "amber" : "teal"
                        }
                        compact
                      />
                    ) : null}
                  </div>
                </div>

                <p className="screening-diagnostics__summary">{activeDiagnosticRun.summary}</p>

                {activeDiagnosticRun.errorMessage ? (
                  <p className="screening-diagnostics__error">
                    Last error: {activeDiagnosticRun.errorMessage}
                  </p>
                ) : null}

                {formatSchemaDetail(
                  activeDiagnosticRun.schemaPath,
                  activeDiagnosticRun.schemaMessage,
                ) ? (
                  <p className="screening-diagnostics__error">
                    Schema detail:{" "}
                    {formatSchemaDetail(
                      activeDiagnosticRun.schemaPath,
                      activeDiagnosticRun.schemaMessage,
                    )}
                  </p>
                ) : null}

                {activeDiagnosticRun.schemaRawSummary ? (
                  <p className="screening-diagnostics__fallback">
                    Raw output preview: {activeDiagnosticRun.schemaRawSummary}
                  </p>
                ) : null}

                {activeDiagnosticRun.fallbackReason ? (
                  <p className="screening-diagnostics__fallback">
                    Fallback reason: {activeDiagnosticRun.fallbackReason}
                  </p>
                ) : null}

                <div className="screening-diagnostics__section">
                  <p className="eyebrow-label">Provider attempts</p>
                  <div className="screening-diagnostics__attempts">
                    {activeDiagnosticRun.providerAttempts.length > 0 ? (
                      activeDiagnosticRun.providerAttempts.map((attempt, index) => (
                        <article
                          key={`${attempt.provider}-${attempt.attemptedAt}-${index}`}
                          className="screening-diagnostics__attempt"
                        >
                          <div className="screening-diagnostics__attempt-top">
                            <strong>{providerLabel(attempt.provider)}</strong>
                            <div className="stacked-chips">
                              <StatusChip
                                label={attempt.status}
                                tone={diagnosticAttemptTone(activeDiagnosticRun, attempt.status)}
                                compact
                              />
                              {attempt.errorCategory ? (
                                <StatusChip label={attempt.errorCategory} tone="paper" compact />
                              ) : null}
                              {attempt.model ? (
                                <StatusChip label={attempt.model} tone="paper" compact />
                              ) : null}
                            </div>
                          </div>
                          <p>
                            Started {formatDiagnosticTimestamp(attempt.attemptedAt)}
                            {attempt.completedAt
                              ? ` | Finished ${formatDiagnosticTimestamp(attempt.completedAt)}`
                              : ""}
                            {attempt.wallTimeMs != null
                              ? ` | ${formatWallTime(attempt.wallTimeMs)}`
                              : ""}
                          </p>
                          {attempt.reason ? (
                            <p className="screening-diagnostics__attempt-reason">
                              {attempt.reason}
                            </p>
                          ) : null}
                          {formatSchemaDetail(attempt.schemaPath, attempt.schemaMessage) ? (
                            <p className="screening-diagnostics__attempt-reason">
                              Schema issue:{" "}
                              {formatSchemaDetail(
                                attempt.schemaPath,
                                attempt.schemaMessage,
                              )}
                            </p>
                          ) : null}
                          {attempt.schemaRawSummary ? (
                            <p className="screening-diagnostics__attempt-reason">
                              Raw output preview: {attempt.schemaRawSummary}
                            </p>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="screening-diagnostics__empty">
                        No provider attempts recorded yet.
                      </p>
                    )}
                  </div>
                </div>

                {activeDiagnosticRun.safetyMessages.length > 0 ? (
                  <div className="screening-diagnostics__section">
                    <p className="eyebrow-label">Safety messages</p>
                    <ul className="screening-diagnostics__list">
                      {activeDiagnosticRun.safetyMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="screening-diagnostics__section">
                  <p className="eyebrow-label">Provider order</p>
                  <div className="stacked-chips">
                    {activeDiagnosticRun.providerOrder.map((provider) => (
                      <StatusChip key={provider} label={providerLabel(provider)} tone="paper" compact />
                    ))}
                  </div>
                </div>

                <div className="screening-diagnostics__actions">
                  <button
                    type="button"
                    className="ghost-link"
                    onClick={() => clearDiagnostics()}
                  >
                    Clear diagnostic history
                  </button>
                </div>
              </details>
            ) : null}

              {screeningStatus === "done" ? (
                <HumanReviewPanel
                  run={screeningReviewRun.run}
                  title="Approve, override, or finalize screening output"
                  onRerun={async (editedInput) => {
                  if (
                    typeof editedInput === "object" &&
                    editedInput &&
                    "patientId" in editedInput &&
                    typeof (editedInput as { patientId?: unknown }).patientId === "string"
                  ) {
                    setSelectedPatientId((editedInput as { patientId: string }).patientId);
                  }
                  if (
                    typeof editedInput === "object" &&
                    editedInput &&
                    "trialId" in editedInput &&
                    typeof (editedInput as { trialId?: unknown }).trialId === "string"
                  ) {
                    setSelectedTrialId((editedInput as { trialId: string }).trialId);
                  }
                    await runScreening();
                  }}
                />
              ) : null}

              {committedTrialReviewQuery.data ? (
                <div className="callout callout--success" style={{ marginTop: "var(--space-4)" }}>
                  <strong>Applied to trial decision</strong>
                  <p>
                    The current patient-trial pair is linked to a committed screening artifact from{" "}
                    {new Date(committedTrialReviewQuery.data.committedAt).toLocaleString()}.
                    Review Workbench will consume this same finalized screening result.
                  </p>
                </div>
              ) : null}

            {criteria.map((criterion, index) => {
              const assessment = displayAssessments[criterion.id];
              const isEvaluating = screeningCurrentCriterionId === criterion.id;

              return (
                <article
                  key={criterion.id}
                  className="screening-criterion-card"
                  style={{
                    ["--i" as string]: index,
                    animation: assessment ? "ctp-slide-up 0.3s ease both" : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{criterion.label}</strong>
                    <StatusChip
                      label={criterion.type}
                      tone={criterion.type === "inclusion" ? "teal" : "brick"}
                      compact
                    />
                    <StatusChip label={criterion.computability} tone="paper" compact />
                  </div>

                  <div style={{ marginTop: "var(--space-2)" }}>
                    {isEvaluating ? (
                      <StatusChip label="Evaluating..." tone="amber" />
                    ) : null}
                    {!isEvaluating && !assessment ? (
                      <StatusChip label="Pending..." tone="paper" />
                    ) : null}
                    {assessment ? (
                      <StatusChip
                        label={verdictLabel(assessment.status)}
                        tone={verdictTone(assessment.status)}
                      />
                    ) : null}
                  </div>

                  {assessment?.reasoning ? (
                    <div style={{ marginTop: "var(--space-2)" }}>
                      <p className="eyebrow-label">Reasoning</p>
                      <p>{assessment.reasoning}</p>
                    </div>
                  ) : null}

                  {assessment?.evidenceIds && assessment.evidenceIds.length > 0 ? (
                    <div style={{ marginTop: "var(--space-2)" }}>
                      <p className="eyebrow-label">Citations</p>
                      <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                        {assessment.evidenceIds.map((evidenceId) => (
                          <StatusChip
                            key={evidenceId}
                            label={evidenceId}
                            tone="slate"
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {assessment?.uncertaintyReason ? (
                    <div style={{ marginTop: "var(--space-2)" }}>
                      <StatusChip
                        label={`Uncertainty: ${assessment.uncertaintyReason.replace(/_/g, " ")}`}
                        tone="amber"
                        compact
                      />
                    </div>
                  ) : null}

                  {assessment?.provider ? (
                    <div
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: "var(--text-xs, 0.75rem)",
                        opacity: 0.6,
                      }}
                    >
                      {assessment.provider}
                      {assessment.model ? ` / ${assessment.model}` : ""}
                      {assessment.wallTimeMs != null
                        ? ` - ${formatWallTime(assessment.wallTimeMs)}`
                        : ""}
                    </div>
                  ) : null}
                </article>
              );
            })}

            {unmappedAssessments.length > 0 ? (
              <div className="surface" style={{ marginTop: "var(--space-4)" }}>
                <p className="eyebrow-label">Unmapped assessments</p>
                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-3)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  {unmappedAssessments.map(([criterionId, assessment]) => (
                    <article key={criterionId}>
                      <div
                        style={{
                          display: "flex",
                          gap: "var(--space-2)",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong>{assessment.label || criterionId}</strong>
                        <StatusChip label={criterionId} tone="paper" compact />
                        <StatusChip
                          label={verdictLabel(assessment.status)}
                          tone={verdictTone(assessment.status)}
                          compact
                        />
                      </div>
                      {assessment.reasoning ? (
                        <p style={{ marginTop: "var(--space-2)" }}>
                          {assessment.reasoning}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {screeningStatus !== "idle" ? (
          <aside
            className="screening-workspace__sidebar"
            style={{ position: "sticky", top: "var(--space-4)" }}
          >
            <div className="screening-eligibility-banner surface">
              <p className="eyebrow-label">Overall eligibility</p>
              <StatusChip
                label={eligibilityLabel(screeningOverallEligibility)}
                tone={eligibilityTone(screeningOverallEligibility)}
              />
            </div>

            <div className="surface" style={{ marginTop: "var(--space-3)" }}>
              <p className="eyebrow-label">Progress</p>
              {criteria.map((criterion) => {
                const assessment = displayAssessments[criterion.id];
                const isEvaluating = screeningCurrentCriterionId === criterion.id;

                let dotColor = "var(--text-muted, #999)";
                if (assessment) {
                  switch (assessment.status) {
                    case "pass":
                      dotColor = "var(--moss, #2e7d32)";
                      break;
                    case "fail":
                      dotColor = "var(--brick, #c62828)";
                      break;
                    case "uncertain":
                    case "manual_review":
                      dotColor = "var(--amber, #f9a825)";
                      break;
                  }
                }

                return (
                  <div key={criterion.id} className="screening-progress-item">
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: dotColor,
                        flexShrink: 0,
                        animation: isEvaluating ? "ctp-pulse 1s infinite" : undefined,
                      }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                      title={criterion.label}
                    >
                      {criterion.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {screeningStatus === "done" ? (
              <div className="surface" style={{ marginTop: "var(--space-3)" }}>
                <p className="eyebrow-label">Run metadata</p>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    marginTop: "var(--space-2)",
                  }}
                >
                  <li>
                    Total wall time: <strong>{formatWallTime(totalWallTime)}</strong>
                  </li>
                  <li>
                    Criteria evaluated: <strong>{assessedCount}</strong>
                  </li>
                  {unmappedAssessments.length > 0 ? (
                    <li>
                      Unmapped results: <strong>{unmappedAssessments.length}</strong>
                    </li>
                  ) : null}
                  {Object.values(screeningAssessments)[0]?.provider ? (
                    <li>
                      Provider:{" "}
                      <strong>{Object.values(screeningAssessments)[0].provider}</strong>
                    </li>
                  ) : null}
                  {screeningMode === "full_record_llm" ? (
                    <li>
                      Runtime:{" "}
                      <strong>
                        {llmRuntime.runtimeMode === "demo"
                          ? "Demo fixture"
                          : llmRuntime.runtimeMode === "live"
                            ? "Live provider chain"
                            : aiDemoMode
                              ? "Demo fixture"
                              : "Live provider chain"}
                      </strong>
                    </li>
                  ) : null}
                  {screeningMode === "full_record_llm" && llmRuntime.outcome ? (
                    <li>
                      Outcome: <strong>{diagnosticOutcomeLabel(llmRuntime.outcome)}</strong>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </AppShell>
  );
}
