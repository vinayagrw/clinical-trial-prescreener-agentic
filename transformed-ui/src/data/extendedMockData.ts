import {
  queueItems,
  matches,
  patients,
  getPatient,
  getMatch,
} from "./index";
import type { NormalizedCriterion } from "@old/types";
import type {
  QueueItemEnriched,
  ChangeDigestItem,
  CollaborationThread,
  TaskLane,
  TaskLaneConfig,
  SuggestedPrompt,
  AgentConversationThread,
  ReleaseGate,
  TaskModeCard,
  DemoStory,
} from "../types/extended";

// Lane configuration
export const laneConfigs: TaskLaneConfig[] = [
  {
    id: "action_now",
    label: "Action Now",
    description: "Critical cases needing attention in the next 24h",
    icon: "🔴",
    accentColor: "--brick-500",
    sortKey: 0,
  },
  {
    id: "needs_pi",
    label: "Needs PI Input",
    description: "Blocked on clinical judgment or protocol interpretation",
    icon: "🟡",
    accentColor: "--amber-500",
    sortKey: 1,
  },
  {
    id: "ready_outreach",
    label: "Ready for Outreach",
    description: "All criteria met — ready to contact patient",
    icon: "🟢",
    accentColor: "--moss-500",
    sortKey: 2,
  },
  {
    id: "watching",
    label: "Watching",
    description: "Not ready now but monitoring for changes",
    icon: "👁",
    accentColor: "--slate-400",
    sortKey: 3,
  },
];

// Assign lane based on priority and nextStep
function assignLane(item: typeof queueItems[number]): TaskLane {
  if (item.priority === "critical") return "action_now";
  switch (item.nextStep) {
    case "needs_pi_review":
    case "protocol_question":
      return "needs_pi";
    case "candidate_for_outreach":
      return "ready_outreach";
    case "reviewed_not_actionable":
    case "closed_not_eligible":
      return "watching";
    default:
      return "action_now";
  }
}

// Build enriched queue items
export const enrichedQueueItems: QueueItemEnriched[] = queueItems.map((item) => {
  const patient = getPatient(item.patientId);
  const match = getMatch(item.matchId);

  return {
    ...item,
    lane: assignLane(item),
    whyNow: {
      patientId: item.patientId,
      matchId: item.matchId,
      whatChanged:
        item.flags.length > 0
          ? item.flags[0]
          : "No recent changes",
      whyUrgent: item.urgencyLabel,
      primaryBlocker: match?.blockers[0] ?? "None identified",
      recommendedAction:
        item.nextStep === "needs_pi_review"
          ? "Escalate to PI for review"
          : item.nextStep === "candidate_for_outreach"
          ? "Contact patient for enrollment"
          : item.nextStep === "protocol_question"
          ? "Clarify protocol criteria"
          : "Continue monitoring",
      dueBy: patient?.nextAppointment ?? "No appointment scheduled",
      changeTimestamp: item.lastUpdated,
    },
    recentChanges: [],
    collaborationCount: item.nextStep === "needs_pi_review" ? 1 : 0,
  };
});

// Change digest items (simulated overnight changes)
export const changeDigest: ChangeDigestItem[] = [
  {
    id: "change-001",
    timestamp: "7:14 AM",
    patientId: "patient-001",
    matchId: "match-001",
    changeType: "external_import",
    summary: "Outside cardiology discharge summary imported for Angela Brooks",
    impactLevel: "high",
  },
  {
    id: "change-002",
    timestamp: "7:14 AM",
    patientId: "patient-001",
    matchId: "match-001",
    changeType: "rescreen",
    summary: "Angela Brooks rescreened — MI exclusion criterion reassessed",
    impactLevel: "high",
  },
  {
    id: "change-003",
    timestamp: "6:52 AM",
    patientId: "patient-002",
    matchId: "match-002",
    changeType: "score_change",
    summary: "Robert Hale fit score rose from 78 to 84 after new genomic data",
    impactLevel: "medium",
  },
  {
    id: "change-004",
    timestamp: "6:30 AM",
    patientId: "patient-003",
    matchId: "match-003",
    changeType: "new_evidence",
    summary: "Fresh CBC results available for Diane Foster — all thresholds met",
    impactLevel: "medium",
  },
  {
    id: "change-005",
    timestamp: "5:45 AM",
    patientId: "patient-004",
    matchId: "match-004",
    changeType: "status_change",
    summary: "Marcus Green marrow report flagged as stale (>30 days)",
    impactLevel: "low",
  },
  {
    id: "change-006",
    timestamp: "4:00 AM",
    patientId: "patient-001",
    matchId: "match-001",
    changeType: "rescreen",
    summary: "Continuous rescreening moved 3 patients to top of queue",
    impactLevel: "high",
  },
  {
    id: "change-007",
    timestamp: "3:30 AM",
    patientId: "patient-002",
    matchId: "match-002",
    changeType: "status_change",
    summary: "Trial GI-118 activation feed has not refreshed in 19 hours",
    impactLevel: "medium",
  },
  {
    id: "change-008",
    timestamp: "7:46 AM",
    patientId: "patient-005",
    matchId: "match-005a",
    changeType: "new_evidence",
    summary: "MLH1/PMS2 loss confirmed on IHC for Priya Venkataraman-Krishnamurthy — two trials now match",
    impactLevel: "high",
  },
  {
    id: "change-009",
    timestamp: "7:50 AM",
    patientId: "patient-005",
    matchId: "match-005b",
    changeType: "score_change",
    summary: "Cross-trial comparison completed: EN-094 ranks above PT-052 for Priya",
    impactLevel: "medium",
  },
  {
    id: "change-010",
    timestamp: "6:16 AM",
    patientId: "patient-004",
    matchId: "match-004",
    changeType: "status_change",
    summary: "Marcus Green routed to watchlist (disease mismatch against LU-021; held for FLT3 trials)",
    impactLevel: "low",
  },
  {
    id: "change-011",
    timestamp: "5:34 AM",
    patientId: "patient-006",
    matchId: "match-006",
    changeType: "external_import",
    summary: "Jordan Rivera intake complete — outside records packet requested from referring dermatology",
    impactLevel: "medium",
  },
];

// Collaboration threads
export const collaborationThreads: CollaborationThread[] = [
  {
    id: "collab-001",
    matchId: "match-001",
    initiator: "Lena Ortiz",
    escalatedTo: "Dr. Maya Shah",
    status: "open",
    question:
      "MRI shows new punctate enhancing focus in right frontal lobe. Oncology note says no active CNS disease. Should this be classified as active metastatic disease for trial exclusion?",
    responses: [
      {
        id: "resp-001",
        author: "Dr. Maya Shah",
        text: "Will review at tumor board this Thursday. Hold for now — do not exclude based on this alone.",
        timestamp: "Apr 5, 2026 · 2:15 PM",
      },
    ],
    createdAt: "Apr 5, 2026 · 11:30 AM",
  },
  {
    id: "collab-002",
    matchId: "match-001",
    initiator: "Lena Ortiz",
    escalatedTo: "Dr. Maya Shah",
    status: "waiting",
    question:
      "NSTEMI was Nov 5, 2025. Screening date Apr 6, 2026 = 152 days. Protocol says 180 days. Patient is 28 days short. Is there any provision for borderline cases?",
    responses: [],
    createdAt: "Apr 6, 2026 · 8:00 AM",
  },
  // --- Robert Hale (match-002) — stale data blocker ---
  {
    id: "collab-003",
    matchId: "match-002",
    initiator: "Lena Ortiz",
    escalatedTo: "Dr. Nina Patel",
    status: "open",
    question:
      "Robert Hale's last ECOG note is from Feb 4 (62 days ago) and we have no fresh CMP. Can we get an updated clinic assessment plus hepatic panel at his Apr 8 visit before I move him to outreach?",
    responses: [
      {
        id: "resp-003",
        author: "Dr. Nina Patel",
        text: "Yes — I'll document ECOG and order hepatic panel at the Apr 8 visit. Please rescreen once results land.",
        timestamp: "Apr 6, 2026 · 7:20 AM",
      },
    ],
    createdAt: "Apr 6, 2026 · 6:55 AM",
  },
  // --- Diane Foster (match-003) — happy path ---
  {
    id: "collab-004",
    matchId: "match-003",
    initiator: "Lena Ortiz",
    escalatedTo: "Dr. Elise Warren",
    status: "resolved",
    question:
      "Diane Foster has all 6 criteria passing with fresh evidence. Confirming we're good to reach out before her Apr 10 appointment?",
    responses: [
      {
        id: "resp-004",
        author: "Dr. Elise Warren",
        text: "Confirmed — proceed with outreach. I'll have the trial discussion at her Apr 10 visit.",
        timestamp: "Apr 6, 2026 · 7:12 AM",
      },
    ],
    createdAt: "Apr 6, 2026 · 7:09 AM",
  },
  // --- Marcus Green (match-004) — disease mismatch watchlist ---
  {
    id: "collab-005",
    matchId: "match-004",
    initiator: "Lena Ortiz",
    escalatedTo: "Dr. Hannah Rice",
    status: "resolved",
    question:
      "Marcus Green auto-matched to LU-021 but that's NSCLC-only; he has relapsed AML. Confirming we can close LU-021 and hold him on the AML watchlist for the next FLT3 trial cohort?",
    responses: [
      {
        id: "resp-005",
        author: "Dr. Hannah Rice",
        text: "Yes — close LU-021 as disease mismatch. Keep him at the top of the FLT3 watchlist; I'll flag him for the Q3 AML basket if activation confirms.",
        timestamp: "Apr 6, 2026 · 6:30 AM",
      },
    ],
    createdAt: "Apr 6, 2026 · 6:20 AM",
  },
  // --- Priya (match-005a / 005b) — cross-trial ranking ---
  {
    id: "collab-006",
    matchId: "match-005a",
    initiator: "Lena Ortiz",
    escalatedTo: "Dr. Rachel Kim",
    status: "waiting",
    question:
      "Priya Venkataraman-Krishnamurthy matches both EN-094 (endometrial-specific) and PT-052 (pan-tumor MMR-d). Both pass all deterministic criteria. Which do we pursue first — EN-094 for disease specificity, or PT-052 for slot availability?",
    responses: [
      {
        id: "resp-006",
        author: "Dr. Rachel Kim",
        text: "Lead with EN-094 — the disease-specific arm has better historical response in endometrial. Keep PT-052 as backup if EN-094 slot is delayed.",
        timestamp: "Apr 6, 2026 · 8:10 AM",
      },
    ],
    createdAt: "Apr 6, 2026 · 7:52 AM",
  },
  // --- Jordan Rivera (match-006) — incomplete profile ---
  {
    id: "collab-007",
    matchId: "match-006",
    initiator: "Lena Ortiz",
    escalatedTo: "Dr. Thomas Yuan",
    status: "open",
    question:
      "Jordan Rivera referred from outside dermatology with BRAF V600E melanoma, but outside records and MMR testing haven't landed yet. Hold screening until packet arrives (~5 business days), or begin in-house staging now?",
    responses: [],
    createdAt: "Apr 6, 2026 · 5:40 AM",
  },
];

// Suggested prompts by page context
export const suggestedPromptsByPage: Record<string, SuggestedPrompt[]> = {
  "mission-control": [
    { id: "sp-mc-1", text: "Which patients need action in the next 24 hours?", category: "queue", icon: "⚡" },
    { id: "sp-mc-2", text: "Who has been waiting longest for PI review?", category: "queue", icon: "⏳" },
    { id: "sp-mc-3", text: "What changed in my queue overnight?", category: "queue", icon: "🌙" },
    { id: "sp-mc-4", text: "Compare readiness of all critical-priority patients", category: "queue", icon: "📊" },
    { id: "sp-mc-5", text: "Which cases are blocked by missing outside records?", category: "queue", icon: "📋" },
    { id: "sp-mc-6", text: "How many patients are ready for outreach today?", category: "queue", icon: "📞" },
  ],
  review: [
    { id: "sp-rv-1", text: "Why is this patient uncertain for this trial?", category: "patient", icon: "❓" },
    { id: "sp-rv-2", text: "Explain the cardiac exclusion timeline", category: "evidence", icon: "❤️" },
    { id: "sp-rv-3", text: "What evidence contradicts the CNS criterion?", category: "evidence", icon: "🧠" },
    { id: "sp-rv-4", text: "Is the lab still within the 14-day screening window?", category: "evidence", icon: "🔬" },
    { id: "sp-rv-5", text: "Draft a PI escalation summary for this case", category: "patient", icon: "📝" },
    { id: "sp-rv-6", text: "Compare this patient's eligibility across all matching trials", category: "trial", icon: "⚖️" },
  ],
  insights: [
    { id: "sp-in-1", text: "What's driving the high uncertainty rate in CNS criteria?", category: "operations", icon: "📈" },
    { id: "sp-in-2", text: "How has our false exclusion rate trended this month?", category: "operations", icon: "📉" },
    { id: "sp-in-3", text: "Which trial has the biggest drop-off in the funnel?", category: "trial", icon: "🔍" },
    { id: "sp-in-4", text: "Compare coordinator review times this week vs last week", category: "operations", icon: "⏱" },
  ],
  "trial-config": [
    { id: "sp-tc-1", text: "What changed between protocol v4.1 and v4.2?", category: "trial", icon: "📄" },
    { id: "sp-tc-2", text: "Which criteria in this trial are manual-only?", category: "trial", icon: "✋" },
    { id: "sp-tc-3", text: "How many patients are affected by the CNS exclusion wording?", category: "trial", icon: "👥" },
  ],
};

// Mock agent conversation for demo
export const mockAgentConversation: AgentConversationThread = {
  id: "conv-001",
  title: "AI-guided eligibility analysis",
  messages: [
    {
      id: "msg-001",
      role: "user",
      content: "What are the main blockers across my queue today?",
      timestamp: "8:02 AM",
    },
    {
      id: "msg-002",
      role: "agent",
      content:
        "The main blockers across your active queue are **temporal exclusions** and **missing outside records**. Among 4 active patient-trial matches, the most common blocker types are:",
      timestamp: "8:02 AM",
      table: {
        headers: ["BLOCKER TYPE", "PATIENTS AFFECTED", "STATUS"],
        rows: [
          ["MI within 6 months (temporal)", "1", "Fail — 28 days short"],
          ["CNS disease wording conflict", "1", "Uncertain — PI review pending"],
          ["Missing outside pathology", "1", "Blocked — awaiting document"],
          ["Trial activation unverified", "1", "Blocked — feed stale 19h"],
          ["Manual-only PI judgment", "2", "Expected human review"],
        ],
      },
      citations: [
        { id: "cite-001", label: "Cardiology Discharge", sourceDate: "Nov 5, 2025", tone: "supporting" },
        { id: "cite-002", label: "MRI Brain", sourceDate: "Mar 30, 2026", tone: "contradicting" },
      ],
      confidenceNote: "Based on 10 evidence sources across 4 patient-trial matches. Note: 2 sources conflict on CNS disease status.",
    },
    {
      id: "msg-003",
      role: "user",
      content: "Explain the MI exclusion timeline for Angela Brooks",
      timestamp: "8:04 AM",
    },
    {
      id: "msg-004",
      role: "agent",
      content:
        "Angela Brooks had an **NSTEMI event on November 5, 2025** at Lakeside General Hospital. The trial LU-021 excludes patients with myocardial infarction within **6 months (180 days)** of screening.\n\nThe planned screening date of **April 6, 2026** is **152 days** after the event — which falls **within** the 6-month exclusion window by **28 days**. The criterion is currently marked as **fail**.\n\nHowever, follow-up cardiology notes indicate stable recovery with no recurrent chest pain since the hospitalization.",
      timestamp: "8:04 AM",
      table: {
        headers: ["EVENT", "DATE", "DAYS TO SCREENING", "THRESHOLD"],
        rows: [
          ["NSTEMI admission", "Nov 5, 2025", "152 days", "180 days required"],
          ["Cardiology follow-up", "Jan 12, 2026", "84 days", "—"],
          ["Planned screening", "Apr 6, 2026", "0 (today)", "—"],
          ["Exclusion window ends", "May 4, 2026", "28 days from now", "180 days from event"],
        ],
      },
      citations: [
        { id: "cite-003", label: "Lakeside General Discharge Summary", sourceDate: "Nov 5, 2025", tone: "supporting" },
        { id: "cite-004", label: "Cardiology Office Note", sourceDate: "Jan 12, 2026", tone: "context" },
      ],
      confidenceNote: "High confidence. Dates are deterministic from structured records. The 28-day gap is borderline — consider escalating to PI for exemption review.",
    },
    {
      id: "msg-005",
      role: "user",
      content: "Which patients are ready for outreach today?",
      timestamp: "8:06 AM",
    },
    {
      id: "msg-006",
      role: "agent",
      content:
        "**1 patient** is currently ready for outreach. Diane Foster has a high-confidence match with no active blockers.",
      timestamp: "8:06 AM",
      table: {
        headers: ["PATIENT", "TRIAL", "FIT SCORE", "BLOCKERS", "NEXT APPOINTMENT"],
        rows: [
          ["Diane Foster", "BC-077 (Phase 1b/2 IO TNBC)", "88", "None", "Apr 10, 2026 · 1:30 PM"],
        ],
      },
      citations: [
        { id: "cite-005", label: "CBC with Differential", sourceDate: "Apr 1, 2026", tone: "supporting" },
      ],
      confidenceNote: "Based on fresh lab results from Apr 1. All inclusion criteria pass. No exclusion criteria triggered. Recommendation: contact before Apr 10 appointment.",
    },
  ],
  context: {
    page: "mission-control",
  },
};

// --- Trial-specific normalized criteria ---
// Keyed by trialId so TrialConfigPage can render the right criterion set per trial.
// Falls back to the global normalizedCriteria when a trialId is not listed.
// The raw declaration omits trialId on each entry since it's already present as
// the outer map key; we inject it below so the exported value matches
// NormalizedCriterion[] exactly. This avoids duplicating the id on every row.
const trialCriteriaByIdRaw: Record<string, Omit<NormalizedCriterion, "trialId">[]> = {
  "trial-001": [
    {
      id: "norm-lu-001",
      label: "Metastatic NSCLC with EGFR exon20 insertion",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Pathology + genomic confirmation required",
      owner: "Research informatics",
      note: "Mapped to pathology, genomics, and stage fields.",
    },
    {
      id: "norm-lu-002",
      label: "Progressed after platinum-based chemotherapy",
      type: "inclusion",
      computability: "hybrid",
      threshold: "Prior line plus progression event",
      owner: "Clinical NLP + reviewer",
      note: "Requires note-level progression context.",
    },
    {
      id: "norm-lu-003",
      label: "No myocardial infarction within 6 months",
      type: "exclusion",
      computability: "deterministic",
      threshold: "Cardiac event lookback 180 days",
      owner: "Rules service",
      note: "Anchored to screening date.",
    },
    {
      id: "norm-lu-004",
      label: "No active CNS metastases requiring therapy",
      type: "exclusion",
      computability: "hybrid",
      threshold: "MRI + oncology interpretation",
      owner: "Clinical reviewer",
      note: "Conflicting evidence defaults to uncertain.",
    },
    {
      id: "norm-lu-005",
      label: "Adequate CBC within 14 days",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ANC >= 1.5, platelets >= 100",
      owner: "Rules service",
      note: "Lab freshness enforced at threshold time.",
    },
    {
      id: "norm-lu-006",
      label: "Investigator judges patient appropriate",
      type: "inclusion",
      computability: "manual_only",
      threshold: "PI judgment only",
      owner: "PI reviewer",
      note: "Never auto-finalized.",
    },
  ],
  "trial-002": [
    {
      id: "norm-gi-001",
      label: "Advanced cholangiocarcinoma with FGFR2 fusion",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Pathology plus molecular confirmation",
      owner: "Research informatics",
      note: "FoundationOne CDx satisfies molecular branch.",
    },
    {
      id: "norm-gi-002",
      label: "ECOG 0 or 1 within 30 days",
      type: "inclusion",
      computability: "hybrid",
      threshold: "ECOG documented within 30 days of screening",
      owner: "Clinical NLP",
      note: "Stale ECOG notes trigger manual rescreen.",
    },
    {
      id: "norm-gi-003",
      label: "Adequate hepatic function (bilirubin < 1.5x ULN)",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Bilirubin < 1.5x ULN within 14 days",
      owner: "Rules service",
      note: "CMP freshness enforced.",
    },
    {
      id: "norm-gi-004",
      label: "No prior FGFR inhibitor therapy",
      type: "exclusion",
      computability: "deterministic",
      threshold: "No prior FGFR-directed therapy",
      owner: "Rules service",
      note: "Beacon medication history.",
    },
    {
      id: "norm-gi-005",
      label: "Biliary stent functional or absent",
      type: "inclusion",
      computability: "manual_only",
      threshold: "Functional stent or no biliary obstruction",
      owner: "PI reviewer",
      note: "Stent patency assessed by treating team.",
    },
    {
      id: "norm-gi-006",
      label: "Life expectancy greater than 3 months",
      type: "inclusion",
      computability: "manual_only",
      threshold: "PI attestation",
      owner: "PI reviewer",
      note: "Never auto-finalized.",
    },
  ],
  "trial-003": [
    {
      id: "norm-bc-001",
      label: "Metastatic triple-negative breast cancer",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Pathology + stage IV",
      owner: "Research informatics",
      note: "ER/PR/HER2 negative IHC required.",
    },
    {
      id: "norm-bc-002",
      label: "Measurable disease per RECIST 1.1",
      type: "inclusion",
      computability: "deterministic",
      threshold: "At least one RECIST-measurable lesion",
      owner: "Rules service",
      note: "Target lesion extraction from radiology.",
    },
    {
      id: "norm-bc-003",
      label: "PD-L1 CPS >= 10",
      type: "inclusion",
      computability: "deterministic",
      threshold: "CPS >= 10 by 22C3 pharmDx",
      owner: "Rules service",
      note: "IHC result required.",
    },
    {
      id: "norm-bc-004",
      label: "No prior immune checkpoint inhibitor therapy",
      type: "exclusion",
      computability: "deterministic",
      threshold: "No prior anti-PD-1/PD-L1 or anti-CTLA-4",
      owner: "Rules service",
      note: "Beacon medication history.",
    },
    {
      id: "norm-bc-005",
      label: "Adequate labs within 7 days",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ANC >= 1.5, platelets >= 100, hemoglobin >= 9",
      owner: "Rules service",
      note: "Tight freshness window.",
    },
    {
      id: "norm-bc-006",
      label: "ECOG 0 or 1 within 14 days",
      type: "inclusion",
      computability: "hybrid",
      threshold: "ECOG <= 1 documented within 14 days",
      owner: "Clinical NLP",
      note: "Extracted from oncology notes.",
    },
  ],
  "trial-004": [
    {
      id: "norm-en-001",
      label: "Histologically confirmed recurrent endometrial adenocarcinoma",
      type: "inclusion",
      computability: "deterministic",
      threshold: "Histologic confirmation of recurrence",
      owner: "Research informatics",
      note: "Recurrence biopsy required.",
    },
    {
      id: "norm-en-002",
      label: "MSI-high confirmed by IHC or PCR",
      type: "inclusion",
      computability: "deterministic",
      threshold: "MSI-H by IHC or PCR",
      owner: "Rules service",
      note: "Orthogonal assays accepted.",
    },
    {
      id: "norm-en-003",
      label: "No prior anti-PD-1 or anti-PD-L1 therapy",
      type: "exclusion",
      computability: "deterministic",
      threshold: "No prior anti-PD-1 / anti-PD-L1",
      owner: "Rules service",
      note: "Beacon medication history.",
    },
    {
      id: "norm-en-004",
      label: "Adequate organ function within 21 days",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ANC >= 1.5, platelets >= 100, bilirubin < 1.5x ULN",
      owner: "Rules service",
      note: "Generous 21-day window.",
    },
    {
      id: "norm-en-005",
      label: "Measurable disease per RECIST 1.1",
      type: "inclusion",
      computability: "deterministic",
      threshold: "At least one RECIST-measurable target lesion",
      owner: "Rules service",
      note: "Target lesion extraction from radiology.",
    },
    {
      id: "norm-en-006",
      label: "ECOG 0 or 1 within 14 days",
      type: "inclusion",
      computability: "hybrid",
      threshold: "ECOG <= 1 within 14 days",
      owner: "Clinical NLP",
      note: "Clinic note required.",
    },
    {
      id: "norm-en-007",
      label: "No active autoimmune disease requiring systemic therapy",
      type: "exclusion",
      computability: "hybrid",
      threshold: "No autoimmune flare requiring steroids in 12 months",
      owner: "Clinical reviewer",
      note: "Problem list + medication cross-check.",
    },
    {
      id: "norm-en-008",
      label: "Investigator judges patient appropriate",
      type: "inclusion",
      computability: "manual_only",
      threshold: "PI judgment only",
      owner: "PI reviewer",
      note: "Never auto-finalized.",
    },
  ],
  "trial-005": [
    {
      id: "norm-pt-001",
      label: "MMR-deficient solid tumor confirmed",
      type: "inclusion",
      computability: "deterministic",
      threshold: "MMR-deficient by IHC or MSI-high by PCR",
      owner: "Rules service",
      note: "Pan-tumor eligibility.",
    },
    {
      id: "norm-pt-002",
      label: "Prior systemic therapy exposure",
      type: "inclusion",
      computability: "deterministic",
      threshold: "At least one prior systemic therapy",
      owner: "Rules service",
      note: "Beacon medication history.",
    },
    {
      id: "norm-pt-003",
      label: "No prior anti-PD-1 or anti-PD-L1 therapy",
      type: "exclusion",
      computability: "deterministic",
      threshold: "No prior anti-PD-1 / anti-PD-L1",
      owner: "Rules service",
      note: "Pan-tumor basket — IO-naive required.",
    },
    {
      id: "norm-pt-004",
      label: "Adequate labs within 14 days",
      type: "inclusion",
      computability: "deterministic",
      threshold: "ANC >= 1.5, platelets >= 100 within 14 days",
      owner: "Rules service",
      note: "Tight freshness window.",
    },
    {
      id: "norm-pt-005",
      label: "Life expectancy greater than 6 months",
      type: "inclusion",
      computability: "manual_only",
      threshold: "PI attestation — life expectancy > 6 months",
      owner: "PI reviewer",
      note: "Never auto-finalized.",
    },
  ],
};

// Inject trialId from each outer key into every criterion so the exported
// shape satisfies NormalizedCriterion[] without hand-duplicating the id on
// every row of the raw literal.
export const trialCriteriaById: Record<string, NormalizedCriterion[]> = Object.fromEntries(
  Object.entries(trialCriteriaByIdRaw).map(([trialId, criteria]) => [
    trialId,
    criteria.map((c) => ({ ...c, trialId })),
  ])
);

// ============================================================================
// Release gates — per-trial readiness checklists for going live
// ============================================================================
// Used by `ReleaseGateStrip` on TrialConfigPage. Gates are written as a short
// readiness story: the first 2–3 are already complete (safety guardrails in
// place), the next one or two are pending coordinator/PI work, and any
// blocked gate surfaces a hard stop.

export const releaseGatesByTrial: Record<string, ReleaseGate[]> = {
  "trial-001": [
    {
      id: "gate-001-1",
      trialId: "trial-001",
      label: "IRB approval on file",
      detail: "Protocol LU-021 v2.3 approved 2026-01-18; annual review not yet due.",
      status: "complete",
    },
    {
      id: "gate-001-2",
      trialId: "trial-001",
      label: "Criteria normalized and signed off",
      detail: "6/6 criteria reviewed by protocol service; 2 require PI attestation at runtime.",
      status: "complete",
    },
    {
      id: "gate-001-3",
      trialId: "trial-001",
      label: "Dry-run cohort validated",
      detail: "Shadow-screened 40 historical patients; 3 disagreements with PI — all expected edge cases.",
      status: "complete",
    },
    {
      id: "gate-001-4",
      trialId: "trial-001",
      label: "Coordinator playbook attached",
      detail: "Escalation paths for temporal exclusions and manual attestations documented.",
      status: "pending",
    },
    {
      id: "gate-001-5",
      trialId: "trial-001",
      label: "Live screening signoff from Dr. Chen",
      detail: "Final PI release. Waiting on response to the Angela Brooks edge case discussion.",
      status: "pending",
    },
  ],
  "trial-002": [
    {
      id: "gate-002-1",
      trialId: "trial-002",
      label: "IRB approval on file",
      detail: "Protocol GI-118 v1.4 approved; next review due 2026-08-01.",
      status: "complete",
    },
    {
      id: "gate-002-2",
      trialId: "trial-002",
      label: "Criteria normalized and signed off",
      detail: "All 6 FGFR2 panel criteria normalized.",
      status: "complete",
    },
    {
      id: "gate-002-3",
      trialId: "trial-002",
      label: "Lab vendor integration tested",
      detail: "FGFR2 rearrangement panel requires external lab — vendor ingestion in integration testing.",
      status: "pending",
    },
    {
      id: "gate-002-4",
      trialId: "trial-002",
      label: "Dry-run cohort validated",
      detail: "Blocked on lab vendor integration before a shadow cohort can be run end-to-end.",
      status: "blocked",
    },
  ],
  "trial-003": [
    {
      id: "gate-003-1",
      trialId: "trial-003",
      label: "IRB approval on file",
      detail: "Protocol BC-077 v3.1 approved 2026-02-02; amendment under review.",
      status: "complete",
    },
    {
      id: "gate-003-2",
      trialId: "trial-003",
      label: "Criteria normalized and signed off",
      detail: "6/6 TNBC criteria reviewed; zero open disagreements.",
      status: "complete",
    },
    {
      id: "gate-003-3",
      trialId: "trial-003",
      label: "Dry-run cohort validated",
      detail: "100% agreement on 50-patient shadow cohort; fastest trial to reach this gate.",
      status: "complete",
    },
    {
      id: "gate-003-4",
      trialId: "trial-003",
      label: "Live screening signoff from PI",
      detail: "Waiting on final release from Dr. Park; expected this week.",
      status: "pending",
    },
  ],
  "trial-004": [
    {
      id: "gate-004-1",
      trialId: "trial-004",
      label: "IRB approval on file",
      detail: "Protocol EN-094 v1.0 approved 2026-03-15; first trial on the new MSI-high basket.",
      status: "complete",
    },
    {
      id: "gate-004-2",
      trialId: "trial-004",
      label: "Criteria normalized and signed off",
      detail: "8/8 criteria normalized; MSI-high detection rule is fully deterministic.",
      status: "complete",
    },
    {
      id: "gate-004-3",
      trialId: "trial-004",
      label: "Dry-run cohort validated",
      detail: "30-patient shadow run complete; Priya Venkataraman-Krishnamurthy flagged as first pilot candidate.",
      status: "complete",
    },
    {
      id: "gate-004-4",
      trialId: "trial-004",
      label: "Live screening signoff from Dr. Kim",
      detail: "Pending PI final attestation.",
      status: "pending",
    },
  ],
  "trial-005": [
    {
      id: "gate-005-1",
      trialId: "trial-005",
      label: "IRB approval on file",
      detail: "Protocol PT-052 v2.0 approved.",
      status: "complete",
    },
    {
      id: "gate-005-2",
      trialId: "trial-005",
      label: "Criteria normalized and signed off",
      detail: "5/5 criteria normalized; life-expectancy attestation remains a manual gate.",
      status: "complete",
    },
    {
      id: "gate-005-3",
      trialId: "trial-005",
      label: "Dry-run cohort validated",
      detail: "Screening new pediatric oncology basket — awaiting first cohort run.",
      status: "pending",
    },
    {
      id: "gate-005-4",
      trialId: "trial-005",
      label: "Live screening signoff from PI",
      detail: "Cannot proceed without dry-run results.",
      status: "blocked",
    },
  ],
};

// ============================================================================
// Task modes — coordinator job-mode pivots for Mission Control
// ============================================================================
// Ported from sample-ui/src/data/platformData.ts. Each mode maps
// to a TaskLane filter in MissionControlPage; the metric + detail strings
// are static copy for the demo — the numeric summaries are recomputed at
// render time from live queue state.

export const taskModes: TaskModeCard[] = [
  {
    id: "today",
    label: "Today",
    metric: "Work due by EOD",
    detail: "Same-day actions — patients who need outreach, labs, or PI pings before the day ends.",
  },
  {
    id: "clinic_prep",
    label: "Clinic prep",
    metric: "Pre-visit briefs",
    detail: "Ready-to-brief charts for tomorrow's clinic so coordinators walk in prepped.",
  },
  {
    id: "needs_pi_review",
    label: "Needs PI review",
    metric: "Waiting on escalation",
    detail: "Escalations to principal investigators — contradictions, edge cases, and manual attestations.",
  },
  {
    id: "ready_for_outreach",
    label: "Ready for outreach",
    metric: "Greenlit patients",
    detail: "Cleared by rules and PI; just waiting on the coordinator to reach out.",
  },
  {
    id: "watchlist",
    label: "Watchlist",
    metric: "Rescreen candidates",
    detail: "Re-screen after washout ends, missing evidence expected, or pending outside records.",
  },
  {
    id: "ops",
    label: "Ops insights",
    metric: "Portfolio health",
    detail: "Funnel, hotspot, and trial portfolio checks for operations leads.",
  },
];

// ============================================================================
// Demo stories — curated narrative proof-points for the sales demo
// ============================================================================
// Hand-written against 15's actual patient/trial/match ids (not copied from
// 14's platformData.ts, which used a different id namespace). Each story is
// a clickable card in DemoStoryBoard that deep-links into Deep Review.

export const demoStories: DemoStory[] = [
  {
    id: "story-001",
    category: "Temporal exclusion",
    title: "Angela Brooks — NSTEMI inside the 180-day lookback",
    wowFactor:
      "Automatically surfaces a failing exclusion window pulled from cardiology notes, with the exact anchor event date highlighted.",
    patientId: "patient-001",
    trialId: "trial-001",
    matchId: "match-001",
    visibleBlocker: "180-day MACE exclusion triggered by Nov 5, 2025 NSTEMI admission.",
    nextAction: "Rescreen on May 5, 2026 once the washout window closes.",
    managerMetric: "Zero coordinator hours spent digging through the cardiology note.",
    promise: "Temporal reasoning is a first-class rule, not a footnote.",
  },
  {
    id: "story-002",
    category: "Stale-data hold",
    title: "Robert Hale — ECOG status older than eligibility window",
    wowFactor:
      "Evidence panel flags the ECOG note as stale against the 14-day freshness threshold and holds outreach until a fresh lab lands.",
    patientId: "patient-002",
    trialId: "trial-002",
    matchId: "match-002",
    visibleBlocker: "Last ECOG assessment was 42 days ago; threshold is 14.",
    nextAction: "Request updated performance status from the care team before next touch.",
    managerMetric: "Prevents a premature outreach that would burn trust with the patient.",
    promise: "Freshness is enforced, not hoped for.",
  },
  {
    id: "story-003",
    category: "Clean match",
    title: "Diane Foster — fully eligible, ready for outreach",
    wowFactor:
      "All six TNBC criteria pass on fresh evidence; disposition goes straight to 'candidate for outreach' with zero edge cases.",
    patientId: "patient-003",
    trialId: "trial-003",
    matchId: "match-003",
    visibleBlocker: "None. Happy path.",
    nextAction: "Coordinator drafts the outreach brief and schedules the patient call.",
    managerMetric: "Time from new patient to outreach-ready reduced from days to hours.",
    promise: "When the answer is yes, the system just says yes.",
  },
  {
    id: "story-004",
    category: "Cross-trial fit",
    title: "Priya Venkataraman-Krishnamurthy — matched to two trials",
    wowFactor:
      "TrialComparisonStrip shows LU-021 as a low-confidence backup while EN-094 is the stronger fit on the same patient.",
    patientId: "patient-005",
    trialId: "trial-004",
    matchId: "match-005b",
    visibleBlocker: "LU-021 disease fit is marginal; EN-094 is a cleaner match.",
    nextAction: "Route Priya to EN-094 screening; keep LU-021 as a secondary option if EN-094 falls through.",
    managerMetric: "Never forces a coordinator to pick between trials blind.",
    promise: "Multi-trial thinking by default.",
  },
];

