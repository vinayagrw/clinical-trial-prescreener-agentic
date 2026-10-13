/*
 * AiFeaturesPage — live, interactive walkthrough of the five top AI features.
 *
 * In Batch 2 this page rendered five static `FeatureBlock` cards fed by
 * `src/data/aiFeaturesData.ts`. In Batch 3 we replaced the blocks with a
 * guided pipeline stepper (`<PipelineStepper />`) that drives the real
 * orchestrator + deterministic libs + safety guard stack through seven
 * ordered steps: Input → F1 decomposition → F2 hybrid retrieval → F3
 * criterion evaluation → F4 temporal reasoning → F5 grounded Ask Agent →
 * Done. The hero band and a new production-gateway banner stay on top so
 * reviewers still get the pitch language + the deployment caveat.
 *
 * The stepper is a pure consumer of the feature stores (aiDecomposition,
 * aiRetrieval, aiEvaluation, aiTemporal) and the orchestrator, so every
 * step can run independently and demo mode vs. live mode works with zero
 * plumbing changes in this file.
 */

import { AppShell } from "../components/AppShell";
import { PipelineStepper } from "../features/aiWorkflow";

export function AiFeaturesPage() {
  return (
    <AppShell
      title="AI Features — Interactive Pipeline"
      subtitle="Guided walkthrough of the AI capabilities driving the pre-screener: protocol decomposition, hybrid retrieval, criterion evaluation, temporal reasoning, and the grounded Ask Agent — running against real models in live mode and deterministic fixtures in demo mode."
    >
      <div className="aif-page">
        {/* Wave B — .aif-hero--enter gates the entrance animation; each chip
           carries an --i index so the row cascades in after the hero. A
           subtle 3D tilt on hover (max 2°) lives in the new .aif-hero-chip
           CSS block and respects prefers-reduced-motion. */}
        <section className="aif-hero aif-hero--enter">
          <div className="aif-hero-head">
            <div>
              <h2>Five AI capabilities, one coordinator-first workbench</h2>
              <p className="aif-lede">
                The five features below are the load-bearing AI layer of the pre-screener: raw
                protocol PDFs become structured criteria, hybrid retrieval finds the evidence,
                criterion evaluation narrates pass / fail / uncertain with citations, temporal
                reasoning enforces washout and lab-window gates, and the grounded Ask Agent
                answers scope-bound questions with a full audit trail. Every verdict is either
                backed by a citation or surfaced as uncertain — never silently passed.
              </p>
            </div>
          </div>
          <div className="aif-hero-chips">
            {[
              { id: "f1", code: "F1", label: "Decomposition" },
              { id: "f2", code: "F2", label: "Hybrid retrieval" },
              { id: "f3", code: "F3", label: "Criterion evaluation" },
              { id: "f4", code: "F4", label: "Temporal reasoning" },
              { id: "f5", code: "F5", label: "Grounded Ask Agent" }
            ].map((chip, index) => (
              <span
                key={chip.id}
                className="aif-hero-chip aif-feature--tilt"
                style={{ ["--i" as string]: index }}
              >
                {chip.code} <strong>{chip.label}</strong>
              </span>
            ))}
          </div>
        </section>

        <aside className="aif-gateway-banner aif-gateway-banner--enter" role="note">
          <div className="aif-gateway-banner__eyebrow">Production deployment note</div>
          <p className="aif-gateway-banner__body">
            In this sample UI the browser calls OpenAI / Gemini / Groq / Ollama directly so you
            can run the full pipeline with live provider keys (or demo mode, which uses
            deterministic fixtures and needs no network at all). In production every LLM call
            routes through the <strong>Model Gateway</strong> described in{" "}
            <code>18-production-system-design.md</code> — the Gateway enforces PHI redaction,
            prompt + model pinning, audit logging, and the same 10-mode safety guard stack you
            see streaming in the right-hand console.
          </p>
        </aside>

        <PipelineStepper />
      </div>
    </AppShell>
  );
}
