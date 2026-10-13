<div align="center">

# Sample UI — Coordinator Workbench

**The feature-dense treatment: 14 routes, four workspaces, one oncology screening queue.**

[![Part of](https://img.shields.io/badge/part%20of-clinical--trial--prescreener-blue)](../README.md)
[![Routes](https://img.shields.io/badge/routes-14-4a6fa5)](#-routes-and-what-each-screen-does)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933?logo=node.js&logoColor=white)](#-run)
[![Charts](https://img.shields.io/badge/charts-visx-FF6B6B)](#-feature-list)
[![Data: synthetic](https://img.shields.io/badge/data-100%25%20synthetic-8A4FFF)](#-what-is-real-in-the-prototype-vs-what-is-mocked)

[🚀 Run](#-run) · [🗺 Routes](#-routes-and-what-each-screen-does) · [✨ Features](#-feature-list) · [👥 Personas](#-user-stories-by-persona) · [🔍 Real vs mock](#-what-is-real-in-the-prototype-vs-what-is-mocked)

</div>

---

The React + Vite + TypeScript prototype of the CTP Clinical Trial Eligibility Pre-Screener —
a coordinator-first oncology screening workbench, an SBAR clinical handoff studio, and a
literature-monitoring digest workspace in one app.

This is the **first** of the two interface treatments in this repository. For the 5-page
redesign and the comparison between them, see the [root README](../README.md).

> [!NOTE]
> **Honest status, up front.** The trial workspace and most of `/ai-features` are mock-data
> workflows. Handoff is a working seeded-data pipeline, not a live EHR deployment. Research
> digests are the closest to real data, but still need infrastructure and production
> hardening. The full breakdown is in
> [What Is Real vs What Is Mocked](#-what-is-real-in-the-prototype-vs-what-is-mocked).

## 🎯 Purpose and Current Scope
- Demonstrate three read-only clinical or research workspaces in one app: a coordinator-first oncology screening workbench, a clinical handoff studio for SBAR shift summaries, and a literature-monitoring digest workspace for faculty or labs.
- Show how queue management, criterion review, trust signals, analytics, admin controls, and audit replay fit into one workflow.
- Keep the original trial eligibility pre-screener as the default home page while exposing the SBAR handoff workspace under `/handoffs`.
- Expose the research digest workspace under `/research-digests` without disturbing the trial or handoff routes.
- Show how dense prescreening information can be turned into interactive visuals instead of long text-only panels.
- Represent the current product direction for one Clinical Trial Pre-Screener oncology queue, 10 to 20 active trials, read-only workflow, and mandatory human review.
- Use mock data and a mock API layer for the trial workspace, a local backend with seeded retrospective encounters for the handoff workspace, and a Postgres-backed live ingestion pipeline for the research digest workspace.

## 🚧 Current Scope Guardrails
- One oncology-first pilot queue.
- One inpatient handoff pilot workspace backed by retrospective seeded encounter data.
- One research digest pilot workspace backed by real external publication APIs plus Postgres + pgvector.
- Read-only workflow with no Epic write-back.
- No autonomous eligibility determination.
- Human-reviewed output only.
- Ask Agent is limited to grounded explanation and internal drafting.

## 🗺 Routes and What Each Screen Does
| Route | Screen | What it demonstrates |
| --- | --- | --- |
| `/` | Default Landing | Redirects to the coordinator cockpit so the original trial workspace remains the default home page. |
| `/cockpit` | Coordinator Operations Cockpit | Task-mode queue views, a dominant priority matrix, compact queue companion, selected-case lens, and curated story rail. |
| `/review/match-001` | Patient Evidence Workbench | Interactive eligibility atlas, evidence weave, washout timeline, resolution board, PI handoff, and reviewer disposition actions. |
| `/command-center` | Trial Command Center | Connected funnel analytics, hotspot quadrant, trial portfolio strip, rollout readiness ladder, and queue pressure by task mode. |
| `/admin/trials/trial-001` | Trial Admin | Computability grid, protocol timeline, filtered criteria inspector, release gates, and source-to-service blueprint. |
| `/audit/match-001` | Audit View | Decision trace rail, provenance river, replay coverage composition, and version-pinned evidence replay. |
| `/ai-features` | AI Features | Interactive walkthrough of the trial-screening AI pipeline, safety stack, and grounded Ask Agent behavior. |
| `/safety` | Patient Safety | Safety-event dashboard for the trial-screening AI pipeline and guardrail fixtures. |
| `/handoffs` | Handoff Worklist | Live SBAR worklist backed by the local handoff backend and seeded retrospective encounter data. |
| `/handoffs/:handoffId` | Handoff Case Summary | Generated SBAR summary with disagreements, recommendations, and sentence-level provenance. |
| `/handoffs/:handoffId/audit` | Handoff Audit Trail | End-to-end handoff audit with source traceability and generation history. |
| `/research-digests` | Research Digest Archive | Live-data literature monitoring workspace with profile creation, archive review, and manual ingest / scoring controls. |
| `/research-digests/profiles/:profileId` | Research Profile | Faculty or lab configuration for interests, projects, schedule, and source filters. |
| `/research-digests/digests/:digestId` | Weekly Research Digest | Weekly digest review with method-aware scores, project flags, source quality badges, and citation-backed summaries. |

## ✨ Feature List

### Cockpit
- Queue-first landing experience built around task modes rather than static pages.
- Task modes for `Today`, `Clinic Prep`, `Needs PI Review`, `Ready for Outreach`, `Watchlist / Re-screen`, and `Ops Insights`.
- Deferred search across patient, diagnosis, biomarker, and trial context.
- "Why now" action ribbon showing changes overnight, best same-day action, and current workflow promise.
- `Priority Matrix` with x-axis readiness, y-axis urgency, point size by trial count, and halo for changed-overnight cases.
- `Queue Companion List` synced to the matrix for exact-detail review.
- `Case Lens` with fit ring, blocker stack, next action, and manager metric.
- `Story Rail` for easy match, false-positive trap, missing-data hold, contradiction case, temporal exclusion, manual-only governance, and ROI story.

### Review Workbench
- Patient summary header with fit score, owner, tracking, manager metric, blockers, missing domains, and contradiction focus.
- Ranked trial option stack to keep the primary trial in context.
- `Eligibility Atlas` grouping inclusion fit, exclusion pressure, and manual-review boundaries.
- `Evidence Weave` separating supporting, contradicting, and context evidence with source/date visibility.
- `Washout Timeline` visualizing rule windows against patient events and the active review anchor.
- `Resolution Board` combining contradictions and missing domains into a two-lane action surface.
- PI escalation packet with preserved context, decision questions, and recommended artifacts.
- Override and disposition actions for reviewer-controlled workflow decisions.
- Temporal reasoning lane and audit panel for traceable review.

### Command Center
- `Conversion Funnel Flow` from screened to enrolled.
- Review-time, PI-review load, false-exclusion, and capacity metrics.
- `Hotspot Quadrant` for uncertainty and override friction by criterion family.
- `Trial Portfolio Strip` for screened cases, PI escalations, outreach-ready cases, and enrollments.
- Override clustering for repeated reviewer friction signals.
- `Readiness Ladder` for shadow-mode and pilot guardrails.
- `Load Ribbon` connecting operator experience to portfolio load.

### Trial Admin
- Trial scope and release-state visibility.
- Activation-state and screening-window summary.
- `Computability Grid` crossing criterion type and computability class.
- `Criteria Inspector` filtered from the selected computability cell.
- `Protocol Timeline` for release history and amendments.
- `Release Gate Strip` for pilot governance controls.
- `Source-to-Service Blueprint` for API surface, domain entities, and source feeds.

### Audit View
- Trace summary with recommendation state, disposition, evidence bundle, missing domains, and contradiction summary.
- `Decision Trace Rail` with actor, rule version, prompt version, and model version.
- `Provenance River` for cited records grouped by source system.
- `Coverage Composition` showing fresh evidence, aging or missing evidence, and contradictions.
- Secondary drill-down list for evidence excerpts tied to the selected trace node.

### Global Ask Agent
- Fixed bottom-right launcher available across all routes.
- `minimized`, `drawer`, and `expanded` states.
- Explicit context switching across queue, case, trial, workspace, and trace scopes.
- Breadcrumb-style active context indicator and compact scope switcher.
- Tabs for `Answer`, `Evidence`, `Table`, `Draft`, and `Trace`.
- Contextual prompts for overnight changes, outreach readiness, PI review, trial comparisons, and trace explanations.
- Internal-only drafts for outreach brief and PI handoff.
- Cross-highlighting of page visuals from `Evidence`, `Draft`, and `Trace` tabs.
- No external send actions and no autonomous workflow changes.
- Research digest routes currently map to a workspace-level assistant context so the launcher stays available while the new workspace remains backend-first.

### Research Digest Workspace
- Faculty, lab, or department research profiles with keywords, excluded terms, method interests, domain interests, digest schedule, timezone, and source filters.
- Institutional project definitions that let the scorer flag direct project matches instead of only broad topic overlap.
- Real ingestion adapters for PubMed, bioRxiv, and medRxiv with Postgres + pgvector persistence.
- Deterministic-first relevance scoring weighted toward method similarity, project alignment, topic overlap, source quality, and recency.
- Cross-domain method matching so shared methodological patterns can surface even when topic domains differ.
- Weekly digest generation with sections for direct project matches, method matches across domains, top general relevance, and watchlist / low-confidence.
- Citation-backed paper summaries with explicit abstract-only vs full-text coverage labels.
- Separate research worker process so publication polling and digest generation do not destabilize the handoff API.

## 👥 User Stories by Persona

### Coordinator
- As a coordinator, I want the queue to show the next best cases by task mode so I can start with the highest-value work.
- As a coordinator, I want to see why a patient is in front of me right now so I can avoid chart hunting.
- As a coordinator, I want criterion-by-criterion evidence with dates and sources so I can trust the recommendation.
- As a coordinator, I want missing-data and contradiction signals to be explicit so I do not mistake uncertainty for ineligibility.
- As a coordinator, I want an internal outreach brief draft so I can move ready cases faster without leaving the workflow.

### PI / Research Nurse Reviewer
- As a PI or nurse reviewer, I want a preserved-context handoff packet so I can resolve ambiguity without reconstructing the case myself.
- As a PI or nurse reviewer, I want contradiction summaries tied to linked evidence so I can make a quick adjudication.
- As a PI or nurse reviewer, I want manual-only criteria to remain visible and clearly non-automated so clinical judgment stays in the right hands.

### Research Operations Lead
- As a research ops lead, I want funnel, throughput, and queue-pressure metrics so I can tell whether the pilot is improving operations.
- As a research ops lead, I want hotspot and override clustering views so I can see which criterion families are creating drag.
- As a research ops lead, I want trial-level performance and rollout guardrails in one place so I can decide whether to scale, adjust, or stop.

### Informatics / Compliance
- As an informatics or compliance reviewer, I want audit replay with source provenance, prompt version, rule version, and model version so I can verify how a result was produced.
- As an informatics or compliance reviewer, I want missing-domain visibility so the system never hides data gaps behind confident language.
- As an informatics or compliance reviewer, I want release-state and activation controls to be visible so operational guardrails are enforced.

### Executive Sponsor
- As an executive sponsor, I want to see how one case review connects to throughput, false exclusions, and enrollment funnel movement so I can judge business value.
- As an executive sponsor, I want the product to show clear guardrails around human review, read-only posture, and governance so the pilot remains defensible.

## 🧩 Core Entities
| Entity | Purpose |
| --- | --- |
| `Trial` | Current local trial record, activation state, and release scope. |
| `TrialVersion` | Versioned protocol history with amendment notes and release status. |
| `TrialCriterion` | Atomic normalized criterion with computability and threshold metadata. |
| `PatientEvidenceBundle` | Unified chart evidence with freshness and missing-domain visibility. |
| `CriterionAssessment` | Pass, fail, uncertain, or manual-review result for one criterion. |
| `TrialMatchRecommendation` | Patient-trial package with blockers, next action, and queue state. |
| `ReviewAction` | Immutable human action trail for overrides, finalization, and outcomes. |
| `AuditEvent` | Rule, prompt, model, and actor trace for replay and governance. |
| `ResearchProfile` | Faculty or lab interest configuration for literature monitoring. |
| `InstitutionalProject` | Ongoing institutional effort used for direct project match flags. |
| `PublicationRecord` | Normalized paper metadata from PubMed, bioRxiv, or medRxiv. |
| `RelevanceAssessment` | Weighted, method-aware score linking one publication to one research profile. |
| `WeeklyDigest` | Persisted digest archive with section structure and paper entries. |

## 🔌 Target API Endpoints
| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/trials/import` | Import or refresh trial inventory for the pilot scope. |
| `POST` | `/trials/{trialId}/parse-criteria` | Normalize protocol criteria for one trial. |
| `POST` | `/patients/{patientId}/screen` | Screen one patient against the pilot trial set. |
| `POST` | `/patients/{patientId}/screen/{trialId}` | Screen one patient against one trial. |
| `GET` | `/patients/{patientId}/matches` | List trial matches for one patient. |
| `GET` | `/matches/{matchId}` | Return one patient-trial review package. |
| `POST` | `/assessments/{assessmentId}/override` | Override one criterion result. |
| `POST` | `/matches/{matchId}/finalize` | Finalize the reviewed recommendation. |
| `POST` | `/matches/{matchId}/outcome` | Record downstream enrollment funnel outcome. |
| `GET` | `/metrics/screening` | Return screening productivity and quality metrics. |
| `GET` | `/metrics/enrollment-funnel` | Return screened-to-enrolled funnel metrics. |
| `GET` | `/metrics/trial/{trialId}` | Return trial-level quality and funnel metrics. |
| `GET` | `/api/research/profiles` | List research profiles with project and digest counts. |
| `POST` | `/api/research/profiles` | Create a new faculty, lab, or department monitoring profile. |
| `GET` | `/api/research/profiles/{profileId}` | Return one research profile with projects and recent digests. |
| `PATCH` | `/api/research/profiles/{profileId}` | Update profile interests, sources, or schedule. |
| `POST` | `/api/research/profiles/{profileId}/projects` | Add an institutional project used for direct project-match scoring. |
| `POST` | `/api/research/ingest/run` | Run live publication ingestion across configured sources. |
| `POST` | `/api/research/relevance/recompute` | Recompute deterministic relevance scores. |
| `POST` | `/api/research/digests/generate` | Generate weekly research digests on demand. |
| `GET` | `/api/research/profiles/{profileId}/digests` | List archived digests for one research profile. |
| `GET` | `/api/research/digests/{digestId}` | Return one digest with entries, assessments, and summaries. |
| `GET` | `/api/research/publications/{publicationId}` | Return one stored publication with chunks and assessments. |

## 🔍 What Is Real in the Prototype vs What Is Mocked

### Real in the prototype
- Multi-route React application with working navigation.
- Working UI behavior for cockpit, review, command-center, admin, audit, Ask Agent, and handoff surfaces.
- Working research digest archive, profile configuration, and digest review routes.
- Typed domain model for trials, criteria, matches, evidence bundles, review actions, and audit events.
- Mock API layer aligned to the planned product API surface.
- Shared visual adapter layer that derives chart and interaction models from the mock data.
- Curated task modes, demo stories, contradictions, missing-domain states, PI handoff packet, and manager metrics.
- Local handoff backend with live HTTP endpoints for SBAR generation, worklist loading, audit retrieval, and document reindexing against seeded retrospective data.
- Research backend with real PubMed, bioRxiv, and medRxiv ingestion code, Postgres + pgvector schema, weighted relevance scoring, and persisted weekly digests.

### Mocked or simulated
- All clinical data, patient charts, protocol content, and outcomes.
- CTMS, Epic, genomics, outside-record, and identity integrations.
- Actual screening jobs, protocol parsing, temporal calculation services, retrieval pipelines, and rule engines.
- Persisted reviewer actions, queue ownership, and audit storage.
- Production security, deployment, observability, and approval workflows.
- Production EHR feeds for the handoff workspace; the current handoff API uses retrospective seeded encounters rather than live clinical integrations.
- Production-grade email or Slack delivery for research digests; v1 is in-app archive only.
- A live Postgres instance; the research workspace requires `RESEARCH_DATABASE_URL` and does not fall back to mocked publication data.

## 🛣 What Is Required To Make This a Real Working Solution

Ten workstreams stand between this prototype and a clinical pilot.

<details>
<summary><b>Expand the full productionisation checklist</b> — data integrations, backend services, clinical reasoning, workflow, governance, security, evaluation, operations</summary>

### Data integrations
- Connect to CTMS or equivalent trial inventory source for active trial metadata and local site status.
- Connect to Epic structured data for diagnoses, staging, labs, medications, therapies, appointments, and identity joins.
- Connect to notes, pathology, and radiology feeds for evidence retrieval and source provenance.
- Connect to genomics and biomarker feeds for molecular eligibility logic.
- Establish an explicit outside-record ingestion path so missing external evidence is visible and actionable.

### Backend services
- Implement real services for trial import, criteria parsing, patient screening, review package retrieval, overrides, finalization, outcomes, and metrics.
- Replace the mock API layer with authenticated backend APIs following the current endpoint surface.
- Persist screening jobs, review actions, match summaries, audit events, and funnel outcomes.

### Clinical reasoning
- Build deterministic logic for thresholds, date windows, washouts, local activation checks, and manual-only rules.
- Implement protocol decomposition and computability tagging.
- Add contradiction handling across structured and unstructured evidence.
- Add uncertainty rules that bias to `uncertain` instead of silent exclusion.

### Workflow
- Connect to real reviewer identities, roles, and queue ownership.
- Persist dispositions, overrides, handoffs, and watchlist state.
- Implement PI escalation and rescreening triggers from new clinical evidence.
- Add team-level queue operations instead of single-user prototype state.

### Trust and governance
- Store audit log, prompt version, model version, rule version, and source provenance for every AI-assisted output.
- Preserve manual-only criteria as governed human-review steps.
- Ensure release-state and activation controls can block operationally unsafe recommendations.

### Security and compliance
- Add RBAC tied to approved CTP identity systems.
- Keep PHI inside approved environments and access boundaries.
- Maintain the v1 read-only posture with no Epic write-back.
- Align the pilot with privacy, compliance, and clinical governance review.

### Evaluation
- Build a gold set of retrospective patient-trial cases for offline testing.
- Measure criterion accuracy, evidence faithfulness, false exclusions, and uncertainty by criterion family.
- Define shadow-mode thresholds before allowing broader rollout.

### Operations
- Deploy into an approved runtime with observability, support ownership, alerting, rollback, and release gates.
- Add runbooks for shadow mode, pilot support, incident handling, and scale decisions.

</details>

## 📈 Recommended Path From Mock To Pilot
1. Harden the frontend prototype into a delivery-oriented workbench without changing the core workflow posture.
2. Replace the mock API layer with real backend services that preserve the current contracts.
3. Lock data contracts and source mappings for CTMS, Epic, notes, genomics, and outside records.
4. Stand up deterministic rules, protocol normalization, auditability, and evaluation harnesses.
5. Run shadow-mode validation with named coordinators, PI reviewers, and readiness gates.
6. Launch a controlled oncology pilot only after safety, workflow, and ROI thresholds are met.

## 🚀 Run

Requires **Node.js 22 or newer** — the local API is started with
`node --experimental-strip-types`, which needs 22.

```bash
npm install
npm run dev
```

`npm run dev` starts both processes: the Vite client on `127.0.0.1:4174` and the
local API on `127.0.0.1:4180`. Then open:

- `http://127.0.0.1:4174/cockpit` — trial workspace
- `http://127.0.0.1:4174/handoffs` — SBAR handoff workspace
- `http://127.0.0.1:4174/research-digests` — literature-monitoring workspace

> [!IMPORTANT]
> The trial and handoff workspaces need **no keys and no external services**. The
> research-digest workspace is the one exception: it requires Postgres with pgvector via
> `RESEARCH_DATABASE_URL` and does **not** fall back to mock publication data. Without a
> database, use `/cockpit` and `/handoffs`.

### Running the processes separately

```bash
npm run dev:client           # Vite only
npm run dev:server           # local API only
npm run dev:research-worker  # publication polling / digest generation
```

### Preview the built app

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

Preview is intentionally separate from the dev client: use `4174` for active dev
work and `4175` only when you want the built bundle.

### Why it must be served over HTTP

- This is a React single-page app. `index.html` points at `/src/main.tsx`, which
  only resolves while Vite is running; `dist/index.html` points at `/assets/...`,
  which needs HTTP hosting from the app root.
- It uses `BrowserRouter`, so deep links like `/cockpit` and `/review/match-001`
  need SPA-style route fallback on the host.
- Opening `index.html` or `dist/index.html` as a `file://` URL will not work.

### Windows note

If PowerShell script execution is restricted on your machine, invoke npm as
`cmd /c npm.cmd <script>` instead of `npm <script>`.

### Troubleshooting

<details>
<summary><b>Common startup and hosting problems</b></summary>

- Blank page after double-clicking `index.html` or `dist/index.html`: use `npm run dev` or `npm run preview` instead. Direct `file://` opening is unsupported for this app.
- Deep link like `/review/match-001` does not load on another host: configure that host with SPA fallback so unknown routes resolve to `index.html`.
- JS or CSS assets do not load when hosted from a nested folder: host the app at the site root, or later add explicit Vite `base` configuration for subpath deployment.
- `Vite http proxy error ... ECONNREFUSED 127.0.0.1:4180`: the local API process is not running. Use `npm run dev` for the standard full-app startup, or run `npm run dev:server` separately if you intentionally started only the client.
- `npm run dev` reuses a healthy API already running on `127.0.0.1:4180` instead of starting a duplicate backend. If startup says another process owns port `4180`, stop that non-CTP process or change the local API port before retrying.
- `http://localhost:4174` is the required local dev URL. Vite now fails fast instead of drifting to `4175+`. If startup says port `4174` is already serving a different process, stop that process or free the port before running `npm run dev`.
- Stale Vite servers on alternate ports like `4175` are not reused by the standard dev flow. `npm run dev` only reuses the correct client when it is already running on `127.0.0.1:4174`.
- The `/screening` page now shows runtime/build metadata plus a PHI-safe diagnostics panel for `Full-record LLM` runs. If the page stays in demo mode, it will clearly say no live provider call was attempted.
- Live provider health badges are connectivity checks, not quota guarantees. A provider can look healthy and still fail at runtime with a quota or safety error; that fallback path will be recorded in the Screening diagnostics panel.

</details>

### Windows cache note
If Vite reports an `EPERM` rename error under `node_modules/.vite`, this prototype is configured to use `.vite-cache` at the project root instead. If you saw the old error before this change, stop the dev server and start it again.
