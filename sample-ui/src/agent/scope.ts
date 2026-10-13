/*
 * Route + selection → AgentScope resolver.
 *
 * This file owns the mapping from browser URL (and optional in-page
 * selection) to the typed AgentScope the rest of the agent layer consumes.
 * Its original home was inside GlobalAskWidget.tsx as resolveContextFromPath
 * (lines 58-119); M1 lifts it out so that any future agent surface —
 * AskAgentPanel, AmbientInsightsRail, ambient tool calls — can share the
 * exact same context resolution.
 *
 * Extended beyond the original 5 route kinds to also recognize:
 *   /handoffs, /handoffs/:handoffId, /handoffs/:handoffId/audit,
 *   /insights, /data-ops, /compliance, /sponsor/:key, /portal/*, /referrals/*
 *
 * Confidentiality rules (guardrail — do not relax without security review):
 *   - sponsor routes   → "deidentified"
 *   - portal routes    → "patient_facing"
 *   - everything else  → "internal"
 * The agent layer MUST refuse to emit PHI-tagged fields when confidentiality
 * is anything other than "internal". In the mock client this is enforced at
 * the fixture level; in the real client it is enforced by the system prompt
 * + tool schema + a response-side validator.
 */

import { matchPath } from "react-router-dom";
import { getMatch, getPatient, getTrial } from "../data/mockData";
import type { AgentScope } from "../types/agent";
import type { WidgetPageContext } from "../types/agent";

/**
 * Back-compat projection of AgentScope into the legacy WidgetPageContext
 * shape that GlobalAskWidget still expects until M2 fully refactors the
 * drawer body. New code should read AgentScope directly.
 */
export interface RouteContext {
  scope: AgentScope;
  widgetContext: WidgetPageContext;
}

export function resolveScopeFromPath(pathname: string): RouteContext {
  const reviewMatch = matchPath("/review/:matchId", pathname);
  if (reviewMatch?.params.matchId) {
    const match = getMatch(reviewMatch.params.matchId);
    const patient = match ? getPatient(match.patientId) : undefined;
    const trial = match ? getTrial(match.trialId) : undefined;

    return {
      scope: {
        routeKind: "review",
        entityIds: {
          matchId: reviewMatch.params.matchId,
          patientId: match?.patientId,
          trialId: match?.trialId,
        },
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: `review:${reviewMatch.params.matchId}`,
        label: `${patient?.name ?? "Selected patient"} / ${trial?.shortCode ?? "trial"}`,
        scopeLabel: "This patient and trial",
        sessionId: `review-${reviewMatch.params.matchId}`,
        routeKind: "review",
      },
    };
  }

  const auditMatch = matchPath("/audit/:matchId", pathname);
  if (auditMatch?.params.matchId) {
    const match = getMatch(auditMatch.params.matchId);
    const patient = match ? getPatient(match.patientId) : undefined;
    const trial = match ? getTrial(match.trialId) : undefined;

    return {
      scope: {
        routeKind: "audit",
        entityIds: {
          matchId: auditMatch.params.matchId,
          patientId: match?.patientId,
          trialId: match?.trialId,
        },
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: `audit:${auditMatch.params.matchId}`,
        label: `${patient?.name ?? "Selected patient"} trace / ${trial?.shortCode ?? "trial"}`,
        scopeLabel: "This trace",
        sessionId: `audit-${auditMatch.params.matchId}`,
        routeKind: "audit",
      },
    };
  }

  const trialAdminMatch = matchPath("/admin/trials/:trialId", pathname);
  if (trialAdminMatch?.params.trialId) {
    const trial = getTrial(trialAdminMatch.params.trialId);

    return {
      scope: {
        routeKind: "trial_admin",
        entityIds: { trialId: trialAdminMatch.params.trialId },
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: `trial:${trialAdminMatch.params.trialId}`,
        label: `${trial?.shortCode ?? "Current trial"} / protocol admin`,
        scopeLabel: "This trial",
        sessionId: "trial-admin",
        routeKind: "trial_admin",
      },
    };
  }

  if (pathname === "/command-center") {
    return {
      scope: {
        routeKind: "command_center",
        entityIds: {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: "command-center",
        label: "Operations workspace",
        scopeLabel: "Workspace",
        sessionId: "command-center",
        routeKind: "command_center",
      },
    };
  }

  const researchDigestMatch = matchPath("/research-digests/digests/:digestId", pathname);
  if (researchDigestMatch?.params.digestId) {
    return {
      scope: {
        routeKind: "command_center",
        entityIds: {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: `research-digest:${researchDigestMatch.params.digestId}`,
        label: "Research digest review",
        scopeLabel: "Research digest",
        sessionId: "research-digest",
        routeKind: "command_center",
      },
    };
  }

  const researchProfileMatch = matchPath("/research-digests/profiles/:profileId", pathname);
  if (researchProfileMatch?.params.profileId) {
    return {
      scope: {
        routeKind: "command_center",
        entityIds: {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: `research-profile:${researchProfileMatch.params.profileId}`,
        label: "Research profile workspace",
        scopeLabel: "Research profile",
        sessionId: "research-profile",
        routeKind: "command_center",
      },
    };
  }

  if (pathname === "/research-digests") {
    return {
      scope: {
        routeKind: "command_center",
        entityIds: {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: "research-digests",
        label: "Research digest archive",
        scopeLabel: "Research archive",
        sessionId: "research-archive",
        routeKind: "command_center",
      },
    };
  }

  if (pathname === "/handoffs") {
    return {
      scope: {
        routeKind: "handoff_worklist",
        entityIds: {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: "handoffs",
        label: "Resident handoff worklist",
        scopeLabel: "Handoff worklist",
        sessionId: "handoff-worklist",
        routeKind: "handoff_worklist",
      },
    };
  }

  const handoffAuditMatch = matchPath("/handoffs/:handoffId/audit", pathname);
  if (handoffAuditMatch?.params.handoffId) {
    return {
      scope: {
        routeKind: "handoff_audit",
        entityIds: { handoffId: handoffAuditMatch.params.handoffId },
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: `handoff-audit:${handoffAuditMatch.params.handoffId}`,
        label: "Handoff audit trail",
        scopeLabel: "This handoff audit",
        sessionId: `handoff-audit-${handoffAuditMatch.params.handoffId}`,
        routeKind: "handoff_audit",
        handoffId: handoffAuditMatch.params.handoffId,
      },
    };
  }

  const handoffCaseMatch = matchPath("/handoffs/:handoffId", pathname);
  if (handoffCaseMatch?.params.handoffId) {
    return {
      scope: {
        routeKind: "handoff_case",
        entityIds: { handoffId: handoffCaseMatch.params.handoffId },
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: `handoff:${handoffCaseMatch.params.handoffId}`,
        label: "Handoff case",
        scopeLabel: "This handoff case",
        sessionId: `handoff-case-${handoffCaseMatch.params.handoffId}`,
        routeKind: "handoff_case",
        handoffId: handoffCaseMatch.params.handoffId,
      },
    };
  }

  // --- M2-M3 new routes ---

  if (pathname === "/insights" || pathname.startsWith("/insights/")) {
    return {
      scope: {
        routeKind: "insights",
        entityIds: {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: "insights",
        label: "Insights",
        scopeLabel: "Portfolio insights",
        sessionId: "insights",
        routeKind: "command_center",
      },
    };
  }

  if (pathname === "/data-ops" || pathname.startsWith("/data-ops/")) {
    const ruleMatch = matchPath("/data-ops/rules/:ruleId", pathname);
    return {
      scope: {
        routeKind: "data_ops",
        entityIds: ruleMatch?.params.ruleId ? {} : {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: ruleMatch?.params.ruleId ? `data-ops:${ruleMatch.params.ruleId}` : "data-ops",
        label: ruleMatch?.params.ruleId
          ? `Rule debugger / ${ruleMatch.params.ruleId}`
          : "Data operations",
        scopeLabel: "Data operations",
        sessionId: "data-ops",
        routeKind: "trial_admin",
      },
    };
  }

  if (pathname === "/compliance" || pathname.startsWith("/compliance/")) {
    return {
      scope: {
        routeKind: "irb",
        entityIds: {},
        confidentialityLevel: "internal",
      },
      widgetContext: {
        key: "compliance",
        label: "Compliance",
        scopeLabel: "IRB / compliance",
        sessionId: "compliance",
        routeKind: "trial_admin",
      },
    };
  }

  const sponsorMatch = matchPath("/sponsor/:sponsorKey", pathname);
  if (sponsorMatch?.params.sponsorKey) {
    return {
      scope: {
        routeKind: "sponsor",
        entityIds: {},
        // HARD GUARDRAIL: sponsor routes never see PHI.
        confidentialityLevel: "deidentified",
      },
      widgetContext: {
        key: `sponsor:${sponsorMatch.params.sponsorKey}`,
        label: `Sponsor / ${sponsorMatch.params.sponsorKey}`,
        scopeLabel: "Sponsor view (de-identified)",
        sessionId: "sponsor",
        routeKind: "command_center",
      },
    };
  }

  if (pathname.startsWith("/portal")) {
    return {
      scope: {
        routeKind: "portal",
        entityIds: {},
        // HARD GUARDRAIL: patient portal is patient-facing; plain language only.
        confidentialityLevel: "patient_facing",
      },
      widgetContext: {
        key: "portal",
        label: "Patient portal",
        scopeLabel: "Patient view",
        sessionId: "portal",
        routeKind: "cockpit",
      },
    };
  }

  if (pathname.startsWith("/referrals")) {
    return {
      scope: {
        routeKind: "referring",
        entityIds: {},
        confidentialityLevel: "deidentified",
      },
      widgetContext: {
        key: "referring",
        label: "Referral workspace",
        scopeLabel: "Referring physician",
        sessionId: "referring",
        routeKind: "cockpit",
      },
    };
  }

  return {
    scope: {
      routeKind: "cockpit",
      entityIds: {},
      confidentialityLevel: "internal",
    },
    widgetContext: {
      key: "cockpit",
      label: "Thoracic queue",
      scopeLabel: "This queue",
      sessionId: "cockpit",
      routeKind: "cockpit",
    },
  };
}

/**
 * Convenience: most call sites just want AgentScope without the legacy
 * widgetContext projection.
 */
export function resolveAgentScope(pathname: string): AgentScope {
  return resolveScopeFromPath(pathname).scope;
}
