# Clinical Trial Eligibility Pre-Screener — two interface architectures

One product, built twice. Both apps in this repository screen oncology patients
against clinical trial criteria and ask a human to review every result. They
differ in how the interface is organised, and the difference is the point of the
repo.

| | [`sample-ui/`](sample-ui) | [`transformed-ui/`](transformed-ui) |
|---|---|---|
| Shape | A feature-dense coordinator workbench | A focused 5-page redesign |
| Surfaces | 14 routes across four workspaces | 5 pages |
| Styling | Design primitives + a `ctp-` class layer | Its own CSS custom-property token system |
| Charts | visx | Hand-built SVG |
| Backend | A local API (port 4180), plus an optional Postgres research worker | None — dev-proxy only |
| Extras | SBAR clinical handoffs, research digests, audit replay | Mission control, deep review, insights, trial config, audit trace |

`sample-ui` came first and grew by accretion: every workflow that mattered got a
surface, and the result is a workbench that rewards an operator who already
knows the domain. `transformed-ui` is the redesign — same domain model, same
mock data, five pages, built around one coordinator's 8:30 AM queue review
rather than around the feature inventory. Reading them side by side is more
informative than reading either alone.

## The two apps are coupled — clone the whole repo

`transformed-ui` does **not** build on its own. It reuses `sample-ui`'s domain
types and mock data through a build-time Vite/TypeScript alias:

```
@old  →  ../sample-ui/src
```

17 imports across 16 files depend on it (16 × `@old/types`, 1 ×
`@old/data/mockData`). The alias is declared twice and both must agree:

- [`transformed-ui/vite.config.ts:16`](transformed-ui/vite.config.ts) — `resolve.alias`
- [`transformed-ui/tsconfig.json:25`](transformed-ui/tsconfig.json) — `compilerOptions.paths`

So: clone the repository, not a subdirectory. If `sample-ui/` is missing or
renamed, `transformed-ui`'s typecheck and build both fail.

## Requirements

**Node.js 22 or newer.** `sample-ui`'s local API runs under
`node --experimental-strip-types`, which requires 22. npm ships with Node; there
is nothing else to install globally.

## Running them

Each app is its own npm project — install inside the one you want.

```bash
cd sample-ui && npm install && npm run dev
```
Client on `http://127.0.0.1:4174`, local API on `127.0.0.1:4180` (one command
starts both). Entry points: `/cockpit`, `/handoffs`, `/research-digests`.

```bash
cd transformed-ui && npm install && npm run dev
```
`http://localhost:4175`. `/` redirects to `/mission-control`.

Both apps run with **no API keys and no external services**, on fixture data.
Two optional paths are the exceptions, and each degrades honestly rather than
breaking:

- `transformed-ui`'s Ask Agent calls the Anthropic API when `ANTHROPIC_API_KEY`
  is set, and otherwise falls back to canned keyword-matched responses. The key
  is injected server-side by the Vite dev proxy and never reaches the browser
  bundle.
- `sample-ui`'s research-digest workspace needs Postgres with pgvector via
  `RESEARCH_DATABASE_URL`. It does **not** fall back to mock publication data —
  without a database, use `/cockpit` and `/handoffs`.

`sample-ui` ships a `.env.example` — copy it to `.env` and fill in what you
need. `transformed-ui` reads `ANTHROPIC_API_KEY` from the environment directly.
No real credentials are committed anywhere in this repository.

## All clinical data here is synthetic

Every patient, chart, note, protocol, trial, biomarker, outcome and audit record
in both apps is fabricated for demonstration. There is no PHI, no de-identified
real patient data, and no connection to any health system. The apps say so in
their own UI. Patient names, MRNs, clinician personas, site names and trial
identifiers are invented; any resemblance to a real record is coincidence.

Both apps are **prototypes**. They demonstrate interface and workflow design,
not a deployable clinical system: eligibility logic is static mock assessment
data rather than a rule engine, nothing persists, and there is no authentication,
authorisation or EHR integration. Each app's README has a candid
"what's real vs what's mock" section — read it before drawing conclusions about
what works.

## Repository layout

```
.
├── sample-ui/          # the feature-dense workbench (+ local API, research worker)
├── transformed-ui/     # the 5-page redesign (depends on sample-ui via @old)
├── LICENSE             # MIT
└── README.md
```

Per-app detail lives in [`sample-ui/README.md`](sample-ui/README.md) and
[`transformed-ui/README.md`](transformed-ui/README.md) — routes, feature tours,
user stories by persona, the domain model, the real-vs-mock tables, and a
roadmap from prototype to pilot.

## License

MIT — see [LICENSE](LICENSE).
