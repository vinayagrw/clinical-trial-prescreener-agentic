import type { AssistantSession } from "../types";

export const assistantSessions: AssistantSession[] = [
  {
    id: "cockpit",
    promptGroup: "Queue and task prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "This queue",
      description:
        "Fast questions for thoracic queue triage, overnight changes, and outreach readiness."
    },
    defaultPromptId: "cockpit-prompt-001",
    prompts: [
      {
        id: "cockpit-prompt-001",
        label: "What changed overnight?",
        prompt: "What changed overnight in the thoracic queue?",
        mode: "quick_answer",
        scope: "this_queue"
      },
      {
        id: "cockpit-prompt-002",
        label: "Who is outreach-ready?",
        prompt: "Which cases are ready for outreach now?",
        mode: "quick_answer",
        scope: "this_queue"
      },
      {
        id: "cockpit-prompt-003",
        label: "Who needs PI review?",
        prompt: "Which cases need PI review before clinic?",
        mode: "case_reasoning",
        scope: "this_queue"
      }
    ],
    responses: [
      {
        id: "cockpit-response-001",
        promptId: "cockpit-prompt-001",
        userQuestion: "What changed overnight in the thoracic queue?",
        scope: "this_queue",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Queue-backed answer",
        summary:
          "Three patients moved in priority. Angela Brooks rose to the top after an outside cardiology import, Diane Foster moved into outreach-ready status after fresh labs, and one activation check remains unresolved for GI-118.",
        bullets: [
          "Angela Brooks: cardiac exclusion was anchored to a fresh outside discharge summary.",
          "Diane Foster: last lab-timing blocker cleared today.",
          "Robert Hale: still blocked by missing pathology and local activation verification."
        ],
        supportingTable: {
          title: "Overnight queue changes",
          columns: ["Case", "Change", "Operational impact"],
          rows: [
            [
              "Angela Brooks",
              "Outside NSTEMI import anchored criterion 003",
              "Moved to Needs PI Review"
            ],
            [
              "Diane Foster",
              "Fresh CBC cleared lab window",
              "Moved to Ready for Outreach"
            ],
            [
              "Robert Hale",
              "No change to outside pathology gap",
              "Still blocked"
            ]
          ]
        },
        citations: [
          {
            id: "citation-cockpit-001",
            label: "Continuous tracking alert",
            detail: "3 patients were rescreened after new chart evidence landed at 7:14 AM.",
            freshness: "fresh",
            tone: "supporting"
          },
          {
            id: "citation-cockpit-002",
            label: "Thoracic queue items",
            detail: "Queue ordering reflects fit score, urgency, and evidence freshness.",
            freshness: "fresh",
            tone: "context"
          }
        ],
        howDerived:
          "Compared the current queue list, alert stream, and saved next-step states in the thoracic pilot queue.",
        recommendedNextAction:
          "Open Angela Brooks for PI escalation, then draft outreach for Diane Foster.",
        followups: ["Who is outreach-ready?", "Which cases need PI review?"]
      },
      {
        id: "cockpit-response-002",
        promptId: "cockpit-prompt-002",
        userQuestion: "Which cases are ready for outreach now?",
        scope: "this_queue",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Disposition-backed answer",
        summary:
          "Diane Foster is the clearest outreach-ready case. Angela Brooks should remain internal-only until PI review resolves the CNS ambiguity.",
        supportingTable: {
          title: "Outreach readiness",
          columns: ["Patient", "Status", "Reason"],
          rows: [
            [
              "Diane Foster",
              "Ready for outreach",
              "No open blocker and fresh CBC available"
            ],
            [
              "Angela Brooks",
              "Hold",
              "Cardiac exclusion and CNS ambiguity still open"
            ]
          ]
        },
        citations: [
          {
            id: "citation-cockpit-003",
            label: "Queue disposition state",
            detail: "Match-003 is marked candidate_for_outreach in the queue.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Read coordinator disposition state, blocker count, and freshness summaries from the active queue.",
        recommendedNextAction:
          "Open the breast oncology case and generate the outreach brief draft."
      },
      {
        id: "cockpit-response-003",
        promptId: "cockpit-prompt-003",
        userQuestion: "Which cases need PI review before clinic?",
        scope: "this_queue",
        mode: "case_reasoning",
        groundingStatus: "grounded",
        trustBadge: "Case-backed answer",
        summary:
          "Angela Brooks is the highest-priority PI review case because clinic is within 72 hours and the CNS evidence remains contradictory.",
        bullets: [
          "Primary blocker: MRI wording conflict versus oncology note.",
          "Secondary blocker: NSTEMI is inside the 6-month lookback window.",
          "No other case has the same near-clinic urgency today."
        ],
        citations: [
          {
            id: "citation-cockpit-004",
            label: "Patient visit context",
            detail: "Consult in 72 hours with thoracic oncology.",
            freshness: "fresh",
            tone: "supporting"
          },
          {
            id: "citation-cockpit-005",
            label: "Open blocker state",
            detail: "Two unresolved questions remain on match-001.",
            freshness: "fresh",
            tone: "warning"
          }
        ],
        howDerived:
          "Compared visit timing, blocker count, and queue priority across all cases.",
        recommendedNextAction:
          "Open the review workbench and send the CNS conflict summary to the PI."
      }
    ]
  }
  ,
  {
    id: "review-match-001",
    promptGroup: "Case-scoped prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "This patient and trial",
      description:
        "Case-scoped reasoning attached to Angela Brooks and LU-021. Answers stay inside the selected review context.",
      patientId: "patient-001",
      trialId: "trial-001",
      matchId: "match-001"
    },
    defaultPromptId: "review-prompt-001",
    prompts: [
      {
        id: "review-prompt-001",
        label: "Why not outreach-ready?",
        prompt: "Why is this patient not outreach-ready?",
        mode: "case_reasoning",
        scope: "this_patient"
      },
      {
        id: "review-prompt-002",
        label: "What changed?",
        prompt: "What changed since the last review?",
        mode: "quick_answer",
        scope: "this_patient"
      },
      {
        id: "review-prompt-003",
        label: "Compare top trials",
        prompt: "Compare the top 2 trial options.",
        mode: "case_reasoning",
        scope: "this_trial"
      },
      {
        id: "review-prompt-004",
        label: "Summarize for PI",
        prompt: "Summarize blockers for PI review.",
        mode: "case_reasoning",
        scope: "this_patient"
      },
      {
        id: "review-prompt-005",
        label: "Draft outreach brief",
        prompt: "Draft outreach brief.",
        mode: "draft",
        scope: "this_patient"
      },
      {
        id: "review-prompt-007",
        label: "Draft PI handoff",
        prompt: "Draft PI handoff.",
        mode: "draft",
        scope: "this_patient"
      },
      {
        id: "review-prompt-006",
        label: "What supports exclusion?",
        prompt: "What evidence supports this exclusion?",
        mode: "case_reasoning",
        scope: "this_criterion"
      }
    ],
    responses: [
      {
        id: "review-response-001",
        promptId: "review-prompt-001",
        userQuestion: "Why is this patient not outreach-ready?",
        scope: "this_patient",
        mode: "case_reasoning",
        groundingStatus: "grounded",
        trustBadge: "Evidence-backed answer",
        summary:
          "Angela Brooks is not outreach-ready because one hard exclusion likely fails and one clinically meaningful contradiction still needs PI review.",
        bullets: [
          "Criterion 003 likely fails: NSTEMI occurred 153 days before screening, which is inside the 180-day exclusion window.",
          "Criterion 004 remains uncertain: MRI wording conflicts with the oncology note on active CNS disease.",
          "Manual-only investigator judgment is still open."
        ],
        citations: [
          {
            id: "citation-review-001",
            label: "Outside discharge summary",
            detail: "NSTEMI documented on Nov 5, 2025.",
            freshness: "fresh",
            tone: "warning"
          },
          {
            id: "citation-review-002",
            label: "Rules service date calculation",
            detail: "153 days elapsed between NSTEMI admission and planned screening date.",
            freshness: "fresh",
            tone: "supporting"
          },
          {
            id: "citation-review-003",
            label: "Brain MRI versus oncology note",
            detail: "Radiology and clinical documentation disagree on whether disease is active.",
            freshness: "aging",
            tone: "warning"
          }
        ],
        howDerived:
          "Reviewed criterion status, supporting evidence, and unresolved manual-only conditions for match-001.",
        recommendedNextAction:
          "Escalate the CNS conflict to the PI before moving the case toward patient-facing outreach.",
        followups: ["What changed since the last review?", "Summarize blockers for PI review."]
      },
      {
        id: "review-response-002",
        promptId: "review-prompt-002",
        userQuestion: "What changed since the last review?",
        scope: "this_patient",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Change digest",
        summary:
          "Three meaningful changes landed since the prior review: an outside cardiology import, a recalculated temporal exclusion, and a still-open MRI contradiction.",
        bullets: [
          "Outside cardiology discharge summary imported overnight.",
          "Criterion 003 moved from uncertain to fail after the screening-date lookback was recalculated.",
          "MRI conflict remains unresolved and is now the main PI question."
        ],
        supportingTable: {
          title: "Changed since last review",
          columns: ["Area", "Before", "Now"],
          rows: [
            ["Cardiac exclusion", "Outside record missing", "NSTEMI evidence imported"],
            ["Criterion 003", "Uncertain", "Fail"],
            ["CNS disease status", "Needs review", "Still unresolved"]
          ]
        },
        citations: [
          {
            id: "citation-review-004",
            label: "Audit trail",
            detail: "Rescreen job completed at 7:14 AM and reassessed criteria 003 and 004.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Compared the current criterion states and audit events with the prior saved review snapshot.",
        recommendedNextAction:
          "Use the PI summary to resolve the CNS contradiction before clinic prep."
      },
      {
        id: "review-response-003",
        promptId: "review-prompt-003",
        userQuestion: "Compare the top 2 trial options.",
        scope: "this_trial",
        mode: "case_reasoning",
        groundingStatus: "partial",
        trustBadge: "Comparison with local trial context",
        summary:
          "LU-021 remains the strongest scientific fit, but it is operationally blocked. LU-018 is weaker today because it is locally inactive and outside the pilot release scope.",
        supportingTable: {
          title: "Trial comparison",
          columns: ["Trial", "Fit", "Operational blocker", "Outreach readiness"],
          rows: [
            [
              "LU-021",
              "Best genomic and line-of-therapy fit",
              "Cardiac exclusion and CNS ambiguity",
              "Not ready"
            ],
            [
              "LU-018",
              "Watchlist only",
              "Locally inactive",
              "Not actionable"
            ]
          ]
        },
        citations: [
          {
            id: "citation-review-005",
            label: "Trial release state",
            detail: "LU-021 is released to the pilot queue. LU-018 is watchlist-only in this mock context.",
            freshness: "fresh",
            tone: "context"
          }
        ],
        howDerived:
          "Compared trial fit notes, local activation state, and current queue release rules.",
        recommendedNextAction:
          "Keep LU-021 as the active review target and defer LU-018 to watchlist tracking.",
        scopeMismatchWarning:
          "This comparison uses the two trial options configured for the current review context, not the full enterprise trial portfolio."
      },
      {
        id: "review-response-004",
        promptId: "review-prompt-004",
        userQuestion: "Summarize blockers for PI review.",
        scope: "this_patient",
        mode: "case_reasoning",
        groundingStatus: "grounded",
        trustBadge: "PI-ready summary",
        summary:
          "The PI needs to resolve one interpretation question and one policy question before the coordinator should proceed.",
        bullets: [
          "Interpretation question: Does the Mar 30 MRI represent active CNS disease requiring therapy?",
          "Policy question: Should the Nov 5 NSTEMI exclude the patient under the protocol's 6-month window as currently written?",
          "Manual-only judgment remains open but is not the immediate blocker."
        ],
        citations: [
          {
            id: "citation-review-006",
            label: "MRI impression",
            detail: "Radiology calls the new lesion indeterminate and cannot exclude metastasis.",
            freshness: "aging",
            tone: "warning"
          },
          {
            id: "citation-review-007",
            label: "Temporal exclusion trace",
            detail: "Rules service anchored the NSTEMI to the planned screening date.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Summarized the two open blocker categories from criterion 003 and criterion 004.",
        recommendedNextAction:
          "Use this summary in the PI handoff or tumor board prep.",
        followups: ["Draft PI handoff", "What evidence supports this exclusion?"]
      },
      {
        id: "review-response-005",
        promptId: "review-prompt-005",
        userQuestion: "Draft outreach brief.",
        scope: "this_patient",
        mode: "draft",
        groundingStatus: "partial",
        trustBadge: "Human-reviewed draft",
        summary:
          "Drafted an internal outreach brief that is ready for coordinator review but should not be sent externally until PI review is complete.",
        citations: [
          {
            id: "citation-review-008",
            label: "Patient interest note",
            detail: "Coordinator note says the patient remains interested in trial options.",
            freshness: "fresh",
            tone: "supporting"
          },
          {
            id: "citation-review-009",
            label: "Open blocker state",
            detail: "Cardiac exclusion and CNS ambiguity are still unresolved.",
            freshness: "fresh",
            tone: "warning"
          }
        ],
        howDerived:
          "Used the current patient summary, trial fit rationale, blocker list, and coordinator note to generate an internal-facing draft.",
        recommendedNextAction:
          "Review the brief, preserve the blocker language, and attach it to the case rather than sending it externally.",
        draftType: "outreach_brief",
        draftReviewState: "ready_for_review",
        draftSections: [
          {
            label: "Patient snapshot",
            content:
              "Angela Brooks is a 58-year-old thoracic oncology patient with metastatic NSCLC and confirmed EGFR exon20 insertion. Consult is scheduled in 72 hours."
          },
          {
            label: "Why this trial is a fit",
            content:
              "LU-021 remains the top fit because genomic eligibility is confirmed and progression after platinum therapy is documented."
          },
          {
            label: "Unresolved risks or unknowns",
            content:
              "Do not treat this as outreach-ready. A recent NSTEMI appears to fall within the protocol exclusion window, and the latest MRI still requires PI interpretation."
          },
          {
            label: "Coordinator talking points",
            content:
              "Prepare to discuss the case internally with the PI first. If the PI clears the CNS ambiguity and confirms the cardiac interpretation, convert this brief into patient-facing outreach prep."
          },
          {
            label: "Evidence references",
            content:
              "Pathology Jan 14, 2026; Tempus report Jan 20, 2026; Thoracic oncology note Mar 28, 2026; discharge summary Nov 5, 2025; MRI Mar 30, 2026."
          },
          {
            label: "Human-review disclaimer",
            content:
              "Internal draft only. Do not send externally without coordinator review and documented PI confirmation."
          }
        ],
        actions: [
          { id: "copy-draft", label: "Copy draft", tone: "secondary" },
          { id: "save-note", label: "Save as internal note", tone: "secondary" },
          {
            id: "attach-to-workflow",
            label: "Attach to coordinator state",
            tone: "primary"
          }
        ]
      },
      {
        id: "review-response-007",
        promptId: "review-prompt-007",
        userQuestion: "Draft PI handoff.",
        scope: "this_patient",
        mode: "draft",
        groundingStatus: "grounded",
        trustBadge: "Context-preserved draft",
        summary:
          "Drafted a PI handoff packet that preserves the patient, trial, blocker, and evidence context in one place for internal review.",
        citations: [
          {
            id: "citation-review-012",
            label: "Criterion 003 temporal trace",
            detail: "NSTEMI event falls inside the 180-day lookback window.",
            freshness: "fresh",
            tone: "warning"
          },
          {
            id: "citation-review-013",
            label: "Criterion 004 contradiction bundle",
            detail: "MRI impression and oncology note still disagree on active CNS disease.",
            freshness: "aging",
            tone: "warning"
          }
        ],
        howDerived:
          "Used the current review package, PI blocker summary, and linked evidence references to create an internal-only escalation draft.",
        recommendedNextAction:
          "Attach the draft to the coordinator workflow state and use it in the PI huddle or tumor board prep.",
        draftType: "pi_handoff",
        draftReviewState: "attached_to_case",
        draftSections: [
          {
            label: "Case snapshot",
            content:
              "Angela Brooks is a thoracic oncology patient with metastatic NSCLC and confirmed EGFR exon20 insertion. LU-021 remains the top released trial in scope."
          },
          {
            label: "Decision needed",
            content:
              "Please resolve whether the Mar 30 MRI represents active CNS disease requiring therapy and whether the Nov 5 NSTEMI should exclude the patient under protocol v4.2."
          },
          {
            label: "Blocker summary",
            content:
              "Criterion 003 is a likely fail based on deterministic date math. Criterion 004 remains uncertain because radiology and the oncology note disagree."
          },
          {
            label: "Evidence anchors",
            content:
              "Discharge summary Nov 5, 2025; cardiology follow-up Jan 12, 2026; MRI brain Mar 30, 2026; thoracic oncology note Apr 1, 2026."
          },
          {
            label: "Recommended disposition if unresolved",
            content:
              "Keep the case in needs_pi_review and do not move to candidate_for_outreach until the contradiction is adjudicated."
          }
        ],
        actions: [
          { id: "copy-draft", label: "Copy draft", tone: "secondary" },
          { id: "save-note", label: "Save as internal note", tone: "secondary" },
          {
            id: "attach-to-workflow",
            label: "Attach to coordinator state",
            tone: "primary"
          }
        ]
      },
      {
        id: "review-response-006",
        promptId: "review-prompt-006",
        userQuestion: "What evidence supports this exclusion?",
        scope: "this_criterion",
        mode: "case_reasoning",
        groundingStatus: "grounded",
        trustBadge: "Criterion-backed answer",
        summary:
          "The exclusion is supported by two linked pieces of evidence: a concrete outside event and a deterministic interval calculation.",
        bullets: [
          "Source event: NSTEMI documented in an outside discharge summary on Nov 5, 2025.",
          "Interval result: 153 days elapsed before the planned screening date, which is inside the 180-day exclusion window."
        ],
        citations: [
          {
            id: "citation-review-010",
            label: "Outside discharge summary",
            detail: "Hospitalized with NSTEMI after chest pain episode.",
            freshness: "fresh",
            tone: "warning"
          },
          {
            id: "citation-review-011",
            label: "Rules service calculation",
            detail: "153 days elapsed between event and screening date.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Bound the answer to criterion 003 and only used evidence attached to that criterion.",
        recommendedNextAction:
          "Keep the case in review until the PI decides whether protocol interpretation allows any exception."
      }
    ]
  }
  ,
  {
    id: "command-center",
    promptGroup: "Ops and portfolio prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "Workspace",
      description:
        "Operational summaries for queue friction, outreach conversion, and throughput."
    },
    defaultPromptId: "command-prompt-001",
    prompts: [
      {
        id: "command-prompt-001",
        label: "Where are we losing time?",
        prompt: "Where are we losing time in the pilot workflow?",
        mode: "workspace_research",
        scope: "workspace"
      },
      {
        id: "command-prompt-002",
        label: "What can we clear today?",
        prompt: "What can we clear today to improve throughput?",
        mode: "workspace_research",
        scope: "workspace"
      }
    ],
    responses: [
      {
        id: "command-response-001",
        promptId: "command-prompt-001",
        userQuestion: "Where are we losing time in the pilot workflow?",
        scope: "workspace",
        mode: "workspace_research",
        groundingStatus: "grounded",
        trustBadge: "Ops-backed answer",
        summary:
          "The biggest throughput drag comes from ambiguity-heavy criteria, especially CNS disease interpretation and late outside records.",
        supportingTable: {
          title: "Friction sources",
          columns: ["Family", "Signal", "Operational impact"],
          rows: [
            [
              "CNS disease status",
              "18% uncertain, 11% override",
              "PI escalation delays same-day decisions"
            ],
            [
              "Cardiac exclusions",
              "Outside records arrive late",
              "Cases pause until external documents land"
            ],
            [
              "Manual-only judgment",
              "Expected 100% human review",
              "Should stay visible but not clog triage views"
            ]
          ]
        },
        citations: [
          {
            id: "citation-command-001",
            label: "Uncertainty heatmap",
            detail: "CNS disease status is the highest uncertainty hotspot in the pilot set.",
            freshness: "fresh",
            tone: "supporting"
          },
          {
            id: "citation-command-002",
            label: "Queue watchlist",
            detail: "Outside-record delays account for the largest share of blocked cases.",
            freshness: "fresh",
            tone: "warning"
          }
        ],
        howDerived:
          "Combined the hotspot table, queue aging list, and current disposition states across the pilot screens.",
        recommendedNextAction:
          "Create a saved task mode for Needs PI Review and another for Missing Outside Records."
      },
      {
        id: "command-response-002",
        promptId: "command-prompt-002",
        userQuestion: "What can we clear today to improve throughput?",
        scope: "workspace",
        mode: "workspace_research",
        groundingStatus: "grounded",
        trustBadge: "Actionable ops answer",
        summary:
          "Two immediate clears would improve throughput today: resolve Angela Brooks' PI question and complete outreach on Diane Foster.",
        bullets: [
          "Clearing the thoracic PI review will unblock the highest-priority case before clinic.",
          "Completing the outreach brief on Diane Foster converts an already-ready case into action.",
          "Activation checks should stay visible, but they are lower-impact than today's clinic-bound cases."
        ],
        citations: [
          {
            id: "citation-command-003",
            label: "Thoracic queue priority",
            detail: "Angela Brooks remains the top critical case.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Ranked active queue items by urgency, blocker type, and current disposition.",
        recommendedNextAction:
          "Use the task-mode views to split work between PI escalation and outreach completion."
      }
    ]
  },
  {
    id: "trial-admin",
    promptGroup: "Protocol prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "This trial",
      description:
        "Explain normalization decisions, computability labels, and recent protocol changes."
    },
    defaultPromptId: "admin-prompt-001",
    prompts: [
      {
        id: "admin-prompt-001",
        label: "Why manual-only?",
        prompt: "Why is this criterion marked manual-only?",
        mode: "case_reasoning",
        scope: "this_trial"
      },
      {
        id: "admin-prompt-002",
        label: "What changed in v4.2?",
        prompt: "What changed in protocol v4.2?",
        mode: "quick_answer",
        scope: "this_trial"
      }
    ],
    responses: [
      {
        id: "admin-response-001",
        promptId: "admin-prompt-001",
        userQuestion: "Why is this criterion marked manual-only?",
        scope: "this_trial",
        mode: "case_reasoning",
        groundingStatus: "grounded",
        trustBadge: "Normalization-backed answer",
        summary:
          "The investigator-judgment criterion remains manual-only because it represents clinical appropriateness rather than a fixed threshold or reproducible chart pattern.",
        bullets: [
          "There is no protocol-defined deterministic threshold to score.",
          "Auto-finalizing this field would violate the pilot guardrail for human review.",
          "The UI should keep the criterion visible without pretending it is machine-resolved."
        ],
        citations: [
          {
            id: "citation-admin-001",
            label: "Normalized criterion metadata",
            detail: "Criterion owner is the PI reviewer and threshold is PI judgment only.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Read the normalized criterion object and the pilot release controls for LU-021.",
        recommendedNextAction:
          "Keep manual-only criteria visible in the matrix and exclude them from automated pass/fail summaries."
      },
      {
        id: "admin-response-002",
        promptId: "admin-prompt-002",
        userQuestion: "What changed in protocol v4.2?",
        scope: "this_trial",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Version-backed answer",
        summary:
          "Protocol v4.2 tightened two operationally important areas: CNS exclusion wording and lab recency.",
        bullets: [
          "CNS exclusion language was clarified, which is why review still calls out contradiction handling.",
          "Lab screening window narrowed to 14 days, increasing freshness sensitivity in the UI."
        ],
        citations: [
          {
            id: "citation-admin-002",
            label: "Protocol history",
            detail: "Version timeline shows CNS clarification and 14-day lab window in v4.2.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Summarized the current version note against the superseded release history.",
        recommendedNextAction:
          "Review which saved prompts and reviewer guidance should be refreshed for v4.2."
      }
    ]
  }
  ,
  {
    id: "audit-match-001",
    promptGroup: "Trace prompts",
    context: {
      title: "Ask Agent",
      scopeLabel: "This trace",
      description:
        "Explain how one case was derived without creating new workflow drafts."
    },
    defaultPromptId: "audit-prompt-001",
    prompts: [
      {
        id: "audit-prompt-001",
        label: "How was this derived?",
        prompt: "How was this exclusion derived?",
        mode: "case_reasoning",
        scope: "this_criterion"
      },
      {
        id: "audit-prompt-002",
        label: "What evidence was used?",
        prompt: "What evidence was used in this review?",
        mode: "quick_answer",
        scope: "this_patient"
      }
    ],
    responses: [
      {
        id: "audit-response-001",
        promptId: "audit-prompt-001",
        userQuestion: "How was this exclusion derived?",
        scope: "this_criterion",
        mode: "case_reasoning",
        groundingStatus: "grounded",
        trustBadge: "Trace-backed explanation",
        summary:
          "Criterion 003 was derived from one outside record plus a deterministic interval calculation. The trace shows the engine reassessed the criterion after the outside document landed.",
        bullets: [
          "7:14 AM: screening job completed after outside cardiology import.",
          "7:15 AM: criterion engine marked criterion 003 as fail.",
          "The rule version and model version are pinned to this event sequence."
        ],
        citations: [
          {
            id: "citation-audit-001",
            label: "Audit event chain",
            detail: "Audit trail records screening.job_completed followed by criterion.assessed.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Reconstructed the event order from the audit trail and linked it to cited evidence.",
        recommendedNextAction:
          "Keep audit mode explanation-only and use review mode for any draft or operational action."
      },
      {
        id: "audit-response-002",
        promptId: "audit-prompt-002",
        userQuestion: "What evidence was used in this review?",
        scope: "this_patient",
        mode: "quick_answer",
        groundingStatus: "grounded",
        trustBadge: "Evidence inventory",
        summary:
          "This review used 10 cited records spanning pathology, genomics, oncology notes, labs, radiology, outside records, and the coordination note.",
        supportingTable: {
          title: "Evidence mix",
          columns: ["Domain", "Count", "Example"],
          rows: [
            ["Pathology and genomics", "2", "Final pathology, Tempus xT"],
            ["Oncology and radiology", "4", "Thoracic note, Brain MRI"],
            ["Labs and rules trace", "2", "CBC, Screening window calculation"],
            ["Outside records and coordination", "2", "Discharge summary, coordinator note"]
          ]
        },
        citations: [
          {
            id: "citation-audit-002",
            label: "Evidence provenance stack",
            detail: "Evidence bundle includes 10 cited records in the audit view.",
            freshness: "fresh",
            tone: "supporting"
          }
        ],
        howDerived:
          "Counted the evidence snippets attached to the case and grouped them by domain.",
        recommendedNextAction:
          "Open the review workbench if the reviewer needs to contest or override one of these inputs."
      }
    ]
  }
];

export function getAssistantSession(sessionId: string) {
  return assistantSessions.find((session) => session.id === sessionId);
}
