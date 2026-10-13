<div align="center">

# Transformed UI — The Redesign

**The focused treatment: five pages, one coordinator's 8:30 AM queue review.**

[![Part of](https://img.shields.io/badge/part%20of-clinical--trial--prescreener-blue)](../README.md)
[![Pages](https://img.shields.io/badge/pages-5-8A4FFF)](#-feature-tour)
[![Depends on](https://img.shields.io/badge/depends%20on-sample--ui-E8A33D)](#-architecture-at-a-glance)
[![Styling](https://img.shields.io/badge/styling-pure%20CSS%20tokens-264de4)](#-architecture-at-a-glance)
[![Data: synthetic](https://img.shields.io/badge/data-100%25%20synthetic-8A4FFF)](#-whats-real-vs-whats-mock)

[🚀 Quick start](#-quick-start) · [🏗 Architecture](#-architecture-at-a-glance) · [✨ Features](#-feature-tour) · [🔍 Real vs mock](#-whats-real-vs-whats-mock) · [🛣 Roadmap](#-making-this-a-real-working-solution--roadmap)

</div>

---

A coordinator-facing React prototype of a **continuous clinical trial eligibility
pre-screener**. Built to show how an 8:30 AM queue review for an oncology research
coordinator could move from a 45-minute chart hunt to a 6-minute evidence-backed
walkthrough — with every AI recommendation traceable back to a source document.

This is the **second** of the two interface treatments in this repository. For the
feature-dense original and the comparison between them, see the
[root README](../README.md).

| | |
|---|---|
| **Status** | POC / demo. Five pages on mock patient data, plus **real Claude API calls** in the Ask Agent panel grounded on the loaded evidence bundle. All non-agent logic is mock. |
| **Audience** | Research coordinator, PI, research operations lead, executive sponsor, compliance/IRB reviewer, enterprise IT. |
| **Demo patients** | Angela Brooks, Robert Hale, Diane Foster, Marcus Green — all fabricated. |

> [!WARNING]
> **This app does not build on its own.** It imports `sample-ui`'s types and mock data
> through the `@old` build-time alias. Clone the whole repository, and keep the sibling
> `sample-ui/` directory in place.

---

## 🚀 Quick start

**Prerequisites**
- Node.js 22+ (the repo baseline; `sample-ui`'s local API requires it)
- npm (ships with Node)
- The sibling `sample-ui/` directory must be present — this app imports its
  types and mock data through the `@old` alias and will not build without it.
  Clone the whole repository, not this subdirectory.

**Install + run**
```bash
cd transformed-ui
npm install
npm run dev
```
Open [http://localhost:4175](http://localhost:4175). The `/` route redirects to `/mission-control`.

**Optional — enable the live Claude path**

Set an `ANTHROPIC_API_KEY` environment variable before `npm run dev`. The Vite dev proxy reads it at startup and injects it server-side into every request to `/api/claude` — the key never ships to the browser bundle.

```bash
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm run dev

# macOS / Linux
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

Without the key, the Ask Agent silently falls back to 4 canned responses keyed by keyword match (cardiac, CNS, escalation, queue blockers). The demo is complete either way.

**Build + typecheck**
```bash
npm run build      # tsc --noEmit && vite build
npm run preview    # preview the production build
```

---

## 🏗 Architecture at a glance

- **React 18.3 + TypeScript 5.6 + Vite 5.4 + react-router-dom 6**
- **Pure CSS** with CSS custom properties — no Tailwind, no CSS-in-JS (see `src/styles/components.css`)
- **Mock data** imported from a sibling package via a Vite alias: `@old` → `../sample-ui/src`
- **Claude calls** go through a Vite dev proxy: `fetch("/api/claude")` → `https://api.anthropic.com/v1/messages`
- **API key security**: injected in the proxy's `configure()` hook, never bundled or exposed in client code
- **No backend, no database, no authentication, no persistence** beyond a localStorage theme preference
- **Route code-splitting** — each page is lazy-imported in `src/App.tsx`

Routes:
| Path | Page |
|---|---|
| `/` → `/mission-control` | (redirect) |
| `/mission-control` | Mission Control |
| `/review/:matchId` | Deep Review |
| `/insights` | Insights |
| `/trials/:trialId` | Trial Config |
| `/audit/:matchId` | Audit Trace |

---

## ✨ Feature tour

Each feature is tagged `REAL` (computed from data or calls a real API), `ANIMATED` (driven animation, mock data), `MOCK` (static hand-authored content), or `SESSION` (kept in React state, resets on reload).

### Mission Control — `/mission-control`

Entry point for the morning queue review. File: `src/pages/MissionControlPage.tsx`.

| Feature | File | Description | Status |
|---|---|---|---|
| Metric heroes ×4 | `components/mission-control/MetricHero.tsx` | Active Patients, Trials Screening, Ready for Outreach, Pending PI Review — each with a sparkline trend | MOCK |
| Overnight changes digest | `components/mission-control/DigestPanel.tsx` | Collapsible list of what changed since last login (new evidence, fit score changes, stale data warnings) | MOCK |
| **Time Machine Control** (Wow #2) | `components/mission-control/TimeMachineControl.tsx` | "Replay rescreening — Jan 15" button opens a 5-stage animated modal showing Robert Hale's missed match: pathology arrives → rescreen fires → score 84 → card moves to Action Now → "this would not have fired in your current workflow" overlay | ANIMATED |
| Task board (Kanban) | `components/mission-control/TaskBoard.tsx` + `TaskLane.tsx` + `PatientCard.tsx` | 4 swim lanes — Action Now / Needs PI Input / Ready for Outreach / Watching. Each card shows patient, trial code, fit score, primary blocker, next appointment. Click to open Deep Review | MOCK |
| Quick actions | `components/mission-control/QuickActions.tsx` | Shortcut buttons (new screening, audit pull, export) | MOCK |

### Deep Review — `/review/:matchId`

The per-patient investigation view. File: `src/pages/DeepReviewPage.tsx`. The routing and existing polish makes `match-001` (Angela Brooks / LU-021) the demo hero.

| Feature | File | Description | Status |
|---|---|---|---|
| Collapsible patient header | `components/deep-review/CollapsibleHeader.tsx` | Name, MRN, age, sex, diagnosis, stage, ECOG, biomarkers. Shrinks on scroll | MOCK |
| Why Now banner | `components/deep-review/WhyNowBanner.tsx` | Explains why this match surfaced to the top of the queue right now | MOCK |
| Criterion accordion | `components/deep-review/CriterionAccordion.tsx` | 6 expandable rows per criterion with pass/fail/uncertain status, confidence label, source count | MOCK |
| Criterion status bar | `components/deep-review/CriterionStatusBar.tsx` | "3 Pass · 1 Fail · 1 Uncertain · 1 Manual" strip above the list | MOCK |
| Evidence panel | `components/deep-review/EvidencePanel.tsx` | Right-pane detail of the selected criterion's source snippets (document type, date, author, highlighted quote) | MOCK |
| **Temporal Bar with exclusion shading** (Wow, part of #1) | `components/deep-review/TemporalBar.tsx` | SVG timeline of all patient clinical events, with a **red-shaded exclusion window** between the event anchor and the protocol threshold, plus countdown label ("28 days until window ends"). Windows are computed at render time from the failing temporal criterion + earliest supporting evidence | REAL |
| Inline override | `components/deep-review/InlineOverride.tsx` | Per-criterion manual override with rationale text | SESSION |
| Disposition dropdown | inside `DeepReviewPage.tsx` | Candidate for Outreach / Needs PI Review / Reviewed — Not Actionable / Closed — Not Eligible / Protocol Question + "Save Review" | SESSION |
| Prev/Next patient navigation | `components/deep-review/PatientNav.tsx` | Arrow keys + on-screen buttons walk the queue in order | REAL |
| Trial comparison strip | `components/deep-review/TrialComparisonStrip.tsx` | Trial short code, phase, PI, protocol version, activation state | MOCK |
| Collaboration panel | `components/deep-review/CollaborationPanel.tsx` | PI escalation threads — existing threads visible, new thread creation is mock | MOCK |
| Deep Review layout shell | `components/deep-review/DeepReviewLayout.tsx` | Two-column layout orchestrating header, criterion matrix, evidence pane | — |

### Insights — `/insights`

Operations view for research ops lead + exec sponsor. File: `src/pages/InsightsPage.tsx`.

| Feature | File | Description | Status |
|---|---|---|---|
| **Projection KPI strip ×4** (Wow #3) | `pages/InsightsPage.tsx` + `data/projectionMetrics.ts` | Screens/wk, Coordinator hours/wk, Outreach-ready/wk, Net enrollment lift/quarter — flips between baseline and projected values on toggle | REAL (toggle-driven) |
| **Projection Toggle** (Wow #3) | `components/insights/ProjectionToggle.tsx` | Segment control: "Current workflow" vs "With pre-screener (projected)" | REAL |
| **Funnel chart with count-up animation** | `components/insights/FunnelChart.tsx` | 6-stage funnel (Screened → Reviewed → Contacted → Eligible → Consented → Enrolled) that animates between series on toggle, with delta chips (+46, +56, +14, +9, +7, +7) | REAL |
| Criterion family heatmap | `components/insights/HeatmapGrid.tsx` | Trial × criterion-family matrix colored by pass/fail density | MOCK |
| Trial health bar | `components/insights/TrialHealthBar.tsx` | Per-trial enrollment progress vs. target | MOCK |
| Velocity sparklines | `components/insights/VelocitySparklines.tsx` | Small multi-line charts for screening/consent/enrollment velocity | MOCK |
| Filter bar | `components/insights/FilterBar.tsx` | Disease area, trial, date range, status (UI only — no filtering applied) | MOCK |
| Methodology blurb | inside `pages/InsightsPage.tsx` | Only visible in projected view. Explicitly labels projections as modeled (40% effort-reduction factor from published case studies), **not measured** | MOCK |

### Audit Trace — `/audit/:matchId`

Compliance / governance view showing every decision and how it was produced. File: `src/pages/AuditTracePage.tsx`.

| Feature | File | Description | Status |
|---|---|---|---|
| Audit flow graph | `components/audit/AuditFlowGraph.tsx` | Sankey-style visualization of patient → evidence → criteria → match decision path | MOCK |
| Audit timeline | `components/audit/AuditTimeline.tsx` | Vertical timeline of match version changes with actor, timestamp, **rule version, model version, prompt version** | MOCK |
| Evidence map | `components/audit/EvidenceMap.tsx` | Network graph showing which evidence snippets link to which criteria | MOCK |

### Trial Config — `/trials/:trialId`

Per-trial protocol management. File: `src/pages/TrialConfigPage.tsx`.

| Feature | File | Description | Status |
|---|---|---|---|
| Criterion builder | `components/trial-config/CriterionBuilder.tsx` | Card-based view of each eligibility criterion with threshold logic and examples | MOCK |
| Protocol timeline | `components/trial-config/ProtocolTimeline.tsx` | Version history: v4.0 → v4.1 → v4.2 with activation dates | MOCK |
| Protocol diff | `components/trial-config/ProtocolDiff.tsx` | Side-by-side comparison of two protocol versions highlighting changed criteria | MOCK |

### Global — Ask Agent panel + header

| Feature | File | Description | Status |
|---|---|---|---|
| **Ask Agent floating panel** (Wow #1) | `components/ask-agent/AskAgentPanel.tsx` + `AgentSidebar.tsx` + `AgentConversation.tsx` + `AgentInputBar.tsx` + `AgentMessage.tsx` | Context-aware Q&A panel. On `/review/:matchId` the header shows "Angela Brooks · LU-021" | REAL |
| **Live Claude call, grounded on evidence** | `services/askAgent.ts` + `services/claudeClient.ts` | Packs a multi-section bundle (PATIENT / TRIAL / MATCH / CRITERIA / EVIDENCE / TIMELINE / AUDIT TRAIL) into the system prompt, posts to `/api/claude`, parses `[cite:evidence-xxx]` markers out of the response | REAL |
| **Citation chips** | `components/ask-agent/AgentCitationChip.tsx` | Each `[cite:evidence-xxx]` marker in a response becomes a clickable chip that resolves to the underlying evidence snippet | REAL |
| Agent data table | `components/ask-agent/AgentDataTable.tsx` | Inline table rendering (used in the cardiac walk-through fallback to show the 4-row temporal math) | REAL |
| Suggested prompts | `components/ask-agent/AgentSuggestedPrompt.tsx` | Context-aware scripted prompts shown per page | MOCK (copy) |
| Agent mode tabs | `components/ask-agent/AgentModeTabs.tsx` | Ask / Compare / Summarize / Explore / Draft modes | MOCK (labels) |
| **Fallback responses** | `data/agentFallbacks.ts` | 4 canned responses for the scripted demo questions, plus a generic fallback. Keyword-matched on the user query. Triggers on timeout, 4xx/5xx, network error, or empty response | REAL |
| Command palette | `components/layout/CommandPalette.tsx` | `Cmd+K` / `Ctrl+K` overlay for searching patients, trials, page shortcuts | REAL |
| Command bar (header) | `components/layout/CommandBar.tsx` | Logo, command palette trigger, notifications, dark/light toggle, Ask Agent launcher | REAL |
| **Primary nav strip** | `components/layout/PrimaryNav.tsx` | Top-level tab bar with Mission Control / Deep Review / Insights / Audit Trace / Trial Config. Parameterized routes default to hero IDs and preserve the current `matchId` / `trialId` when already deep-linked | REAL |
| Theme toggle | inside `AppFrame.tsx` | Light/dark mode, persisted to localStorage | REAL |
| Keyboard shortcuts | via `components/layout/AppFrame.tsx` | Cmd+K (palette), arrow keys (queue nav), Esc (close modals) | REAL |

---

## 👥 User stories by persona

### Coordinator — Lena Ortiz

> As a clinical research coordinator, I want to triage my morning queue in under 10 minutes so I can spend the rest of the day on patients who actually need me.

- *"I want to see what changed overnight, so I know where to start."* → **Overnight digest** on Mission Control.
- *"I want a ranked queue with the blocker named on each card, so I'm not opening every chart to find out."* → **Task board swim lanes** + blocker chips.
- *"I want to know why the pre-screener flagged this patient as uncertain — and what the source was — so I don't have to hunt through 12 notes."* → **Deep Review criterion accordion** + **Evidence panel** + **Ask Agent grounded on the chart**.
- *"I want to capture 'I'm not sure' as a first-class answer instead of being forced to pass/fail."* → **Uncertain status** on criteria + **Inline override** with rationale + **Disposition dropdown** including "Needs PI Review."
- *"I want to draft a PI escalation with the evidence pre-attached, so Dr. Shah doesn't have to re-derive what I already saw."* → **Collaboration panel** + Ask Agent "Draft escalation" fallback.
- *"I want to see patients I might have missed last month."* → **Time Machine replay**.

### Principal Investigator — Dr. Maya Shah

> As a PI, I want to review only the cases that need my clinical judgment, with the underlying chart evidence in front of me, so I can decide in 2 minutes instead of 20.

- *"I want my inbox to only surface cases that need me, not every borderline patient."* → **"Needs PI Input" lane** on Mission Control.
- *"I want to see the reasoning and the source dates before I commit to a call."* → **Criterion accordion** + **Temporal Bar exclusion shading** ("28 days until window ends") + **Evidence panel**.
- *"I want to leave a rationale that gets audited, not a Slack message that disappears."* → **Collaboration panel** thread reply + append to **Audit Trace**.
- *"I want to know which prompt and which model version produced this recommendation."* → **Audit Trace timeline** version badges.
- *"I don't trust AI I can't see — show me the chart evidence it's citing."* → **Citation chips** in every Ask Agent response resolve back to the source snippet.

### Research Operations Lead

> As the research ops lead, I want a funnel view I can share with the CRO and the executive sponsor, so I can prove (or disprove) that our pre-screening is actually working.

- *"I want a screened → enrolled funnel with drop-off rates I can benchmark."* → **Insights funnel chart** (6 stages).
- *"I want to compare current baseline to the projected pre-screener impact, with the methodology called out."* → **Projection Toggle** + methodology blurb.
- *"I want to see where my coordinators' hours are actually going so I know what to automate next."* → **Criterion family heatmap** + **Velocity sparklines**.
- *"I want to filter by trial and disease area."* → **Filter bar** (UI only in POC).

### Executive Sponsor

> As an executive sponsor, I want a single slide's worth of numbers — enrollment lift and dollar savings — that I can take to the board.

- *"Give me the ROI on one screen."* → **Projection KPI strip**: "+46 screens/wk", "-22 hours recovered", "+7 patients/wk", "+$196K activation savings".
- *"Show me the cost of doing nothing."* → **Time Machine replay** (missed-patient reveal).
- *"Prove the AI is auditable before I put my name on this."* → **Audit Trace** with prompt/model/rule versions.

### Compliance / IRB / Enterprise IT

> As a compliance officer, I want every AI interaction logged with prompt and model version, and PHI never leaving approved boundaries.

- *"I need a complete audit of every model run, including prompt and version."* → **Audit Trace flow graph + timeline** (roadmap: back this with an append-only store — see [Phase 6](#phase-6--audit-compliance-governance)).
- *"I need a clear override and rollback path so clinicians remain in the loop."* → **Inline override** + **Disposition** + **Audit history**.
- *"I need PHI handling assurances."* → Current POC: mock data only. Production path: see [Phase 7](#phase-7--llm-security-hardening).

---

## 🔍 What's real vs what's mock

| Capability | Status | Where it lives |
|---|---|---|
| Ask Agent Q&A (live Claude call, grounded on evidence) | **REAL** | `src/services/askAgent.ts`, `src/services/claudeClient.ts` |
| Citation chip extraction from `[cite:evidence-xxx]` markers | **REAL** | `src/services/askAgent.ts` (`extractCitations`) + `AgentCitationChip.tsx` |
| Ask Agent fallbacks (keyword-matched canned responses) | **REAL** | `src/data/agentFallbacks.ts` |
| Temporal exclusion math + red-band shading | **REAL** | `src/components/deep-review/TemporalBar.tsx` + `src/pages/DeepReviewPage.tsx` (`useMemo` for `exclusionWindows`) |
| Funnel chart + KPI count-up animation | **REAL** | `src/components/insights/FunnelChart.tsx`, `src/components/insights/ProjectionToggle.tsx` |
| Time Machine replay animation | **ANIMATED** (mock data-driven) | `src/components/mission-control/TimeMachineControl.tsx` |
| Command palette + keyboard shortcuts | **REAL** | `src/components/layout/CommandPalette.tsx`, `AppFrame.tsx` |
| Theme (light/dark) persistence | **REAL** (localStorage) | `src/components/layout/AppFrame.tsx` |
| Patient + chart data | **MOCK** | `../sample-ui/src/data/mockData.ts` (via `@old` alias) |
| Trial / protocol / criteria | **MOCK** | `../sample-ui/src/data/mockData.ts` |
| Eligibility assessment logic | **MOCK** (static assessments) | `../sample-ui/src/data/mockData.ts` |
| Coordinator overrides + dispositions | **SESSION** (lost on reload) | `ReviewContext` in `src/context/` |
| Audit events | **MOCK** | `../sample-ui/src/data/mockData.ts` (`auditEvents`) |
| Continuous rescreening / background jobs | **NONE** | — |
| Authentication / user identity | **NONE** | — |
| EHR integration (FHIR / HL7 / Epic / Care Everywhere) | **NONE** | — |
| Persistent database / API backend | **NONE** | — |

---

## 🛣 Making this a real working solution — roadmap

Ten phases from POC to a validated clinical pilot, with a suggested sequencing at the end.

<details>
<summary><b>Expand the full 10-phase roadmap</b> — data foundation, EHR connectors, rules engine, rescreening, RBAC, audit, LLM hardening, deployment, validation, UI hardening</summary>

This is a phased gap analysis from "working POC demo" to "production coordinator tool deployed at a cancer center." Each phase names the goal, the key deliverables, and where it plugs into the current code. Phases are roughly ordered by dependency, but several can run in parallel once Phase 1 exists.

### Phase 1 — Data foundation

**Goal:** Replace every `mockData.ts` import with a real backend call, so the UI is rendering live records.

- Provision a relational database (Postgres recommended) with tables for `patients`, `trials`, `criteria`, `assessments`, `evidence`, `matches`, `audit_events`, `collaboration_threads`, `reviews`, `users`.
- Build a minimal backend API (FastAPI or Node/Express) that exposes REST (or GraphQL) endpoints matching the existing TypeScript types in `src/types/` and `@old/types`.
- Add a migration pipeline (Alembic, Drizzle, or Prisma migrate).
- Introduce a thin service/hook layer in the frontend (`src/services/data/*.ts`) that replaces direct `import { getPatient, getMatch, getTrial } from "@old/data"` calls with HTTP fetches behind the same function signatures — so page components don't change.

**Plugs into:** every page component that currently reads from `@old/data` or `src/data/index.ts`.

### Phase 2 — EHR connectors + ingestion

**Goal:** Real patient evidence flowing in from the EHR instead of hand-authored JSON.

- **FHIR R4 connector** for Epic: `Patient`, `Condition`, `Observation` (labs), `Procedure`, `MedicationStatement`, `DocumentReference`.
- **HL7 v2 listener** for real-time ADT and ORU feeds.
- **Care Everywhere / outside-record import worker** — handles the "pathology arrives late" scenario the Time Machine replay dramatizes.
- **Normalization layer** that maps raw FHIR bundles onto the existing `EvidenceSnippet` / `TimelineEvent` / `CriterionAssessment` shapes so the frontend doesn't change.
- **PHI hygiene**: hash patient IDs in logs, strip direct identifiers from anything leaving the institutional boundary.

**Plugs into:** new `services/ingest/` backend package feeding Phase 1's database.

### Phase 3 — Protocol ingestion + criterion rules engine

**Goal:** Turn the `TrialConfigPage` from a viewer into a real protocol pipeline, and replace the static `assessments` array with a deterministic rules engine.

- **Protocol PDF uploader** + NLP extraction service that produces structured criterion JSON (type, operator, threshold, temporal anchor, source section).
- **Reviewer UI** for humans to validate and correct extracted criteria — builds on the existing `CriterionBuilder.tsx`.
- **Deterministic rules engine** for temporal / lab / categorical / demographic criteria. This is what computes `pass / fail / uncertain` from the live evidence.
- **LLM-assisted judgment layer** used *only* for subjective criteria (e.g., "investigator judgment"), grounded using the same `[cite:evidence-xxx]` contract as today's Ask Agent.
- **Criterion library** so "No MI within 6 months" is decomposed once and reused across every trial that references it.

**Plugs into:** `src/pages/TrialConfigPage.tsx` + new `services/rules-engine/` backend package.

### Phase 4 — Continuous rescreening

**Goal:** Replace the scripted Time Machine animation with a real background worker that re-runs matches when new evidence arrives.

- Background worker framework (BullMQ, Celery, or Temporal).
- **Change detection**: when ingestion lands new evidence on a patient, enqueue re-evaluation of every open match for that patient.
- **Re-scoring** updates fit score and match status, emits an audit event, and surfaces the change in the overnight digest.
- **Notification fan-out**: in-app toast, optional email/Teams webhook for PI escalations, Mission Control "NEW MATCH" banner (this already exists as static UI).
- The current `TimeMachineControl.tsx` component becomes a **history view** of real rescreen events instead of a scripted reveal.

**Plugs into:** `TimeMachineControl.tsx` (repurposed), `DigestPanel.tsx` (fed from real events), new `services/rescreening-worker/` package.

### Phase 5 — Identity, auth, RBAC

**Goal:** Every action traceable to an authenticated user with appropriate permissions.

- **SSO** via SAML or OIDC (Okta / Azure AD / institutional directory).
- **Roles**: coordinator, PI, research ops lead, admin, read-only auditor.
- **Per-trial ACLs** so coordinators only see studies they're assigned to.
- **Session management** + logout + idle timeout.
- Audit log links every action to an authenticated principal (feeds Phase 6).

**Plugs into:** new `AuthProvider` component wrapping `AppFrame.tsx`. Header displays the real user instead of the hardcoded "LO" initials.

### Phase 6 — Audit, compliance, governance

**Goal:** Turn the Audit Trace page into a window onto a real append-only audit store, not a mock.

- **Append-only audit store** — immutable, optionally hash-chained for tamper evidence.
- **Every Claude call is persisted**: `{prompt, model, model_version, prompt_version, temperature, response, tokens, latency_ms, citations, user_id, match_id, timestamp}`. Today `askAgent.ts` is fire-and-forget; extend it to write through the audit service before returning to the UI.
- **IRB-ready export pipeline** for the monthly governance report.
- **Bias monitoring dashboard** by demographics (pilot month 3 milestone).
- **Model card + prompt version registry** — every change to the system prompt or model version is a versioned artifact referenced from every audit event.

**Plugs into:** `src/services/askAgent.ts` (persist instead of fire-and-forget), `src/components/audit/AuditFlowGraph.tsx` + `AuditTimeline.tsx` (render real lineage).

### Phase 7 — LLM security hardening

**Goal:** Remove every demo-only shortcut from the Claude call path.

- **Move from Vite dev proxy to a real backend endpoint** — the API key currently lives in the server-side Vite proxy, which is only safe in local development. In production the backend (Phase 1) owns the Claude credentials.
- **Prompt injection defense**: strict system prompt, reject untrusted content that looks like instructions, treat every user query as untrusted input.
- **Rate limiting + per-user quota** with abuse detection.
- **PHI-redaction pass** before anything is sent to the model, OR use Anthropic's PHI-safe deployment / on-prem inference where the institution requires it. Validate with Anthropic that the chosen deployment option is covered by a BAA.
- **Model pinning** — production uses a specific versioned model (`claude-sonnet-4-5-YYYYMMDD`), upgrades are explicit and audited.
- **Output filtering**: strip anything the model might add that isn't cited.

**Plugs into:** replace `src/services/claudeClient.ts` proxy path with a backend endpoint.

### Phase 8 — Deployment + operations

**Goal:** The app runs reliably in dev/staging/prod with proper ops.

- **Containerize**: Dockerfile for the frontend, Dockerfile for the backend, docker-compose for local, Helm chart for Kubernetes.
- **Environment separation**: dev / staging / prod with per-env secrets and per-env DB.
- **Secrets management**: Vault, AWS Secrets Manager, or Azure Key Vault.
- **Observability**: structured logs (pino/winston), metrics (Prometheus), distributed tracing (OpenTelemetry), error tracking (Sentry).
- **On-prem deployment option** for institutions that cannot ship PHI to cloud providers — the architecture must be portable (no managed-cloud-only services in the hot path).
- **CI/CD** with automated tests, dependency scanning, and SBOM generation.

**Plugs into:** new `deploy/` folder, `.github/workflows/`, `Dockerfile` at repo root.

### Phase 9 — Quality, validation, IRB

**Goal:** You can credibly claim the tool produces clinically sound recommendations.

- **Unit tests** for the rules engine (100% coverage on eligibility logic — this is non-negotiable for a clinical tool).
- **Integration tests** for data ingestion, Ask Agent contract, and end-to-end match flow.
- **Clinical validation study**: 50–100 real cases reviewed by coordinators + PIs, measured for agreement with the AI recommendations (sensitivity, specificity, agreement kappa). This is the evidence pack the IRB will want.
- **IRB submission package**: protocol, model card, risk assessment, data flow diagram, incident response plan, rollback plan.
- **Go/no-go readiness scorecard** with measurable exit criteria.

**Plugs into:** new `tests/` directory, new `docs/validation/` directory.

### Phase 10 — UI hardening

**Goal:** The UI survives real-world conditions — slow networks, tired coordinators on aging Windows workstations, empty states, screen readers.

- **Loading skeletons** for every data-fetching component (the `SkeletonLoader.tsx` primitive already exists — apply it everywhere).
- **Error boundaries** + graceful degradation when a service is down.
- **Empty states**: new coordinator with zero matches, a trial that just activated, an empty digest.
- **Accessibility**: full keyboard navigation, screen-reader labels, WCAG AA contrast, ARIA roles on custom widgets.
- **Responsive QA**: coordinator workstation, tablet for tumor-board rounds, projection TV for exec briefings.
- **Print stylesheet** for paper hand-offs to PIs who prefer paper.

**Plugs into:** every page component; add `@testing-library/react` + `axe-core` for automated a11y testing.

---

### Suggested sequencing

Phase 1 has to come first. Everything else can start in parallel once Phase 1 is in place, but **Phases 5 and 7 must be complete before any real PHI touches the system**, and **Phase 9 must be complete before the first real patient is screened in production**.

A realistic pilot-to-production timeline for a small engineering team (2–3 engineers + 1 clinical informaticist): Phases 1–3 in weeks 1–8 (the pilot backend), Phase 4 in weeks 6–10, Phases 5–7 in weeks 8–14 (the compliance backbone), Phases 8–10 in parallel from week 10 onward. The critical path is *always* data ingestion and the rules engine — the UI is the easy part, because it already exists.

---

</details>

## 📂 Project structure

```
transformed-ui/
├── src/
│   ├── App.tsx                  # Route table + lazy imports
│   ├── main.tsx                 # React DOM entry
│   ├── pages/                   # One file per route
│   │   ├── MissionControlPage.tsx
│   │   ├── DeepReviewPage.tsx
│   │   ├── InsightsPage.tsx
│   │   ├── TrialConfigPage.tsx
│   │   └── AuditTracePage.tsx
│   ├── components/
│   │   ├── layout/              # AppFrame, CommandBar, PrimaryNav, CommandPalette, SidePanel, Breadcrumbs
│   │   ├── mission-control/     # MetricHero, DigestPanel, TimeMachineControl, TaskBoard, TaskLane, PatientCard, LaneHeader, QuickActions
│   │   ├── deep-review/         # CollapsibleHeader, WhyNowBanner, CriterionAccordion, CriterionStatusBar, EvidencePanel, TemporalBar, InlineOverride, PatientNav, TrialComparisonStrip, CollaborationPanel, DeepReviewLayout
│   │   ├── insights/            # ProjectionToggle, FunnelChart, HeatmapGrid, TrialHealthBar, VelocitySparklines, FilterBar
│   │   ├── audit/               # AuditFlowGraph, AuditTimeline, EvidenceMap
│   │   ├── trial-config/        # CriterionBuilder, ProtocolTimeline, ProtocolDiff
│   │   ├── ask-agent/           # AskAgentPanel, AgentSidebar, AgentConversation, AgentInputBar, AgentMessage, AgentCitationChip, AgentDataTable, AgentSuggestedPrompt, AgentModeTabs
│   │   └── shared/              # Badge, Tooltip, Sparkline, ProgressRing, SkeletonLoader, AnimatedCounter, StatusDot, IconButton, Kbd, Divider, TrustRibbon
│   ├── services/
│   │   ├── claudeClient.ts      # Low-level fetch wrapper, timeout, error classes
│   │   └── askAgent.ts          # Evidence packing, citation parsing, fallback routing
│   ├── data/
│   │   ├── index.ts             # Re-exports mock data from @old + extensions
│   │   ├── extendedMockData.ts  # Additional POC-only mock data
│   │   ├── helpers.ts           # Data lookup helpers
│   │   ├── agentFallbacks.ts    # Canned Ask Agent responses
│   │   └── projectionMetrics.ts # Current vs projected funnel + KPI data
│   ├── context/                 # AppContext, ReviewContext, KeyboardContext
│   ├── hooks/                   # useKeyboardShortcuts, custom hooks
│   ├── types/                   # Extended TypeScript types on top of @old/types
│   └── styles/                  # components.css, tokens.css, global stylesheets
├── vite.config.ts               # Proxy (/api/claude), alias (@old → ../sample-ui/src)
├── package.json
└── tsconfig.json
```

---

## 🔧 Development notes

**Claude API key**
- Read from `process.env.ANTHROPIC_API_KEY` (or via Vite's `loadEnv`) at dev-server startup.
- Injected in the `configure()` hook of the `/api/claude` proxy in `vite.config.ts` — never shipped to the browser bundle.
- If absent, every Ask Agent call lands in the fallback path after a short timeout.

**Fallback responses**
- Defined in `src/data/agentFallbacks.ts`.
- Each fallback has `id`, `keywords` (lowercased substrings), `content`, optional `table`, `citations`, `confidenceNote`.
- `lookupFallback(query)` does a case-insensitive substring match over the keywords. No match → `genericFallback`.
- To add a new scripted question: add a new entry with keywords that uniquely match your scripted prompt.
- Fallbacks trigger on timeout (6s default), HTTP 4xx/5xx, network error, or empty model response — the user sees a seamless response and the failure logs to the console.

**The `@old` alias**
- Configured in `vite.config.ts`: `@old` → `../sample-ui/src`.
- Lets the transformed UI import types and mock data from its predecessor without duplicating them.
- When Phase 1 of the roadmap replaces `mockData.ts`, the alias stays but `@old/data` stops being the source of truth — everything flows through a service hook instead.

**Bypassing the Claude API entirely**
- Just don't set `ANTHROPIC_API_KEY`. The fallbacks cover the 4 scripted demo questions.
- Useful for airgapped demos, for rehearsals, and as a sanity check that the fallback path is wired correctly.

**Known gaps / demo-only limitations**
- No authentication, no session, no persistence beyond the theme preference.
- Coordinator dispositions and overrides reset on page reload.
- The Time Machine replay is a scripted animation, not a real rescreen event stream.
- The Audit Trace page reads from a static `auditEvents` array — version numbers are hand-authored, not minted from real model runs.
- The Filter Bar in Insights is UI-only — no actual filtering is applied.
- `TrialConfigPage` is a viewer; nothing writes back to protocol state.
- "Draft PI escalation" is a static button, not a modal that creates a new thread.
- The UI has not been QA'd on anything except Chrome at desktop resolution.

**Gotchas when picking this up**
- This app lives next to `sample-ui`. That sibling is the source of mock data (`mockData.ts`). Do not delete it — the Vite alias depends on it.
- `npm run build` runs `tsc --noEmit && vite build`. Type errors will block a production build.
- Dev server port is pinned to 4175 in `.claude/launch.json` so the preview tooling knows where to find it.
