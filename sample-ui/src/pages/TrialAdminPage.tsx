import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { DetailContextBar } from "../components/DetailContextBar";
import {
  ComputabilityGrid,
  CriteriaInspector,
  ProtocolTimeline,
  ReleaseGateStrip,
  SourceServiceBlueprint
} from "../components/visuals/AdminVisuals";
import { StatusChip } from "../components/StatusChip";
import {
  useImportClinicalTrialMutation,
  useNormalizeImportedTrialMutation,
  useImportedTrialDetailQuery,
  useImportedTrialRawQuery
} from "../data/queries/trialImports";
import {
  useApproveNormalizationJobMutation,
  useRemoveTrialMutation,
  useNormalizeInstitutionalTrialMutation,
  useReviewNormalizationJobMutation,
  useSyncInstitutionalTrialsMutation
} from "../data/queries/institutionalTrials";
import {
  buildComputabilityCells,
  buildProtocolTimeline
} from "../lib/visualAdapters";
import { isLocalApiOfflineError, normalizeLocalApiError } from "../lib/localApiErrors";
import { summarizeTrialAutomationReadiness } from "../lib/screening/patientTrialEvaluator";
import {
  domainEntities,
  importTrials,
  listTrials,
  parseTrialCriteria,
  screeningApi,
  sourceAdapters
} from "../data/mockApi";
import {
  getNormalizedCriteriaForTrial,
  getTrial,
  getTrialVersionsForTrial
} from "../data/mockData";
import { useAiProvidersStore } from "../stores/aiProviders";
import {
  getImportedNormalizationJobForTrial,
  isImportedTrialId,
  useImportedTrialsStore
} from "../stores/importedTrials";
import {
  getInstitutionalCriteriaVersionForTrial,
  getInstitutionalTrialById,
  getInstitutionalNormalizationJobForTrial,
  useInstitutionalTrialsStore
} from "../stores/institutionalTrials";
import { useUiStore } from "../stores/ui";
import { useVisualFocusStore } from "../stores/visualFocus";
import type { NormalizedCriterion } from "../types";

// Stable reference â€” returning a fresh [] from a zustand selector trips
// React's useSyncExternalStore infinite-loop detection.
// Never mutated â€” reference-stable shared fallback used when the visual
// focus store points at a different route.
const EMPTY_TERMS: string[] = [];
const EMPTY_TRIAL_ROUTE_ID = "__none__";
const NORMALIZATION_REVIEWER_PLACEHOLDER = "Local reviewer";

function sanitizeNctId(value: string) {
  return value.trim().toUpperCase();
}

function cloneCriteria(criteria: NormalizedCriterion[]): NormalizedCriterion[] {
  return criteria.map((criterion) => ({
    ...criterion,
    conceptTags: criterion.conceptTags ? [...criterion.conceptTags] : undefined,
    compiledRule: criterion.compiledRule
      ? JSON.parse(JSON.stringify(criterion.compiledRule))
      : undefined,
  }));
}

function createBlankCriterion(trialId: string): NormalizedCriterion {
  return {
    id: `draft-${trialId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    trialId,
    label: "New criterion",
    type: "inclusion",
    computability: "manual_only",
    threshold: "",
    owner: NORMALIZATION_REVIEWER_PLACEHOLDER,
    note: "Added during Trial Admin review.",
    qaStatus: "needs_review",
    normalizationConfidence: "medium",
    sourceText: "",
    sourceLocation: "",
    countsTowardAutomationReadiness: true,
    normalizationSource: "reviewer_approved",
  };
}

function deriveCriterionReviewGateLabel(criterion: NormalizedCriterion) {
  return criterion.computability === "manual_only"
    ? "policy_locked_manual_only"
    : "human_required";
}

function buildTrialRemovalConfirmation(input: {
  isImportedTrial: boolean;
  importedShortCode?: string | null;
  trialShortCode?: string | null;
  linkedInstitutionalTrialId?: string | null;
  linkedImportedTrialId?: string | null;
}) {
  if (input.isImportedTrial) {
    return {
      title: `Remove imported draft ${input.importedShortCode ?? ""}`.trim(),
      description: input.linkedInstitutionalTrialId
        ? "This will permanently delete the imported ClinicalTrials.gov draft and its linked institutional draft."
        : "This will permanently delete the imported ClinicalTrials.gov draft from the local runtime store.",
    };
  }

  if (input.linkedImportedTrialId) {
    return {
      title: `Remove institutional draft ${input.trialShortCode ?? ""}`.trim(),
      description:
        "This will permanently delete the promoted institutional draft and its linked imported ClinicalTrials.gov record.",
    };
  }

  return {
    title: `Hide trial ${input.trialShortCode ?? ""}`.trim(),
    description:
      "This trial is part of the seeded/mock institutional catalog, so it will be hidden from the UI instead of hard-deleted.",
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not imported yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function TrialAdminPage() {
  const navigate = useNavigate();
  const { trialId = "trial-001" } = useParams();
  const institutionalTrialsUpdatedAt = useInstitutionalTrialsStore((state) => state.updatedAt);
  const institutionalTrialsStatus = useInstitutionalTrialsStore((state) => state.status);
  const institutionalTrialsError = useInstitutionalTrialsStore((state) => state.error);
  const importedTrialsUpdatedAt = useImportedTrialsStore((state) => state.updatedAt);
  const importedTrialItems = useImportedTrialsStore((state) => state.items);
  const importedTrialsStatus = useImportedTrialsStore((state) => state.status);
  const importedTrialsError = useImportedTrialsStore((state) => state.error);
  const upsertImportedTrial = useImportedTrialsStore((state) => state.upsert);
  const pushToast = useUiStore((state) => state.pushToast);
  const aiDemoMode = useAiProvidersStore((state) => state.demoMode);

  const trialOptions = useMemo(
    () => listTrials(),
    [importedTrialsUpdatedAt, institutionalTrialsUpdatedAt]
  );
  const trial = useMemo(
    () => getTrial(trialId),
    [importedTrialsUpdatedAt, institutionalTrialsUpdatedAt, trialId]
  );
  const importSummary = useMemo(() => importTrials(), [importedTrialsUpdatedAt]);
  const parsedCriteria = useMemo(
    () => parseTrialCriteria(trialId),
    [importedTrialsUpdatedAt, institutionalTrialsUpdatedAt, trialId]
  );
  const approvedTrialCriteria = useMemo(
    () => getNormalizedCriteriaForTrial(trialId),
    [importedTrialsUpdatedAt, institutionalTrialsUpdatedAt, trialId]
  );
  const protocolItems = useMemo(
    () => buildProtocolTimeline(getTrialVersionsForTrial(trialId)),
    [importedTrialsUpdatedAt, institutionalTrialsUpdatedAt, trialId]
  );
  const [selectedVersionId, setSelectedVersionId] = useState(protocolItems[0]?.id ?? "");
  const [nctIdInput, setNctIdInput] = useState("");
  const isImportedTrial = isImportedTrialId(trialId);
  const institutionalTrial = useMemo(
    () => getInstitutionalTrialById(trialId),
    [institutionalTrialsUpdatedAt, trialId]
  );
  const selectedImportedTrial = useMemo(() => {
    const directMatch =
      importedTrialItems.find((item) => item.projection.id === trialId) ?? null;
    if (directMatch) {
      return directMatch;
    }

    if (!institutionalTrial?.nctId) {
      return null;
    }

    return (
      importedTrialItems.find((item) => item.nctId === institutionalTrial.nctId) ?? null
    );
  }, [importedTrialItems, institutionalTrial?.nctId, trialId]);
  const selectedImportedProjection = selectedImportedTrial?.projection ?? null;
  const selectedImportedNctId = selectedImportedTrial?.nctId;
  const linkedInstitutionalTrialId = selectedImportedProjection?.linkedInstitutionalTrialId;
  const effectiveInstitutionalTrialId = institutionalTrial?.id ?? linkedInstitutionalTrialId ?? null;
  const effectiveInstitutionalTrial = useMemo(
    () =>
      effectiveInstitutionalTrialId
        ? getInstitutionalTrialById(effectiveInstitutionalTrialId)
        : undefined,
    [effectiveInstitutionalTrialId, institutionalTrialsUpdatedAt]
  );
  const isRetrospectiveManualOnly =
    selectedImportedProjection?.screeningIntent === "retrospective_manual_only";
  const importMutation = useImportClinicalTrialMutation();
  const normalizeImportedTrialMutation = useNormalizeImportedTrialMutation();
  const syncInstitutionalMutation = useSyncInstitutionalTrialsMutation();
  const normalizeInstitutionalMutation = useNormalizeInstitutionalTrialMutation();
  const reviewNormalizationJobMutation = useReviewNormalizationJobMutation();
  const approveNormalizationJobMutation = useApproveNormalizationJobMutation();
  const removeTrialMutation = useRemoveTrialMutation();
  const institutionalCriteriaVersion = useMemo(
    () =>
      effectiveInstitutionalTrialId
        ? getInstitutionalCriteriaVersionForTrial(effectiveInstitutionalTrialId)
        : undefined,
    [effectiveInstitutionalTrialId, institutionalTrialsUpdatedAt]
  );
  const institutionalNormalizationJob = useMemo(
    () =>
      effectiveInstitutionalTrialId
        ? getInstitutionalNormalizationJobForTrial(effectiveInstitutionalTrialId)
        : undefined,
    [effectiveInstitutionalTrialId, institutionalTrialsUpdatedAt]
  );
  const importedNormalizationJob = useMemo(
    () =>
      isImportedTrial ? getImportedNormalizationJobForTrial(trialId) : undefined,
    [importedTrialsUpdatedAt, isImportedTrial, trialId]
  );
  const currentNormalizationJob = isImportedTrial
    ? importedNormalizationJob
    : institutionalNormalizationJob;
  const draftCriteria = currentNormalizationJob?.finalCriteria ?? approvedTrialCriteria;
  const gridCells = useMemo(
    () => buildComputabilityCells(draftCriteria),
    [draftCriteria]
  );
  const [selectedCellId, setSelectedCellId] = useState("");
  const automationReadiness = useMemo(
    () =>
      summarizeTrialAutomationReadiness(
        draftCriteria,
        selectedImportedProjection,
      ),
    [draftCriteria, selectedImportedProjection]
  );
  const isNormalizationPending =
    normalizeInstitutionalMutation.isPending || normalizeImportedTrialMutation.isPending;
  const isReviewPending = reviewNormalizationJobMutation.isPending;
  const isApprovalPending = approveNormalizationJobMutation.isPending;
  const isRemovalPending = removeTrialMutation.isPending;
  const isImportedCatalogOffline = isLocalApiOfflineError(importedTrialsError);
  const isInstitutionalCatalogOffline = isLocalApiOfflineError(institutionalTrialsError);
  const importedCatalogStatusLabel =
    importMutation.isPending
      ? "Importing"
      : importedTrialsStatus === "loading"
        ? "Loading catalog"
        : importedTrialsStatus === "error"
          ? isImportedCatalogOffline
            ? "API offline"
            : "Catalog error"
          : "Catalog ready";
  const normalizedImportError = importMutation.isError
    ? normalizeLocalApiError(
        importMutation.error,
        "Unable to import trial from ClinicalTrials.gov.",
      )
    : null;
  const importedTrialDetailQuery = useImportedTrialDetailQuery(selectedImportedNctId);
  const importedTrialRawQuery = useImportedTrialRawQuery(selectedImportedNctId);
  const selectedCell =
    gridCells.find((cell) => cell.id === selectedCellId) ?? gridCells[0];
  const selectedVersion =
    protocolItems.find((item) => item.id === selectedVersionId) ?? protocolItems[0];
  const importedRawPreview =
    importedTrialRawQuery.data ?? importedTrialDetailQuery.data?.rawStudy ?? null;
  const [reviewTab, setReviewTab] = useState<"review" | "deterministic" | "llm">("review");
  const [reviewerName, setReviewerName] = useState(NORMALIZATION_REVIEWER_PLACEHOLDER);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [draftReviewCriteria, setDraftReviewCriteria] = useState<NormalizedCriterion[]>([]);

  // Split the selector â€” see CockpitPage rationale.
  const routeKind = useVisualFocusStore((state) => state.routeKind);
  const storeTerms = useVisualFocusStore((state) => state.terms);
  const highlightTerms = routeKind === "trial_admin" ? storeTerms : EMPTY_TERMS;

  useEffect(() => {
    setSelectedCellId(gridCells[0]?.id ?? "");
  }, [trialId, gridCells]);

  useEffect(() => {
    setSelectedVersionId(protocolItems[0]?.id ?? "");
  }, [trialId, protocolItems]);

  useEffect(() => {
    if (importedTrialDetailQuery.data) {
      upsertImportedTrial(importedTrialDetailQuery.data);
    }
  }, [importedTrialDetailQuery.data, upsertImportedTrial]);

  useEffect(() => {
    if (selectedImportedNctId) {
      setNctIdInput(selectedImportedNctId);
    }
  }, [selectedImportedNctId]);

  useEffect(() => {
    setDraftReviewCriteria(cloneCriteria(currentNormalizationJob?.finalCriteria ?? []));
    setReviewerName(currentNormalizationJob?.reviewedBy ?? NORMALIZATION_REVIEWER_PLACEHOLDER);
    setReviewerNotes(currentNormalizationJob?.reviewerNotes ?? "");
  }, [currentNormalizationJob?.id]);

  useEffect(() => {
    if (trialId === EMPTY_TRIAL_ROUTE_ID) {
      if (trialOptions.length > 0) {
        navigate(`/admin/trials/${trialOptions[0].id}`, { replace: true });
      }
      return;
    }

    if (!trial && !selectedImportedTrial && trialOptions.length > 0) {
      navigate(`/admin/trials/${trialOptions[0].id}`, { replace: true });
    }
  }, [navigate, selectedImportedTrial, trial, trialId, trialOptions]);

  function updateDraftCriterion(
    criterionId: string,
    mutate: (criterion: NormalizedCriterion) => NormalizedCriterion
  ) {
    setDraftReviewCriteria((current) =>
      current.map((criterion) =>
        criterion.id === criterionId ? mutate(criterion) : criterion,
      ),
    );
  }

  function moveDraftCriterion(criterionId: string, direction: -1 | 1) {
    setDraftReviewCriteria((current) => {
      const index = current.findIndex((criterion) => criterion.id === criterionId);
      if (index < 0) {
        return current;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [criterion] = next.splice(index, 1);
      next.splice(nextIndex, 0, criterion);
      return next;
    });
  }

  function handleAddDraftCriterion() {
    setDraftReviewCriteria((current) => [
      ...current,
      createBlankCriterion(currentNormalizationJob?.trialId ?? trialId),
    ]);
  }

  function handleDeleteDraftCriterion(criterionId: string) {
    setDraftReviewCriteria((current) =>
      current.filter((criterion) => criterion.id !== criterionId),
    );
  }

  function handleSaveNormalizationReview() {
    if (!currentNormalizationJob) {
      pushToast({
        title: "Normalization draft required",
        description: "Run LLM normalization first so there is a review draft to edit.",
        tone: "warning"
      });
      return;
    }

    reviewNormalizationJobMutation.mutate(
      {
        jobId: currentNormalizationJob.id,
        reviewerName,
        reviewerNotes,
        finalCriteria: draftReviewCriteria,
      },
      {
        onSuccess: () => {
          pushToast({
            title: "Review draft saved",
            description: isImportedTrial
              ? "Your reviewer edits were saved. The imported trial is now ready for approval and promotion."
              : "Your reviewer edits were saved. The approved institutional version stays active until you publish this draft.",
            tone: "success",
          });
        },
        onError: (error) => {
          pushToast({
            title: "Unable to save review draft",
            description: error instanceof Error ? error.message : "Unknown review error.",
            tone: "critical",
          });
        },
      },
    );
  }

  function handleApproveNormalizationDraft() {
    if (!currentNormalizationJob) {
      pushToast({
        title: "Normalization draft required",
        description: "Run LLM normalization first so there is a review draft to approve.",
        tone: "warning"
      });
      return;
    }

    approveNormalizationJobMutation.mutate(
      {
        jobId: currentNormalizationJob.id,
        reviewerName,
        reviewerNotes,
        finalCriteria: draftReviewCriteria,
      },
      {
        onSuccess: (payload) => {
          if (payload.importedRecord) {
            navigate(`/admin/trials/${payload.institutionalTrialId}`);
          }
          pushToast({
            title: payload.importedRecord
              ? `Approved and promoted ${payload.trial.shortCode}`
              : `Approved ${payload.trial.shortCode}`,
            description: payload.importedRecord
              ? "The reviewer-approved draft was promoted into the institutional catalog and is now the canonical approved screening version."
              : "The reviewer-approved draft is now the active institutional criteria version for screening.",
            tone: "success",
          });
        },
        onError: (error) => {
          pushToast({
            title: "Unable to approve normalization draft",
            description: error instanceof Error ? error.message : "Unknown approval error.",
            tone: "critical",
          });
        },
      },
    );
  }

  function handleImportTrial() {
    const sanitized = sanitizeNctId(nctIdInput);

    if (!sanitized) {
      pushToast({
        title: "NCT ID required",
        description: "Enter a ClinicalTrials.gov identifier such as NCT01234567 before importing.",
        tone: "warning"
      });
      return;
    }

    importMutation.mutate(sanitized, {
      onSuccess: (record) => {
        upsertImportedTrial(record);
        setNctIdInput(record.nctId);
        navigate(`/admin/trials/${record.projection.id}`);
        pushToast({
          title: `Imported ${record.nctId}`,
          description: "Raw registry JSON is persisted to the local runtime store and the draft trial is now available in selectors.",
          tone: "success"
        });
      },
      onError: (error) => {
        pushToast({
          title: "ClinicalTrials.gov import failed",
          description: error instanceof Error ? error.message : "Unknown import error.",
          tone: "critical"
        });
      }
    });
  }

  function handleDownloadRawJson() {
    if (!selectedImportedNctId || !importedRawPreview) {
      return;
    }

    const payload = JSON.stringify(importedRawPreview, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedImportedNctId}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleSyncInstitutionalCatalog() {
    syncInstitutionalMutation.mutate(undefined, {
      onSuccess: (payload) => {
        pushToast({
          title: "Institutional catalog synced",
          description: `${payload.items.length} locally active trials were refreshed from the OnCore-first seed catalog.`,
          tone: "success"
        });
      },
      onError: (error) => {
        pushToast({
          title: "Institutional sync failed",
          description: error instanceof Error ? error.message : "Unknown sync error.",
          tone: "critical"
        });
      }
    });
  }

  function handleNormalizeInstitutionalTrial() {
    if (isImportedTrial) {
      if (!selectedImportedProjection) {
        pushToast({
          title: "Imported draft unavailable",
          description: "Select an imported ClinicalTrials.gov draft before generating a normalization review draft.",
          tone: "warning"
        });
        return;
      }

      normalizeImportedTrialMutation.mutate(
        {
          trialId,
          runtimeMode: aiDemoMode ? "demo" : "live"
        },
        {
          onSuccess: (payload) => {
            pushToast({
              title: `Draft normalized for ${selectedImportedProjection.shortCode}`,
              description:
                payload.normalizationJob.status === "needs_review"
                  ? "The imported draft now has a reviewable normalization candidate. Human edits and approval are required before promotion."
                  : "Normalization finished with an error state. Review the draft or rerun normalization before promotion.",
              tone:
                payload.normalizationJob.status === "error"
                  ? "warning"
                  : "success"
            });
          },
          onError: (error) => {
            pushToast({
              title: "Promotion and normalization failed",
              description: error instanceof Error ? error.message : "Unknown promotion error.",
              tone: "critical"
            });
          }
        }
      );
      return;
    }

    if (!effectiveInstitutionalTrialId || !effectiveInstitutionalTrial) {
      pushToast({
        title: "Institutional trial required",
        description: "Normalize a trial from the institutional catalog, or promote the imported registry draft into an institutional draft first.",
        tone: "warning"
      });
      return;
    }

    normalizeInstitutionalMutation.mutate(
      {
        trialId: effectiveInstitutionalTrialId,
        runtimeMode: aiDemoMode ? "demo" : "live"
      },
      {
        onSuccess: (payload) => {
          pushToast({
            title: `Draft normalized for ${payload.trial.shortCode}`,
            description:
              payload.normalizationJob.status === "needs_review"
                ? "LLM-assisted normalization produced a review draft. The currently approved institutional criteria stay active until you approve this draft."
                : "Normalization finished with an error state; the currently approved institutional criteria remain active.",
            tone:
              payload.normalizationJob.status === "error"
                ? "warning"
                : "success"
          });
        },
        onError: (error) => {
          pushToast({
            title: "Normalization failed",
            description: error instanceof Error ? error.message : "Unknown normalization error.",
            tone: "critical"
          });
        }
      }
    );
  }

  function handleRemoveTrial() {
    const requestedTrialId = isImportedTrial
      ? trialId
      : effectiveInstitutionalTrialId ?? trialId;
    if (!requestedTrialId) {
      pushToast({
        title: "Trial unavailable",
        description: "Select a visible trial before trying to remove it from the UI.",
        tone: "warning"
      });
      return;
    }

    const confirmation = buildTrialRemovalConfirmation({
      isImportedTrial,
      importedShortCode: selectedImportedProjection?.shortCode ?? null,
      trialShortCode: effectiveInstitutionalTrial?.shortCode ?? trial?.shortCode ?? null,
      linkedInstitutionalTrialId: linkedInstitutionalTrialId ?? null,
      linkedImportedTrialId: effectiveInstitutionalTrial?.linkedImportedTrialId ?? null,
    });

    if (!window.confirm(`${confirmation.title}\n\n${confirmation.description}`)) {
      return;
    }

    removeTrialMutation.mutate(requestedTrialId, {
      onSuccess: (result) => {
        const redirectTrialId = result.redirectTrialId ?? EMPTY_TRIAL_ROUTE_ID;
        navigate(`/admin/trials/${redirectTrialId}`, { replace: true });
        pushToast({
          title:
            result.hiddenTrialIds.length > 0
              ? "Trial hidden from UI"
              : "Trial removed",
          description:
            result.hiddenTrialIds.length > 0
              ? "The selected institutional trial was hidden and will stay out of selectors across refreshes."
              : `Removed ${result.removedTrialIds.length} runtime-backed trial record${result.removedTrialIds.length === 1 ? "" : "s"}.`,
          tone: "success"
        });
      },
      onError: (error) => {
        pushToast({
          title: "Trial removal failed",
          description: error instanceof Error ? error.message : "Unknown removal error.",
          tone: "critical"
        });
      }
    });
  }

  return (
    <AppShell
      title="Trial Admin"
      subtitle="Protocol admin now foregrounds computability, release controls, version history, and the source-to-service blueprint behind the pilot."
    >
      <DetailContextBar
        eyebrow="Trial scope controls"
        title="Pull another trial without leaving admin"
        description="Switch the selected trial here to refresh protocol history, parsed criteria, and release-state details in place."
        fields={[
          {
            id: "trial-admin-select",
            label: "Trial",
            value: trialId,
            options: trialOptions.map((option) => ({
              value: option.id,
              label: option.label
            })),
            onChange: (nextTrialId) => navigate(`/admin/trials/${nextTrialId}`)
          }
        ]}
        actions={
          <div className="stacked-chips">
            <StatusChip label={trial?.releaseState ?? "Unavailable"} tone="teal" compact />
            <StatusChip
              label={trial?.localStatus ?? "unknown"}
              tone={trial?.localStatus === "active" ? "moss" : "amber"}
              compact
            />
            {isImportedTrial ? (
              <StatusChip label="Registry draft import" tone="paper" compact />
            ) : null}
          </div>
        }
      />

      <section className="surface admin-import-workspace">
        <div className="panel-heading">
          <div>
            <p className="eyebrow-label">ClinicalTrials.gov onboarding</p>
            <h3>Import one NCT trial into the pilot</h3>
            <p className="panel-copy">
              Enter a single NCT ID to fetch the full study JSON, persist it to
              the local server runtime store, and generate a draft onboarding
              record that can flow into Trial Admin and screening selectors.
            </p>
          </div>
          <div className="stacked-chips">
            <StatusChip label="Server runtime JSON" tone="paper" compact />
            <StatusChip
              label={`${importedTrialItems.length} imported`}
              tone={importedTrialItems.length > 0 ? "teal" : "paper"}
              compact
            />
            <StatusChip
              label={importedCatalogStatusLabel}
              tone={
                importMutation.isPending
                  ? "amber"
                  : importedTrialsStatus === "error"
                    ? "brick"
                    : "moss"
              }
              compact
            />
          </div>
        </div>

        <div className="admin-import-workspace__grid">
          <div className="admin-import-workspace__controls">
            <div className="admin-import-workspace__summary">
              <label className="field-label" htmlFor="trial-import-nct-id">
                NCT identifier
              </label>
              <div className="admin-import-workspace__actions">
                <input
                  id="trial-import-nct-id"
                  className="input"
                  placeholder="NCT01234567"
                  value={nctIdInput}
                  onChange={(event) => setNctIdInput(sanitizeNctId(event.target.value))}
                />
                <button
                  type="button"
                  className="primary-button"
                  disabled={importMutation.isPending}
                  onClick={handleImportTrial}
                >
                  {importMutation.isPending
                    ? "Importing..."
                    : "Import from ClinicalTrials.gov"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!selectedImportedTrial}
                  onClick={() => {
                    if (selectedImportedTrial) {
                      navigate(`/admin/trials/${selectedImportedTrial.projection.id}`);
                    }
                  }}
                >
                  Open imported trial
                </button>
              </div>

              <div className="stacked-chips">
                <StatusChip
                  label={`Last refreshed ${formatDateTime(importedTrialsUpdatedAt)}`}
                  tone="paper"
                  compact
                />
                <StatusChip
                  label={automationReadiness.label}
                  tone={
                    automationReadiness.label === "Screenable"
                      ? "moss"
                      : automationReadiness.label === "Partial automation"
                        ? "amber"
                        : "paper"
                  }
                  compact
                />
                {isRetrospectiveManualOnly ? (
                  <StatusChip
                    label="Retrospective/manual-only"
                    tone="brick"
                    compact
                  />
                ) : null}
                {selectedImportedTrial?.projection.registryOverallStatus ? (
                  <StatusChip
                    label={selectedImportedTrial.projection.registryOverallStatus}
                    tone="amber"
                    compact
                  />
                ) : null}
              </div>

              <p className="admin-import-workspace__note">
                Imported trials stay in draft review mode until local activation,
                protocol QA, and site-scope checks are completed. Queue items,
                review matches, and audit traces are not auto-generated.
              </p>

              <p className="admin-import-workspace__note">
                Automation readiness: <strong>{automationReadiness.label}</strong>
                {" — "}
                {automationReadiness.detail}
              </p>

              {isRetrospectiveManualOnly ? (
                <div className="callout callout--warning">
                  <strong>Imported successfully, excluded from normal prescreening</strong>
                  <p>{selectedImportedProjection?.automationBlockerReason}</p>
                </div>
              ) : null}

              {normalizedImportError ? (
                <div className="callout callout--warning">
                  <strong>ClinicalTrials.gov import issue</strong>
                  <p>{normalizedImportError}</p>
                </div>
              ) : null}

              {importedTrialsError ? (
                <div className="callout callout--warning">
                  <strong>Imported trial catalog issue</strong>
                  <p>{importedTrialsError}</p>
                </div>
              ) : null}
            </div>

            <div className="admin-import-workspace__catalog">
              <div className="card-row">
                <div>
                  <p className="eyebrow-label">Imported catalog</p>
                  <strong>Runtime-backed registry drafts</strong>
                </div>
                <span>{importedTrialItems.length} records</span>
              </div>

              <div className="admin-import-workspace__list">
                {importedTrialItems.length === 0 ? (
                  <div className="admin-import-workspace__empty">
                    <strong>No imported trials yet</strong>
                    <p>
                      Start with a single NCT ID to create a draft onboarding
                      record that persists on refresh.
                    </p>
                  </div>
                ) : (
                  importedTrialItems.map((item) => (
                    <button
                      key={item.nctId}
                      type="button"
                      className={`admin-import-workspace__item ${
                        item.projection.id === trialId
                          ? "admin-import-workspace__item--active"
                          : ""
                      }`}
                      onClick={() => navigate(`/admin/trials/${item.projection.id}`)}
                    >
                      <div className="card-row">
                        <strong>{item.projection.shortCode}</strong>
                        <StatusChip label={item.importStatus} tone="teal" compact />
                      </div>
                      <p>{item.projection.title}</p>
                      <div className="stacked-chips">
                        <StatusChip label={item.projection.phase} tone="paper" compact />
                        <StatusChip label={item.projection.releaseState} tone="paper" compact />
                        {item.projection.linkedInstitutionalTrialId ? (
                          <StatusChip
                            label="Institutional draft linked"
                            tone="teal"
                            compact
                          />
                        ) : null}
                        {item.projection.screeningIntent === "retrospective_manual_only" ? (
                          <StatusChip
                            label="Retrospective/manual-only"
                            tone="brick"
                            compact
                          />
                        ) : null}
                      </div>
                      <small>Fetched {formatDateTime(item.fetchedAt)}</small>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="admin-import-workspace__raw">
            <div className="panel-heading">
              <div>
                <p className="eyebrow-label">Raw registry payload</p>
                <h3>JSON preview and onboarding summary</h3>
                <p className="panel-copy">
                  Keep the untouched ClinicalTrials.gov JSON beside the parsed
                  draft projection so protocol onboarding stays auditable.
                </p>
              </div>
              <div className="stacked-chips">
                {selectedImportedTrial ? (
                  <>
                    <StatusChip
                      label={`${selectedImportedTrial.criteria.length} draft criteria`}
                      tone="teal"
                      compact
                    />
                    <StatusChip
                      label={selectedImportedTrial.projection.localStatus}
                      tone="amber"
                      compact
                    />
                  </>
                ) : null}
              </div>
            </div>

            {selectedImportedTrial ? (
              <>
                <div className="detail-list detail-list--tight">
                  <div className="detail-list__row">
                    <strong>NCT ID</strong>
                    <span>{selectedImportedTrial.nctId}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Registry status</strong>
                    <span>{selectedImportedTrial.projection.registryOverallStatus ?? "Unknown"}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Screening intent</strong>
                    <span>
                      {selectedImportedTrial.projection.screeningIntent ===
                      "retrospective_manual_only"
                        ? "Retrospective / manual-only"
                        : "Prospective prescreening"}
                    </span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Conditions</strong>
                    <span>
                      {selectedImportedTrial.projection.conditions.join(" | ") || "Not reported"}
                    </span>
                  </div>
                  {selectedImportedTrial.projection.automationBlockerReason ? (
                    <div className="detail-list__row">
                      <strong>Automation blocker</strong>
                      <span>{selectedImportedTrial.projection.automationBlockerReason}</span>
                    </div>
                  ) : null}
                  <div className="detail-list__row">
                    <strong>Fetched at</strong>
                    <span>{formatDateTime(selectedImportedTrial.fetchedAt)}</span>
                  </div>
                  {selectedImportedTrial.projection.linkedInstitutionalTrialId ? (
                    <div className="detail-list__row">
                      <strong>Linked institutional draft</strong>
                      <span>{selectedImportedTrial.projection.linkedInstitutionalTrialId}</span>
                    </div>
                  ) : null}
                  {selectedImportedTrial.projection.promotedAt ? (
                    <div className="detail-list__row">
                      <strong>Promoted at</strong>
                      <span>{formatDateTime(selectedImportedTrial.projection.promotedAt)}</span>
                    </div>
                  ) : null}
                </div>

                <div className="admin-import-workspace__actions">
                  {isImportedTrial && selectedImportedTrial.projection.linkedInstitutionalTrialId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        navigate(
                          `/admin/trials/${selectedImportedTrial.projection.linkedInstitutionalTrialId}`,
                        )
                      }
                    >
                      Open linked institutional draft
                    </button>
                  ) : null}
                  {!isImportedTrial && selectedImportedProjection ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => navigate(`/admin/trials/${selectedImportedProjection.id}`)}
                    >
                      Open imported draft
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!importedRawPreview}
                    onClick={handleDownloadRawJson}
                  >
                    Download raw JSON
                  </button>
                  <a
                    className="secondary-button"
                    href={selectedImportedTrial.projection.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open study page
                  </a>
                </div>

                <pre>
                  {importedRawPreview
                    ? JSON.stringify(importedRawPreview, null, 2)
                    : "Loading raw JSON preview..."}
                </pre>
              </>
            ) : (
              <div className="admin-import-workspace__empty">
                <strong>Select an imported trial to inspect the raw payload</strong>
                <p>
                  Once a registry draft is selected, this panel shows the
                  untouched study JSON and lets you download it as a flat file.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="panel-heading">
          <div>
            <p className="eyebrow-label">Institutional runtime</p>
            <h3>OnCore-first sync and LLM normalization</h3>
            <p className="panel-copy">
              The production path now seeds a local institutional catalog, keeps
              an approved criteria version active for screening, and queues any
              low-confidence normalization candidate for Trial Admin review.
            </p>
          </div>
          <div className="stacked-chips">
            <StatusChip
              label={
                syncInstitutionalMutation.isPending
                  ? "Syncing catalog"
                  : institutionalTrialsStatus === "error"
                    ? isInstitutionalCatalogOffline
                      ? "API offline"
                      : "Catalog error"
                    : "Catalog ready"
              }
              tone={
                syncInstitutionalMutation.isPending
                  ? "amber"
                  : institutionalTrialsStatus === "error"
                    ? "brick"
                    : "moss"
              }
              compact
            />
            <StatusChip
              label={currentNormalizationJob?.status ?? "Not normalized"}
              tone={
                currentNormalizationJob?.status === "approved"
                  ? "moss"
                  : currentNormalizationJob?.status === "needs_review"
                    ? "amber"
                    : currentNormalizationJob?.status === "error"
                      ? "brick"
                      : "paper"
              }
              compact
            />
            {isImportedTrial ? (
              <StatusChip
                label={
                  linkedInstitutionalTrialId
                    ? "Institutional draft linked"
                    : "Imported draft"
                }
                tone={linkedInstitutionalTrialId ? "teal" : "paper"}
                compact
              />
            ) : null}
            <StatusChip
              label={aiDemoMode ? "Demo runtime" : "Live runtime"}
              tone={aiDemoMode ? "amber" : "teal"}
              compact
            />
          </div>
        </div>

        {institutionalTrialsError ? (
          <div className="callout callout--warning">
            <strong>Institutional catalog issue</strong>
            <p>{institutionalTrialsError}</p>
          </div>
        ) : null}

        {isImportedTrial ? (
          <div className="callout callout--warning">
            <strong>
              {linkedInstitutionalTrialId
                ? "Imported draft linked to an institutional workspace"
                : "Imported draft stays outside screening until approval"}
            </strong>
            <p>
              {linkedInstitutionalTrialId
                ? "This imported registry draft already has a linked institutional draft. Screening still uses only the approved institutional criteria version, and any new normalization run creates a review draft instead of publishing immediately."
                : "Imported trials now generate a review draft first. A human reviewer must edit and approve the normalized criteria before the trial is promoted into the institutional screening catalog."}
            </p>
          </div>
        ) : null}

        <div className="detail-list detail-list--tight">
          <div className="detail-list__row">
            <strong>Catalog updated</strong>
            <span>{formatDateTime(institutionalTrialsUpdatedAt)}</span>
          </div>
          <div className="detail-list__row">
            <strong>Current workspace</strong>
            <span>
              {isImportedTrial
                ? "Imported draft"
                : effectiveInstitutionalTrial?.canonicalSourceKind === "clinicaltrials_gov"
                  ? "Institutional draft from ClinicalTrials.gov"
                  : "Institutional catalog trial"}
            </span>
          </div>
          {linkedInstitutionalTrialId ? (
            <div className="detail-list__row">
              <strong>Linked institutional draft</strong>
              <span>{linkedInstitutionalTrialId}</span>
            </div>
          ) : null}
          <div className="detail-list__row">
            <strong>Active criteria version</strong>
            <span>{institutionalCriteriaVersion?.versionLabel ?? "No approved institutional version yet"}</span>
          </div>
          <div className="detail-list__row">
            <strong>Draft status</strong>
            <span>{currentNormalizationJob?.status ?? "No draft created yet"}</span>
          </div>
          <div className="detail-list__row">
            <strong>Review gate</strong>
            <span>{currentNormalizationJob?.reviewGate ?? "Human optional"}</span>
          </div>
          <div className="detail-list__row">
            <strong>Warnings</strong>
            <span>
              {currentNormalizationJob?.warnings.length
                ? currentNormalizationJob.warnings.join(" | ")
                : "No normalization warnings"}
            </span>
          </div>
        </div>

        <div className="admin-import-workspace__actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="secondary-button"
            disabled={syncInstitutionalMutation.isPending}
            onClick={handleSyncInstitutionalCatalog}
          >
            Sync institutional catalog
          </button>
          {isImportedTrial && linkedInstitutionalTrialId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate(`/admin/trials/${linkedInstitutionalTrialId}`)}
            >
              Open linked institutional draft
            </button>
          ) : null}
          {!isImportedTrial && selectedImportedProjection ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate(`/admin/trials/${selectedImportedProjection.id}`)}
            >
              Back to imported draft
            </button>
          ) : null}
          <button
            type="button"
            className="primary-button"
            disabled={
              isNormalizationPending ||
              (!isImportedTrial && !effectiveInstitutionalTrial)
            }
            onClick={handleNormalizeInstitutionalTrial}
          >
            {isNormalizationPending
              ? "Normalizing..."
              : "Run LLM normalization draft"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!currentNormalizationJob || isReviewPending || isApprovalPending}
            onClick={handleSaveNormalizationReview}
          >
            {isReviewPending ? "Saving review..." : "Save review draft"}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!currentNormalizationJob || isApprovalPending || isReviewPending}
            onClick={handleApproveNormalizationDraft}
          >
            {isApprovalPending
              ? "Approving..."
              : isImportedTrial
                ? "Approve + Promote"
                : "Approve normalized criteria"}
          </button>
          <button
            type="button"
            className="secondary-button secondary-button--danger"
            disabled={isRemovalPending || (!trial && !selectedImportedTrial)}
            onClick={handleRemoveTrial}
          >
            {isRemovalPending
              ? "Removing..."
              : isImportedTrial
                ? "Remove trial"
                : effectiveInstitutionalTrial?.linkedImportedTrialId
                  ? "Remove linked drafts"
                  : "Hide from UI"}
          </button>
        </div>
      </section>

      <section className="surface normalization-review-workbench">
        <div className="panel-heading">
          <div>
            <p className="eyebrow-label">Human-in-the-loop review</p>
            <h3>Normalization draft workbench</h3>
            <p className="panel-copy">
              Reviewer edits stay in a draft until approval. Imported trials are
              promoted only after approval, and institutional trials keep their
              last approved criteria active until this draft is published.
            </p>
          </div>
          <div className="stacked-chips">
            <StatusChip
              label={currentNormalizationJob?.status ?? "No draft"}
              tone={
                currentNormalizationJob?.status === "approved"
                  ? "moss"
                  : currentNormalizationJob?.status === "needs_review"
                    ? "amber"
                    : currentNormalizationJob?.status === "error"
                      ? "brick"
                      : "paper"
              }
              compact
            />
            <StatusChip
              label={
                isImportedTrial
                  ? selectedImportedTrial?.normalizationReviewState ?? "not_started"
                  : institutionalCriteriaVersion
                    ? "approved_live"
                    : "awaiting_publish"
              }
              tone={isImportedTrial ? "teal" : "paper"}
              compact
            />
          </div>
        </div>

        {!currentNormalizationJob ? (
          <div className="callout callout--warning">
            <strong>No normalization draft exists yet</strong>
            <p>
              Run the LLM normalization draft action first. Once the draft is generated,
              you can compare the deterministic extraction, the raw LLM proposal,
              and the reviewer-edited final criteria here before approving it.
            </p>
          </div>
        ) : (
          <>
            <div className="detail-list detail-list--tight">
              <div className="detail-list__row">
                <strong>Draft created</strong>
                <span>{formatDateTime(currentNormalizationJob.completedAt ?? currentNormalizationJob.startedAt)}</span>
              </div>
              <div className="detail-list__row">
                <strong>Reviewed by</strong>
                <span>{currentNormalizationJob.reviewedBy ?? "Not reviewed yet"}</span>
              </div>
              <div className="detail-list__row">
                <strong>Machine output</strong>
                <span>{currentNormalizationJob.llmNormalizedCriteria.length || currentNormalizationJob.deterministicCriteria.length} candidate criteria</span>
              </div>
              <div className="detail-list__row">
                <strong>Editable final draft</strong>
                <span>{draftReviewCriteria.length} criteria</span>
              </div>
            </div>

            <div className="normalization-review-tabs">
              <button
                type="button"
                className={`normalization-review-tabs__tab ${reviewTab === "review" ? "normalization-review-tabs__tab--active" : ""}`}
                onClick={() => setReviewTab("review")}
              >
                Reviewer draft
              </button>
              <button
                type="button"
                className={`normalization-review-tabs__tab ${reviewTab === "deterministic" ? "normalization-review-tabs__tab--active" : ""}`}
                onClick={() => setReviewTab("deterministic")}
              >
                Deterministic extraction
              </button>
              <button
                type="button"
                className={`normalization-review-tabs__tab ${reviewTab === "llm" ? "normalization-review-tabs__tab--active" : ""}`}
                onClick={() => setReviewTab("llm")}
              >
                LLM output
              </button>
            </div>

            {reviewTab === "review" ? (
              <div className="normalization-review-editor">
                <div className="normalization-review-editor__meta">
                  <label className="normalization-review-editor__field">
                    <span>Reviewer name</span>
                    <input
                      value={reviewerName}
                      onChange={(event) => setReviewerName(event.target.value)}
                      placeholder={NORMALIZATION_REVIEWER_PLACEHOLDER}
                    />
                  </label>
                  <label className="normalization-review-editor__field normalization-review-editor__field--full">
                    <span>Reviewer notes</span>
                    <textarea
                      value={reviewerNotes}
                      onChange={(event) => setReviewerNotes(event.target.value)}
                      rows={3}
                      placeholder="Capture why criteria were edited before approval."
                    />
                  </label>
                </div>

                <div className="admin-import-workspace__actions" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleAddDraftCriterion}
                  >
                    Add criterion
                  </button>
                </div>

                <div className="normalization-review-editor__list">
                  {draftReviewCriteria.map((criterion, index) => (
                    <article key={`${criterion.id || "new"}-${index}`} className="normalization-review-editor__card">
                      <div className="card-row">
                        <strong>{criterion.label || `Criterion ${index + 1}`}</strong>
                        <div className="normalization-review-editor__card-actions">
                          <button type="button" className="secondary-button" onClick={() => moveDraftCriterion(criterion.id, -1)}>
                            Up
                          </button>
                          <button type="button" className="secondary-button" onClick={() => moveDraftCriterion(criterion.id, 1)}>
                            Down
                          </button>
                          <button
                            type="button"
                            className="secondary-button secondary-button--danger"
                            onClick={() => handleDeleteDraftCriterion(criterion.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="normalization-review-editor__grid">
                        <label className="normalization-review-editor__field normalization-review-editor__field--full">
                          <span>Label</span>
                          <input
                            value={criterion.label}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                label: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="normalization-review-editor__field">
                          <span>Type</span>
                          <select
                            value={criterion.type}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                type: event.target.value as "inclusion" | "exclusion",
                              }))
                            }
                          >
                            <option value="inclusion">Inclusion</option>
                            <option value="exclusion">Exclusion</option>
                          </select>
                        </label>
                        <label className="normalization-review-editor__field">
                          <span>Computability</span>
                          <select
                            value={criterion.computability}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                computability: event.target.value as "deterministic" | "hybrid" | "manual_only",
                              }))
                            }
                          >
                            <option value="deterministic">Deterministic</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="manual_only">Manual only</option>
                          </select>
                        </label>
                        <label className="normalization-review-editor__field">
                          <span>Rule kind</span>
                          <input
                            value={criterion.ruleKind ?? ""}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                ruleKind: (event.target.value || undefined) as typeof current.ruleKind,
                              }))
                            }
                            placeholder="lab_threshold, diagnosis_match, manual_review..."
                          />
                        </label>
                        <label className="normalization-review-editor__field">
                          <span>Temporal window</span>
                          <input
                            value={criterion.temporalWindow ?? ""}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                temporalWindow: event.target.value || undefined,
                              }))
                            }
                            placeholder="e.g. 14 days"
                          />
                        </label>
                        <label className="normalization-review-editor__field normalization-review-editor__field--full">
                          <span>Threshold / normalized rule text</span>
                          <textarea
                            value={criterion.threshold}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                threshold: event.target.value,
                              }))
                            }
                            rows={2}
                          />
                        </label>
                        <label className="normalization-review-editor__field normalization-review-editor__field--full">
                          <span>Source text</span>
                          <textarea
                            value={criterion.sourceText ?? ""}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                sourceText: event.target.value,
                              }))
                            }
                            rows={3}
                          />
                        </label>
                        <label className="normalization-review-editor__field normalization-review-editor__field--full">
                          <span>Source location</span>
                          <input
                            value={criterion.sourceLocation ?? ""}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                sourceLocation: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="normalization-review-editor__field normalization-review-editor__field--full">
                          <span>Reviewer note</span>
                          <textarea
                            value={criterion.note}
                            onChange={(event) =>
                              updateDraftCriterion(criterion.id, (current) => ({
                                ...current,
                                note: event.target.value,
                              }))
                            }
                            rows={2}
                          />
                        </label>
                      </div>

                      <div className="normalization-review-editor__meta-row">
                        <span>Derived review gate: {deriveCriterionReviewGateLabel(criterion)}</span>
                        <span>{criterion.normalizationConfidence ?? "medium"} confidence</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : reviewTab === "deterministic" ? (
              <CriteriaInspector criteria={currentNormalizationJob.deterministicCriteria} />
            ) : (
              <CriteriaInspector criteria={currentNormalizationJob.llmNormalizedCriteria} />
            )}
          </>
        )}
      </section>

      <section className="surface admin-workspace">
        <div className="panel-heading">
          <div>
            <p className="eyebrow-label">Trial scope controls</p>
            <h3>{trial?.shortCode ?? selectedImportedTrial?.nctId ?? "Unknown trial"}</h3>
            <p className="panel-copy">
              Put the current release summary, computability, version control,
              and platform contract into one dense admin surface instead of a
              separate summary slab plus a long blueprint tail.
            </p>
          </div>
          <div className="stacked-chips">
            <StatusChip label={trial?.protocolVersion ?? "Unavailable"} tone="paper" />
            <StatusChip label={trial?.releaseState ?? "Unavailable"} tone="teal" compact />
            <StatusChip
              label={automationReadiness.label}
              tone={
                automationReadiness.label === "Screenable"
                  ? "moss"
                  : automationReadiness.label === "Partial automation"
                    ? "amber"
                    : "paper"
              }
              compact
            />
            {isRetrospectiveManualOnly ? (
              <StatusChip
                label="Retrospective/manual-only"
                tone="brick"
                compact
              />
            ) : null}
            {selectedImportedTrial?.projection.registryOverallStatus ? (
              <StatusChip
                label={selectedImportedTrial.projection.registryOverallStatus}
                tone="amber"
                compact
              />
            ) : null}
          </div>
        </div>

        {isImportedTrial ? (
          <div className="callout callout--warning">
            <strong>Registry-sourced draft onboarding</strong>
            <p>
              {isRetrospectiveManualOnly
                ? selectedImportedProjection?.automationBlockerReason
                : "This trial was imported from ClinicalTrials.gov. Local activation, protocol packet verification, and queue/review artifact generation still need to happen before the trial behaves like a native pilot workspace record."}
            </p>
          </div>
        ) : null}
        {!isImportedTrial && selectedImportedProjection ? (
          <div className="callout callout--warning">
            <strong>Institutional draft linked back to a registry import</strong>
            <p>
              This institutional draft was promoted from ClinicalTrials.gov import{" "}
              <strong>{selectedImportedProjection.shortCode}</strong>. The linked
              registry payload remains available for provenance, but local
              activation and reviewer approval still govern whether this draft is
              treated like a native institutional record.
            </p>
          </div>
        ) : null}
        {!trial && !selectedImportedTrial ? (
          <div className="callout callout--warning">
            <strong>No visible trial is currently selected</strong>
            <p>
              Import a new ClinicalTrials.gov draft or sync the institutional catalog to
              repopulate Trial Admin. Hidden seeded trials stay out of selectors until
              the runtime catalog is restored manually.
            </p>
          </div>
        ) : null}

        <div
          className="admin-workspace__summary admin-summary-chips"
          role="list"
          aria-label="Trial summary facts"
        >
          <div className="admin-summary-chip" role="listitem">
            <span>Title</span>
            <strong>{trial?.title ?? "Not available"}</strong>
          </div>
          <div className="admin-summary-chip" role="listitem">
            <span>Activation state</span>
            <strong>{trial?.activationState ?? "Needs local review"}</strong>
          </div>
          <div className="admin-summary-chip" role="listitem">
            <span>Current protocol</span>
            <strong>{selectedVersion?.version ?? trial?.protocolVersion ?? "Not available"}</strong>
          </div>
          <div className="admin-summary-chip" role="listitem">
            <span>Screening window</span>
            <strong>{trial?.screeningWindow ?? "Needs protocol review"}</strong>
          </div>
          <div className="admin-summary-chip" role="listitem">
            <span>Imported registry trials</span>
            <strong>{importedTrialItems.length}</strong>
          </div>
          <div className="admin-summary-chip" role="listitem">
            <span>Automation readiness</span>
            <strong>{automationReadiness.label}</strong>
          </div>
          {selectedImportedProjection ? (
            <div className="admin-summary-chip" role="listitem">
              <span>Screening intent</span>
              <strong>
                {isRetrospectiveManualOnly
                  ? "Retrospective / manual-only"
                  : "Prospective prescreening"}
              </strong>
            </div>
          ) : null}
          <div className="admin-summary-chip" role="listitem">
            <span>Stale trials blocked</span>
            <strong>{importSummary.staleTrials}</strong>
          </div>
        </div>

        <div className="admin-workspace__grid">
          <div className="stack-col">
            <ComputabilityGrid
              cells={gridCells}
              selectedCellId={selectedCell?.id ?? ""}
              onSelect={setSelectedCellId}
            />
            <CriteriaInspector criteria={selectedCell?.criteria ?? []} />
          </div>

          <div className="stack-col">
            <ProtocolTimeline
              items={protocolItems}
              selectedId={selectedVersion?.id ?? ""}
              onSelect={setSelectedVersionId}
            />

            <div className="admin-workspace__rail-pair">
              <section className="surface surface--embedded admin-version-card">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow-label">Selected version</p>
                    <h3>{selectedVersion?.version ?? "Current release"}</h3>
                  </div>
                </div>
                <p>{selectedVersion?.summary ?? "No version summary available for this trial yet."}</p>
                <div className="detail-list detail-list--tight">
                  <div className="detail-list__row">
                    <strong>Normalized criteria</strong>
                    <span>{parsedCriteria.criteria.length}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Deterministic</strong>
                    <span>{parsedCriteria.computabilityMix.deterministic}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Hybrid</strong>
                    <span>{parsedCriteria.computabilityMix.hybrid}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Manual-only</strong>
                    <span>{parsedCriteria.computabilityMix.manualOnly}</span>
                  </div>
                  <div className="detail-list__row">
                    <strong>Readiness</strong>
                    <span>{automationReadiness.detail}</span>
                  </div>
                  {selectedImportedProjection?.automationBlockerReason ? (
                    <div className="detail-list__row">
                      <strong>Blocker reason</strong>
                      <span>{selectedImportedProjection.automationBlockerReason}</span>
                    </div>
                  ) : null}
                </div>
              </section>

              <ReleaseGateStrip
                items={[
                  `${trial?.shortCode ?? "This trial"} stays ${trial?.releaseState?.toLowerCase() ?? "under review"} until local activation is confirmed.`,
                  "Manual-only criteria remain visible and never auto-finalize.",
                  `${protocolItems.length || 0} version checkpoints stay pinned for audit replay and rollback.`,
                  "Rule, prompt, and protocol versions ship together as one governed release."
                ]}
              />
            </div>
          </div>
        </div>

        {isImportedTrial ? (
          <div className="admin-import-workspace__note admin-import-workspace__note--inline">
            {isRetrospectiveManualOnly
              ? "This registry draft stays available for onboarding context in Trial Admin, but it is intentionally kept out of the normal prescreening queue because the registry text describes a retrospective manual-only cohort."
              : "Registry-sourced draft onboarding stays visible in the blueprint below, but local site activation and downstream operational wiring still have to be completed before this trial joins the live queue."}
          </div>
        ) : null}

        <SourceServiceBlueprint
          endpoints={screeningApi}
          entities={domainEntities}
          feeds={sourceAdapters}
          highlightTerms={highlightTerms}
        />
      </section>
    </AppShell>
  );
}
