/*
 * aiDecomposition store — live state for the F1 Protocol Decomposition view.
 *
 * `runDecomposition(protocolText)` ships the protocol paste through
 * `getOrchestrator().generate()` with the F1 prompt + `DecompositionResponseSchema`.
 * In demo mode the demo provider returns the canned fixture; in live mode a real
 * provider (Ollama → Gemini → Groq) returns structured JSON validated by Zod.
 *
 * The raw AI response is kept under `response`, and a UI-shaped derivation is
 * computed into `view: ProtocolDecomposition` so `ProtocolDecompositionView.tsx`
 * can keep rendering the same props it had when it was statically wired to
 * `mockProtocolDecomposition`. The store also seeds a default `protocolText`
 * so the F1 textarea + "Decompose" button works on first mount with zero typing.
 */

import { create } from "zustand";
import { getOrchestrator } from "../lib/ai/providers";
import type { ProviderName } from "../lib/ai/providers";
import {
  DecompositionResponseSchema,
  type DecompositionResponse,
  type DecomposedCriterionAI,
} from "../lib/ai/schemas";
import {
  DECOMPOSE_PROTOCOL_FEATURE_KEY,
  DECOMPOSE_PROTOCOL_SYSTEM,
  buildDecomposeProtocolUserPrompt,
} from "../lib/ai/prompts/decomposeProtocol";
import { getDecompositionGuard } from "../lib/safety/guards/decomposition";
import { sanitizePromptInjection } from "../lib/safety/promptInjectionFilter";
import { SafetyBlockError } from "../lib/safety/safetyGuard";
import type {
  DecomposedCriterion,
  ProtocolDecomposition,
} from "../types/aiFeatures";

/** Seed text — CTP Phase II EGFR-TKI combo protocol excerpt matching the demo story. */
export const DEFAULT_PROTOCOL_TEXT = `PROTOCOL NCT-CTP-2026-TOR-301
Phase II Study of Novel EGFR-TKI in Previously Treated NSCLC with Actionable Mutations

§3.1 Inclusion Criteria (p.11–13)

1. Histologically or cytologically confirmed non-small cell lung cancer, AJCC 8th edition Stage IIIB or IV.
2. Documented EGFR activating mutation (exon 19 deletion or L858R) from a CLIA-certified molecular report.
3. ECOG performance status of 0 or 1 at screening.
4. Adult patients aged 18 years or older at the time of informed consent.
5. Absolute neutrophil count ≥ 1500 /μL at screening.
6. Platelet count ≥ 100,000/μL at screening.
7. Serum creatinine ≤ 1.5 × institutional upper limit of normal, drawn within 14 days before first dose.

§3.2 Exclusion Criteria (p.14)

1. Any prior EGFR tyrosine kinase inhibitor within 14 days of Cycle 1 Day 1 is prohibited.
2. Active or symptomatic brain metastases are excluded. Patients with treated brain metastases are eligible if clinically stable for at least 4 weeks without steroids.

§4.1 Screening Imaging (p.18)

Baseline tumor imaging must be performed within 28 days before Cycle 1 Day 1.

§3.1 (cont.) — In the investigator's opinion, the patient is clinically appropriate for enrollment and able to comply with study procedures.`;

export type DecompositionStatus = "idle" | "running" | "success" | "error";

interface AiDecompositionState {
  status: DecompositionStatus;
  protocolText: string;
  response: DecompositionResponse | null;
  view: ProtocolDecomposition | null;
  error: string | null;
  provider: ProviderName | null;
  model: string | null;
  wallTimeMs: number | null;
  lastRunAt: string | null;
  setProtocolText: (text: string) => void;
  runDecomposition: (overrideText?: string) => Promise<void>;
  reset: () => void;
}

/** Convert the AI-schema criterion to the UI criterion shape. */
function toDecomposedCriterion(c: DecomposedCriterionAI): DecomposedCriterion {
  return {
    id: c.id,
    label: c.label,
    type: c.type,
    computability: c.computability,
    threshold: c.threshold,
    confidence: c.confidence,
    source: {
      pageRef: c.source.pageRef,
      originalText: c.source.originalText,
    },
    normalizedConcepts: [...c.normalizedConcepts],
    reviewNote: c.reviewNote,
  };
}

/** Build the UI `ProtocolDecomposition` envelope from a schema-valid response. */
function toProtocolDecomposition(
  response: DecompositionResponse,
  wallTimeMs: number,
): ProtocolDecomposition {
  const criteria = response.criteria.map(toDecomposedCriterion);
  const stats = {
    inclusion: criteria.filter((c) => c.type === "inclusion").length,
    exclusion: criteria.filter((c) => c.type === "exclusion").length,
    deterministic: criteria.filter((c) => c.computability === "deterministic")
      .length,
    hybrid: criteria.filter((c) => c.computability === "hybrid").length,
    manual_only: criteria.filter((c) => c.computability === "manual_only")
      .length,
    flaggedForReview: criteria.filter(
      (c) => c.reviewNote !== undefined || c.confidence === "low",
    ).length,
  };
  return {
    trialId: "trial-001",
    protocolId: "NCT-CTP-2026-TOR-301",
    protocolTitle:
      "Phase II Study of Novel EGFR-TKI in Previously Treated NSCLC with Actionable Mutations",
    parsedAt: new Date().toISOString(),
    pageCount: 38,
    wallTimeSeconds: Math.max(0.1, wallTimeMs / 1000),
    criteria,
    stats,
  };
}

export const useAiDecompositionStore = create<AiDecompositionState>(
  (set, get) => ({
    status: "idle",
    protocolText: DEFAULT_PROTOCOL_TEXT,
    response: null,
    view: null,
    error: null,
    provider: null,
    model: null,
    wallTimeMs: null,
    lastRunAt: null,

    setProtocolText: (text) => set({ protocolText: text }),

    runDecomposition: async (overrideText) => {
      const rawText = overrideText ?? get().protocolText;
      if (!rawText.trim()) {
        set({
          status: "error",
          error: "Protocol text is empty. Paste the eligibility section first.",
        });
        return;
      }
      // Pre-flight: strip prompt-injection patterns from the paste before
      // the orchestrator ever sees the user content. `sanitizePromptInjection`
      // logs a `prompt_injection` safety event per hit, so the /safety feed
      // records the attack attempt even though the guard pipeline doesn't
      // run until after the model returns.
      const { sanitized: text } = sanitizePromptInjection(
        rawText,
        "F1",
        DECOMPOSE_PROTOCOL_FEATURE_KEY,
      );
      set({ status: "running", error: null });
      try {
        const orchestrator = getOrchestrator();
        const result = await orchestrator.generate<DecompositionResponse>({
          featureKey: DECOMPOSE_PROTOCOL_FEATURE_KEY,
          system: DECOMPOSE_PROTOCOL_SYSTEM,
          user: buildDecomposeProtocolUserPrompt(text),
          schema: DecompositionResponseSchema,
          temperature: 0.1,
          maxTokens: 2048,
        });
        // Route the AI response through the composed F1 guard stack:
        // schemaValidator → biomarkerOntology (may rewrite normalizedConcepts)
        // → modelRegression (drift warn). Any `block` severity throws
        // SafetyBlockError, which we surface as an error state.
        const guardedValue = getDecompositionGuard().run(result.value, {
          feature: "F1",
          featureKey: DECOMPOSE_PROTOCOL_FEATURE_KEY,
          provider: result.provider,
          model: result.model,
        });
        set({
          status: "success",
          response: guardedValue,
          view: toProtocolDecomposition(guardedValue, result.wallTimeMs),
          provider: result.provider,
          model: result.model,
          wallTimeMs: result.wallTimeMs,
          lastRunAt: new Date().toISOString(),
          error: null,
        });
      } catch (err) {
        const message =
          err instanceof SafetyBlockError
            ? `Safety guard blocked F1 output: ${err.message}`
            : (err as Error).message;
        set({
          status: "error",
          error: message,
        });
      }
    },

    reset: () =>
      set({
        status: "idle",
        protocolText: DEFAULT_PROTOCOL_TEXT,
        response: null,
        view: null,
        error: null,
        provider: null,
        model: null,
        wallTimeMs: null,
        lastRunAt: null,
      }),
  }),
);
