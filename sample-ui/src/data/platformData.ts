import type {
  ApiEndpointContract,
  ContradictionSignal,
  DemoStory,
  EntityContract,
  IntegrationFeed,
  MissingDataSignal,
  OverrideCluster,
  PiHandoffPacket,
  PilotAcceptanceCard,
  TaskModeCard,
  TrialMetricCard
} from "../types";

export const taskModeCards: TaskModeCard[] = [
  {
    id: "today",
    label: "Today",
    metric: "14 active cases",
    detail: "The fastest path to finished coordinator work before clinic.",
    promise: "The next best case is always easy to find."
  },
  {
    id: "clinic_prep",
    label: "Clinic Prep",
    metric: "6 consult-bound cases",
    detail: "Cases tied to the next 72 hours of visits or tumor board prep.",
    promise: "Consult-ready snapshots before the visit starts."
  },
  {
    id: "needs_pi_review",
    label: "Needs PI Review",
    metric: "7 open escalations",
    detail: "Ambiguity-heavy cases that need fast senior review, not more chart hunting.",
    promise: "Preserve context through the escalation handoff."
  },
  {
    id: "ready_for_outreach",
    label: "Ready for Outreach",
    metric: "4 same-day wins",
    detail: "Cases with evidence-backed fit and one clear next operational action.",
    promise: "Convert matching into action."
  },
  {
    id: "watchlist",
    label: "Watchlist / Re-screen",
    metric: "9 tracked changes",
    detail: "Continuous rescreening surfaces what changed instead of forcing a rerun hunt.",
    promise: "The system finds new work proactively."
  },
  {
    id: "ops_insights",
    label: "Ops Insights",
    metric: "3 hotspot families",
    detail: "Manager-level view of friction, capacity, and funnel movement.",
    promise: "Portfolio-level value stays visible."
  }
];

export const demoStories: DemoStory[] = [
  {
    id: "story-001",
    title: "Easy match with clear outreach path",
    patientId: "patient-003",
    trialId: "trial-003",
    category: "High-confidence match",
    promise: "Find work proactively",
    visibleBlocker: "None; fresh CBC cleared the final threshold.",
    nextAction: "Generate the outreach brief and convert the queue state to contact-ready.",
    managerMetric: "Same-day outreach conversion",
    wowFactor: "Shows a review that ends in action, not just analysis."
  },
  {
    id: "story-002",
    title: "False-positive trap caught by local site controls",
    patientId: "patient-002",
    trialId: "trial-002",
    category: "Activation guardrail",
    promise: "Explain each criterion clearly",
    visibleBlocker: "Local activation is still under verification.",
    nextAction: "Hold the case in protocol question until the trial is locally released.",
    managerMetric: "Avoided wasted coordinator review minutes",
    wowFactor: "Proves the product knows CTP site reality, not just protocol text."
  },
  {
    id: "story-003",
    title: "Missing-data case that stays honest",
    patientId: "patient-002",
    trialId: "trial-002",
    category: "Missing-domain uncertainty",
    promise: "Show uncertainty honestly",
    visibleBlocker: "Outside pathology packet is missing and central confirmation is required.",
    nextAction: "Route to document pull and keep the match visible on the watchlist.",
    managerMetric: "Uncertainty rate by missing-domain family",
    wowFactor: "Turns a vague no-go into an explainable, operationally useful hold."
  },
  {
    id: "story-004",
    title: "Contradiction-heavy case for PI escalation",
    patientId: "patient-001",
    trialId: "trial-001",
    category: "PI escalation",
    promise: "Keep the team in one workflow",
    visibleBlocker: "MRI interpretation conflicts with the oncology note on active CNS disease.",
    nextAction: "Open the PI handoff packet and preserve the case context through the escalation.",
    managerMetric: "Median PI resolution time",
    wowFactor: "Shows how the tool compresses an ambiguous case instead of burying it."
  },
  {
    id: "story-005",
    title: "Biomarker-led candidate rise overnight",
    patientId: "patient-001",
    trialId: "trial-001",
    category: "Biomarker + rescreen",
    promise: "Find work proactively",
    visibleBlocker: "Cardiac exclusion still open after the rescreen.",
    nextAction: "Keep on the watchlist while the PI resolves the exclusion policy question.",
    managerMetric: "Overnight reprioritized candidates",
    wowFactor: "Makes the overnight change digest feel alive and clinically meaningful."
  },
  {
    id: "story-006",
    title: "Washout timeline catches a hard exclusion",
    patientId: "patient-001",
    trialId: "trial-001",
    category: "Temporal exclusion",
    promise: "Explain each criterion clearly",
    visibleBlocker: "NSTEMI falls inside the 180-day lookback.",
    nextAction: "Keep the case internal and route it through PI review rather than outreach.",
    managerMetric: "Avoided false outreach attempts",
    wowFactor: "Shows the timeline rail plus deterministic rules working together."
  },
  {
    id: "story-007",
    title: "Manual-only criterion stays visibly human",
    patientId: "patient-004",
    trialId: "trial-001",
    category: "Governance boundary",
    promise: "Show uncertainty honestly",
    visibleBlocker: "Investigator judgment remains manual-only.",
    nextAction: "Keep the criterion visible and non-automated in the review packet.",
    managerMetric: "Manual-only criteria backlog",
    wowFactor: "Reinforces that the product augments judgment instead of replacing it."
  },
  {
    id: "story-008",
    title: "Portfolio view ties the case to ROI",
    patientId: "patient-003",
    trialId: "trial-003",
    category: "Ops command center",
    promise: "Prove operational ROI",
    visibleBlocker: "Contacted-to-consented drop-off remains the next bottleneck.",
    nextAction: "Use command-center metrics to shift coordinator time to outreach-ready cases.",
    managerMetric: "Screened-to-enrolled funnel movement",
    wowFactor: "Connects one case review to enterprise value."
  }
];

export const missingDataSignalsByMatch: Record<string, MissingDataSignal[]> = {
  "match-001": [
    {
      id: "missing-001",
      label: "Outside cardiology source packet",
      status: "aging",
      detail: "Discharge summary is in the bundle, but cath details are still missing for full exception review.",
      owner: "Outside records team",
      dueBy: "Before PI huddle today"
    },
    {
      id: "missing-002",
      label: "Tumor board interpretation note",
      status: "missing",
      detail: "The MRI conflict is visible, but the planned tumor board interpretation has not been attached yet.",
      owner: "Thoracic coordinator lead",
      dueBy: "Before Apr 9 consult"
    }
  ],
  "match-002": [
    {
      id: "missing-003",
      label: "Central pathology packet",
      status: "missing",
      detail: "Outside pathology confirmation has not been uploaded into the pilot evidence bundle.",
      owner: "GI oncology coordinator",
      dueBy: "Within 24 hours"
    },
    {
      id: "missing-004",
      label: "Local activation refresh",
      status: "stale",
      detail: "The CTMS activation feed is 19 hours old and must be refreshed before actioning the case.",
      owner: "Trial admin owner",
      dueBy: "Next nightly refresh"
    }
  ]
};

export const contradictionSignalsByMatch: Record<string, ContradictionSignal[]> = {
  "match-001": [
    {
      id: "contradiction-001",
      title: "MRI versus oncology note on active CNS disease",
      severity: "critical",
      summary: "Radiology raises concern for a new metastatic focus while the follow-up note documents no active CNS disease requiring therapy.",
      action: "Escalate the imaging language to the PI with the relevant note context preserved.",
      evidenceIds: ["evidence-007", "evidence-008"]
    }
  ]
};

export const piHandoffsByMatch: Record<string, PiHandoffPacket> = {
  "match-001": {
    id: "handoff-001",
    owner: "Lena Ortiz",
    dueBy: "Thoracic PI huddle at 9:00 AM",
    decisionNeeded: "Resolve the CNS contradiction and confirm whether the NSTEMI is disqualifying under protocol v4.2.",
    summary:
      "This handoff keeps the case in one flow: the patient snapshot, the two blocker criteria, the date math, and the exact evidence references needed for a PI decision.",
    questions: [
      "Does the Mar 30 MRI meet the protocol's definition of active CNS disease requiring therapy?",
      "Should the Nov 5 NSTEMI exclude the patient given the current planned screening date?",
      "If the MRI is treated as indeterminate, should the case remain on watchlist or move to closed_not_eligible?"
    ],
    recommendedArtifacts: [
      "Criterion 003 temporal trace",
      "Criterion 004 contradiction bundle",
      "Ask Agent PI summary draft",
      "Timeline rail screenshot for tumor board"
    ]
  }
};

export const apiEndpointCatalog: ApiEndpointContract[] = [
  {
    method: "POST",
    path: "/trials/import",
    summary: "Import or refresh trial inventory for the pilot scope",
    requestShape: "{ source: 'ctms', scope: 'oncology-pilot' }",
    responseShape: "{ importedTrials, staleTrials, refreshedAt }",
    owner: "Trial Catalog Service"
  },
  {
    method: "POST",
    path: "/trials/{trialId}/parse-criteria",
    summary: "Normalize protocol criteria for one trial",
    requestShape: "{ trialId, protocolVersion }",
    responseShape: "{ criteria: TrialCriterion[], computabilityMix }",
    owner: "Protocol Normalization Service"
  },
  {
    method: "POST",
    path: "/patients/{patientId}/screen",
    summary: "Screen one patient against the pilot trial set",
    requestShape: "{ patientId, queueScope, trigger }",
    responseShape: "{ screeningJob, recommendations }",
    owner: "Screening Orchestrator"
  },
  {
    method: "POST",
    path: "/patients/{patientId}/screen/{trialId}",
    summary: "Screen one patient against one trial",
    requestShape: "{ patientId, trialId }",
    responseShape: "{ reviewPackage }",
    owner: "Screening Orchestrator"
  },
  {
    method: "GET",
    path: "/patients/{patientId}/matches",
    summary: "List trial matches for one patient",
    requestShape: "patientId in path",
    responseShape: "{ recommendations: TrialMatchRecommendation[] }",
    owner: "Match Assembly Service"
  },
  {
    method: "GET",
    path: "/matches/{matchId}",
    summary: "Return one patient-trial review package",
    requestShape: "matchId in path",
    responseShape: "{ patient, trial, criteria, evidence, timeline, audit }",
    owner: "Review Workflow Service"
  },
  {
    method: "POST",
    path: "/assessments/{assessmentId}/override",
    summary: "Override one criterion result",
    requestShape: "{ status, rationale, reviewerId }",
    responseShape: "{ reviewAction, updatedAssessment }",
    owner: "Review Workflow Service"
  },
  {
    method: "POST",
    path: "/matches/{matchId}/finalize",
    summary: "Finalize the reviewed recommendation",
    requestShape: "{ disposition, rationale, reviewerId }",
    responseShape: "{ reviewAction, matchSummary }",
    owner: "Review Workflow Service"
  },
  {
    method: "POST",
    path: "/matches/{matchId}/outcome",
    summary: "Record downstream enrollment funnel outcome",
    requestShape: "{ outcome, actor }",
    responseShape: "{ reviewAction, updatedFunnel }",
    owner: "Analytics Service"
  },
  {
    method: "GET",
    path: "/metrics/screening",
    summary: "Return screening productivity and quality metrics",
    requestShape: "none",
    responseShape: "{ medianReviewTime, reviewedToday, falseExclusionRate }",
    owner: "Analytics Service"
  },
  {
    method: "GET",
    path: "/metrics/enrollment-funnel",
    summary: "Return screened-to-enrolled funnel metrics",
    requestShape: "none",
    responseShape: "{ screened, reviewed, contacted, eligible, consented, enrolled }",
    owner: "Analytics Service"
  },
  {
    method: "GET",
    path: "/metrics/trial/{trialId}",
    summary: "Return trial-level quality and funnel metrics",
    requestShape: "trialId in path",
    responseShape: "{ trialMetricCard, hotspotSummary }",
    owner: "Analytics Service"
  }
];

export const domainEntityCatalog: EntityContract[] = [
  {
    name: "Trial",
    purpose: "Current local trial record, activation state, and release scope.",
    keyFields: ["id", "shortCode", "localStatus", "protocolVersion", "releaseState"]
  },
  {
    name: "TrialVersion",
    purpose: "Versioned protocol history with amendment notes and release status.",
    keyFields: ["id", "version", "releasedAt", "status"]
  },
  {
    name: "TrialCriterion",
    purpose: "Atomic normalized criterion with computability and threshold metadata.",
    keyFields: ["id", "trialId", "type", "computability", "threshold", "owner"]
  },
  {
    name: "PatientEvidenceBundle",
    purpose: "Unified chart evidence with freshness and missing-domain visibility.",
    keyFields: ["id", "patientId", "coverageSummary", "freshnessSummary"]
  },
  {
    name: "PatientEvidenceItem",
    purpose: "One cited fact or source span used in criterion review.",
    keyFields: ["id", "sourceType", "sourceDate", "freshness", "linkedCriterionIds"]
  },
  {
    name: "ScreeningJob",
    purpose: "Replayable screening execution record across rescreens and manual triggers.",
    keyFields: ["id", "patientId", "trialScope", "status", "trigger"]
  },
  {
    name: "CriterionAssessment",
    purpose: "Pass, fail, uncertain, or manual-review result for one criterion.",
    keyFields: ["id", "status", "computability", "freshness", "evidenceIds"]
  },
  {
    name: "TrialMatchRecommendation",
    purpose: "Patient-trial package with blockers, next action, and queue state.",
    keyFields: ["id", "fitScore", "nextStep", "blockers", "taskModes"]
  },
  {
    name: "ReviewAction",
    purpose: "Immutable human action trail for overrides, finalization, and outcomes.",
    keyFields: ["id", "actionType", "result", "rationale", "timestamp"]
  },
  {
    name: "AssistantInteraction",
    purpose: "Governed Ask Agent turn with scope, saved state, and artifact type.",
    keyFields: ["id", "scope", "promptId", "outputKind", "savedState"]
  },
  {
    name: "AuditEvent",
    purpose: "Rule, prompt, model, and actor trace for replay and governance.",
    keyFields: ["id", "eventType", "ruleVersion", "promptVersion", "modelVersion"]
  }
];

export const integrationFeeds: IntegrationFeed[] = [
  {
    name: "CTMS / local trial inventory",
    mode: "Nightly sync",
    freshness: "24h SLA",
    role: "Active trial scope, PI ownership, release gating"
  },
  {
    name: "Epic structured evidence",
    mode: "Read-only data service",
    freshness: "Per screening job",
    role: "Diagnoses, labs, medications, therapies, appointments"
  },
  {
    name: "Epic notes, pathology, radiology",
    mode: "Indexed document feed",
    freshness: "Per screening job",
    role: "Semantic retrieval, contradictions, evidence provenance"
  },
  {
    name: "Genomics / biomarker feed",
    mode: "Scheduled import",
    freshness: "Daily",
    role: "Molecular trial matching and biomarker alias handling"
  },
  {
    name: "Outside records",
    mode: "Conditional import",
    freshness: "Visible when late",
    role: "Missing-domain status rather than silent absence"
  }
];

export const overrideClusters: OverrideCluster[] = [
  {
    family: "CNS disease status",
    reason: "Radiology language versus clinical note interpretation",
    count: 9,
    action: "Route these cases through the PI task mode before outreach decisions."
  },
  {
    family: "Cardiac exclusions",
    reason: "Outside event details arrive after the first screen run",
    count: 4,
    action: "Expand outside-record watchlist handling and show the event anchor date inline."
  },
  {
    family: "Local trial activation",
    reason: "Site-state refresh lags create false-positive operational matches",
    count: 3,
    action: "Keep release controls and stale-status banners visible in the queue."
  }
];

export const trialMetricCards: TrialMetricCard[] = [
  {
    trialId: "trial-001",
    shortCode: "LU-021",
    screened: 43,
    piEscalations: 8,
    outreachReady: 6,
    enrolled: 3,
    mainBlocker: "CNS contradiction plus cardiac lookback"
  },
  {
    trialId: "trial-002",
    shortCode: "GI-118",
    screened: 22,
    piEscalations: 3,
    outreachReady: 2,
    enrolled: 1,
    mainBlocker: "Activation verification and missing pathology"
  },
  {
    trialId: "trial-003",
    shortCode: "BC-077",
    screened: 31,
    piEscalations: 2,
    outreachReady: 9,
    enrolled: 4,
    mainBlocker: "Contacted-to-consented drop-off"
  }
];

export const pilotAcceptanceCards: PilotAcceptanceCard[] = [
  {
    label: "Criterion accuracy",
    status: "on_track",
    detail: "Offline target remains on pace with the frozen thoracic cases."
  },
  {
    label: "False exclusion guardrail",
    status: "on_track",
    detail: "Current review trend remains under the 3 percent pilot guardrail."
  },
  {
    label: "Outside-record coverage",
    status: "watch",
    detail: "Late external records still drive the largest uncertainty family."
  },
  {
    label: "Reviewer staffing",
    status: "risk",
    detail: "PI review load is clustering around the same ambiguity families each week."
  }
];
