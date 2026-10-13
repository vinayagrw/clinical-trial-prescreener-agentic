/*
 * F5 — Grounded Ask Agent (summary card).
 *
 * Unlike F1–F4 this feature is NOT a new component — the scope-bound,
 * explain-and-cite Ask Agent is already mounted globally in App.tsx via
 * `<GlobalAskWidget />` and is available on every route via the floating
 * button in the bottom-right corner.
 *
 * This card describes what the global widget does (tabs, scopes,
 * guardrails) and instructs the viewer how to try it live on this page.
 */

import { mockAskAgentFeature } from "../../data/aiFeaturesData";

export function AskAgentFeatureCard() {
  const { tabs, scopes, guardrails } = mockAskAgentFeature;

  return (
    <div className="aif-agent">
      <p className="aif-agent-global-note">
        <strong>Already live:</strong> the Ask Agent is mounted globally on every route in this
        sample UI. Click the floating button in the bottom-right corner — the widget answers
        questions scoped to the current patient, trial, queue, or audit trace, and it cites the
        evidence for every claim.
      </p>

      <p className="aif-section-subhead">Response tabs</p>
      <div className="aif-agent-grid">
        {tabs.map((tab) => (
          <article key={tab.key} className="aif-agent-tab">
            <span className="aif-agent-tab-key">{tab.key}</span>
            <span className="aif-agent-tab-label">{tab.label}</span>
            <span className="aif-agent-tab-desc">{tab.description}</span>
          </article>
        ))}
      </div>

      <p className="aif-section-subhead">Scope examples (route → scope → example prompt)</p>
      <div className="aif-agent-grid">
        {scopes.map((scope) => (
          <article key={scope.route} className="aif-agent-scope">
            <span className="aif-agent-scope-route">{scope.route}</span>
            <span className="aif-agent-scope-label">{scope.scopeLabel}</span>
            <span className="aif-agent-scope-prompt">“{scope.examplePrompt}”</span>
          </article>
        ))}
      </div>

      <p className="aif-section-subhead">Guardrails</p>
      <ul className="aif-agent-guardrails">
        {guardrails.map((guardrail) => (
          <li key={guardrail}>{guardrail}</li>
        ))}
      </ul>
    </div>
  );
}
