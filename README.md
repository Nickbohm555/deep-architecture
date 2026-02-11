<div align="center">

# Deep Architecture

<p><strong>Runtime Intelligence for Real Codebases</strong></p>
<p>Turn repository code into a living architecture graph with ingest + explain pipelines.</p>

<p>
  <a href="http://localhost:3000"><img src="https://img.shields.io/badge/App-3000-0ea5e9?style=for-the-badge&logo=vercel&logoColor=white" alt="App Port" /></a>
  <a href="http://localhost:3001"><img src="https://img.shields.io/badge/Docs-3001-14b8a6?style=for-the-badge&logo=vite&logoColor=white" alt="Docs Port" /></a>
  <img src="https://img.shields.io/badge/Status-Active-22c55e?style=for-the-badge" alt="Status" />
</p>

<p>
  <img src="https://img.shields.io/badge/Next.js-14-111827?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-18-0ea5e9?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Postgres-Data-0f766e?style=flat-square&logo=postgresql" alt="Postgres" />
  <img src="https://img.shields.io/badge/pg--boss-Jobs-1d4ed8?style=flat-square" alt="pg-boss" />
  <img src="https://img.shields.io/badge/OpenAI-Analysis-7c3aed?style=flat-square&logo=openai" alt="OpenAI" />
</p>

<p>
  <a href="#quick-start">Quick Start</a> ·
  <a href="#runtime-topology">Runtime Topology</a> ·
  <a href="#pipeline-sequence">Pipeline Sequence</a> ·
  <a href="#architecture-surfaces">Architecture Surfaces</a> ·
  <a href="#command-surface">Commands</a> ·
  <a href="#diagnostics">Diagnostics</a>
</p>

</div>

## Signal

Deep Architecture builds a living system map from source code, focused on:

- Trigger paths
- Runtime actors
- Data movement
- Queue and boundary behavior

It is optimized for architecture comprehension, not static file browsing.

## Highlights

- Live architecture graph from repository ingest
- Async queue-backed processing with dedicated worker runtime
- Node-level explanation generation tied to graph context
- Typed API surface and repository-based persistence layer
- Docs guardrails to keep architecture docs synced with code

## Quick Start

```bash
# 1) database
docker compose up -d

# 2) dependencies
pnpm install

# 3) worker (required for ingest/explain)
pnpm worker

# 4) web app
pnpm dev

# 5) docs site (optional)
pnpm docs:dev
```

- App: `http://localhost:3000`
- Docs: `http://localhost:3001`

## Runtime Topology

```mermaid
flowchart LR
  U[User] --> UI[Next.js App<br/>React Flow UI]
  UI --> API[Route Layer<br/>src/app/api/*]
  API --> SVC[Services<br/>src/server/services/*]
  SVC --> Q[(pg-boss Queues)]
  SVC --> DB[(Postgres)]
  W[Worker<br/>src/server/worker.ts] --> Q
  W --> A[Analysis Engine<br/>src/server/analysis/*]
  A --> DB
  SVC --> DB
  DB --> UI
```

## Pipeline Sequence

```mermaid
sequenceDiagram
  participant C as Client
  participant R as API Route
  participant S as Service
  participant Q as pg-boss
  participant W as Worker
  participant A as Analysis
  participant D as Postgres

  C->>R: POST /api/projects/ingest
  R->>S: Validate + enqueue
  S->>D: create graph snapshot (queued)
  S->>Q: publish ingest-repo
  Q->>W: deliver job
  W->>A: clone + analyze + post-process
  A->>D: persist graph + status

  C->>R: POST /api/projects/:id/nodes/:nodekey/explain
  R->>S: enqueue explanation
  S->>Q: publish explain-node
  Q->>W: deliver job
  W->>A: build node context + generate explanation
  A->>D: persist explanation + status
```

## Job State Lifecycle

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  running --> ready
  running --> failed
  failed --> queued: retry/requeue
```

## Stack Matrix

| Plane | Components |
|---|---|
| Interface | Next.js 14, React 18, React Flow |
| Orchestration | Node services + typed route layer |
| Persistence | Postgres + repository modules |
| Async | pg-boss queues + workers |
| Intelligence | OpenAI graph + node explanation generation |
| Knowledge Surface | VitePress docs + docs-guard CI |

## Architecture Surfaces

### Frontend

- `src/app/page.tsx` - workspace composition
- `src/components/home/*` - panelized UI system
- `src/lib/api/projects.ts` - typed client calls
- `src/lib/graph-view.ts` - graph projection and layout

### Backend

- `src/app/api/*` - HTTP contracts
- `src/server/services/*` - orchestration + validation
- `src/server/persistence/*` - SQL repositories
- `src/server/jobs/*` - async handlers
- `src/server/analysis/*` - model prompts and post-processing
- `src/server/worker.ts` - queue runtime entry

## Core Pipelines

### Ingest Pipeline

1. `POST /api/projects/ingest`
2. Validate URL and create queued graph snapshot
3. Publish `ingest-repo` job
4. Clone + analyze repository
5. Persist graph (`queued -> running -> ready|failed`)

### Explain Pipeline

1. `POST /api/projects/:id/nodes/:nodekey/explain`
2. Publish `explain-node` job
3. Build node context + generate explanation
4. Persist result (`queued -> running -> ready|failed`)

## Execution Map

| Flow | Trigger | Queue | Worker Entry | Persistence |
|---|---|---|---|---|
| Ingest | `POST /api/projects/ingest` | `ingest-repo` | `src/server/jobs/ingest-worker.ts` | `graphs`, `graph_nodes`, `graph_edges` |
| Explain | `POST /api/projects/:id/nodes/:nodekey/explain` | `explain-node` | `src/server/jobs/node-explanation-worker.ts` | `node_explanations` |

## Data Layer

Schema: `src/server/schema.sql`

Primary tables:

- `projects`
- `graphs`
- `graph_nodes`
- `graph_edges`
- `node_explanations`

## Environment Contract

Required:

- `DATABASE_URL` (example: `postgres://deep_arch:deep_arch@localhost:5432/deep_arch`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)

Optional:

```bash
pnpm worker:env
```

## Command Surface

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm test`
- `pnpm build:worker`
- `pnpm worker`
- `pnpm worker:env`
- `pnpm docs:dev`
- `pnpm docs:build`
- `pnpm docs:preview`
- `pnpm docs:guard`
- `pnpm docs:guard:staged`

### Recommended Dev Loop

```bash
# terminal 1
pnpm worker

# terminal 2
pnpm dev

# terminal 3 (optional docs)
pnpm docs:dev
```

## Docs Sync Gate

Workflow: `.github/workflows/docs-guard.yml`

When these areas change, docs updates are required in the same PR/commit:

- API: `src/app/api/`, `src/lib/api/` -> `docs/api.md` or `docs/changelog.md`
- Schema/contracts: `src/server/schema.sql`, `scripts_db_init.sql`, `src/server/graph-schema.ts`, `src/lib/projects-types.ts` -> `docs/schema.md` or `docs/changelog.md`
- Workflow: `src/server/worker.ts`, `src/server/jobs/`, `src/server/services/`, `src/server/ingest.ts`, `src/server/boss.ts` -> `docs/workers.md` or `docs/changelog.md`

## Diagnostics

### Jobs stuck in queue

- Run worker: `pnpm worker`
- Verify queues: `ingest-repo`, `explain-node`

### Weak graph quality

- Tune prompt logic: `src/server/analysis/openai.ts`
- Tune post-processing: `src/server/analysis/graph-postprocess.ts`

### Next artifacts causing runtime weirdness

```bash
rm -rf .next-dev .next
pnpm dev
```
