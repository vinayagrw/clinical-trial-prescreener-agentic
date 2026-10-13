/*
 * aiRetrieval store — live state for the F2 Hybrid Retrieval view.
 *
 * Holds the most recent `RetrievalRun`, the selected criterion, loading
 * state, and an error string. Calling `runRetrieval()` kicks off the
 * deterministic BM25 + embedding + rerank pipeline from
 * `lib/retrieval/hybrid.ts` and writes the result back to the store.
 *
 * The store ships with a seeded default run (ANC ≥ 1500/μL) so the F2 view
 * renders immediately on first mount — same UX as the static version.
 */

import { create } from "zustand";
import type { RetrievalQuery, RetrievalRun } from "../types/aiFeatures";
import { runHybridRetrieval } from "../lib/retrieval/hybrid";

export interface RetrievalCriterionOption {
  id: string;
  label: string;
  keywordTerms: string[];
  expandedConcepts: string[];
}

/**
 * Curated criterion presets so the UI dropdown has useful starting points.
 * Each one seeds a realistic BM25 query; the user can still type a free-form
 * label, but these cover the main F2 pitch moments.
 */
export const RETRIEVAL_CRITERIA: RetrievalCriterionOption[] = [
  {
    id: "dc-005",
    label: "ANC ≥ 1500/μL",
    keywordTerms: ["ANC", "absolute neutrophil count", "neutrophils"],
    expandedConcepts: [
      "LOINC:26499-4 (Absolute neutrophil count)",
      "LOINC:751-8 (Neutrophils #)",
      "SNOMED:165517008 (Neutrophil count)",
    ],
  },
  {
    id: "dc-006",
    label: "Platelets ≥ 100 × 10⁹/L",
    keywordTerms: ["platelets", "plt", "thrombocyte count"],
    expandedConcepts: [
      "LOINC:777-3 (Platelets)",
      "SNOMED:365632008 (Platelet count)",
    ],
  },
  {
    id: "dc-007",
    label: "Creatinine ≤ 1.5 × ULN",
    keywordTerms: ["creatinine", "renal function", "eGFR"],
    expandedConcepts: [
      "LOINC:2160-0 (Creatinine serum)",
      "LOINC:33914-3 (Estimated GFR)",
    ],
  },
  {
    id: "dc-008",
    label: "EGFR L858R mutation",
    keywordTerms: ["EGFR", "L858R", "exon 21"],
    expandedConcepts: [
      "HGNC:3236 (EGFR)",
      "HGVS:NM_005228.5:c.2573T>G (p.L858R)",
    ],
  },
  {
    id: "dc-009",
    label: "Prior EGFR-TKI washout",
    keywordTerms: ["osimertinib", "EGFR-TKI", "washout"],
    expandedConcepts: [
      "RxNorm:1721559 (osimertinib)",
      "SNOMED:429961003 (EGFR tyrosine kinase inhibitor)",
    ],
  },
  {
    id: "dc-010",
    label: "Screening imaging ≤ 28 days before C1D1",
    keywordTerms: ["CT chest", "imaging", "RECIST"],
    expandedConcepts: [
      "LOINC:30746-2 (CT chest with contrast)",
      "SNOMED:77477000 (Computed tomography)",
    ],
  },
  {
    id: "dc-011",
    label: "No brain metastases",
    keywordTerms: ["brain metastases", "CNS", "MRI brain"],
    expandedConcepts: [
      "SNOMED:94225008 (Secondary malignant neoplasm of brain)",
      "LOINC:24590-2 (MR head with contrast)",
    ],
  },
];

export type RetrievalStatus = "idle" | "running" | "success" | "error";

interface AiRetrievalState {
  status: RetrievalStatus;
  run: RetrievalRun | null;
  error: string | null;
  selectedCriterionId: string;
  lastRunAt: string | null;
  runRetrieval: (criterionId?: string) => Promise<void>;
  setSelectedCriterion: (id: string) => void;
  reset: () => void;
}

function findCriterion(id: string): RetrievalCriterionOption {
  return (
    RETRIEVAL_CRITERIA.find((c) => c.id === id) ?? RETRIEVAL_CRITERIA[0]
  );
}

export const useAiRetrievalStore = create<AiRetrievalState>((set, get) => ({
  status: "idle",
  run: null,
  error: null,
  selectedCriterionId: RETRIEVAL_CRITERIA[0].id,
  lastRunAt: null,
  runRetrieval: async (criterionId) => {
    const id = criterionId ?? get().selectedCriterionId;
    const criterion = findCriterion(id);
    set({
      status: "running",
      error: null,
      selectedCriterionId: id,
    });
    try {
      const query: Pick<
        RetrievalQuery,
        "criterionId" | "criterionLabel"
      > & { keywordTerms: string[]; expandedConcepts: string[] } = {
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        keywordTerms: criterion.keywordTerms,
        expandedConcepts: criterion.expandedConcepts,
      };
      const run = await runHybridRetrieval(query, {
        todayIso: "2026-04-14",
        topK: 5,
        freshnessDays: 21,
      });
      set({
        status: "success",
        run,
        lastRunAt: new Date().toISOString(),
        error: null,
      });
    } catch (err) {
      set({
        status: "error",
        error: (err as Error).message,
      });
    }
  },
  setSelectedCriterion: (id) => set({ selectedCriterionId: id }),
  reset: () =>
    set({
      status: "idle",
      run: null,
      error: null,
      lastRunAt: null,
      selectedCriterionId: RETRIEVAL_CRITERIA[0].id,
    }),
}));
