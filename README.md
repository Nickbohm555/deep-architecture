<div align="center">

# Deep Architecture

<p><strong>Runtime Intelligence For Real Codebases</strong></p>

<p>
  <a href="http://localhost:3000"><img src="https://img.shields.io/badge/app-3000-0ea5e9?style=for-the-badge&logo=vercel&logoColor=white" alt="App Port" /></a>
  <a href="http://localhost:3001"><img src="https://img.shields.io/badge/docs-3001-14b8a6?style=for-the-badge&logo=vite&logoColor=white" alt="Docs Port" /></a>
  <img src="https://img.shields.io/badge/status-active-22c55e?style=for-the-badge" alt="Status" />
</p>

<p>
  <img src="https://img.shields.io/badge/next.js-14-111827?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/react-18-0ea5e9?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/postgres-data-0f766e?style=flat-square&logo=postgresql" alt="Postgres" />
  <img src="https://img.shields.io/badge/pg--boss-jobs-1d4ed8?style=flat-square" alt="pg-boss" />
  <img src="https://img.shields.io/badge/openai-analysis-7c3aed?style=flat-square&logo=openai" alt="OpenAI" />
</p>

</div>

---

## Signal

Deep Architecture builds a living system map from source code, focused on:

- Trigger paths
- Runtime actors
- Data movement
- Queue and boundary behavior

It is designed for fast architecture comprehension, not static file navigation.

---

## Instant Boot

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

---

## Stack Matrix

| Plane | Components |
|---|---|
| Interface | Next.js 14, React 18, React Flow |
| Orchestration | Node services + typed route layer |
| Persistence | Postgres + repository modules |
| Async | pg-boss queues + workers |
| Intelligence | OpenAI graph + node explanation generation |
| Knowledge Surface | VitePress docs + docs-guard CI |

---

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

---

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

---

## Data Layer

Schema: `src/server/schema.sql`

Primary tables:

- `projects`
- `graphs`
- `graph_nodes`
- `graph_edges`
- `node_explanations`

---

## Environment Contract

Required:

- `DATABASE_URL` (example: `postgres://deep_arch:deep_arch@localhost:5432/deep_arch`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)

Optional:

```bash
pnpm worker:env
```

---

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

---

## Docs Sync Gate

Workflow: `.github/workflows/docs-guard.yml`

When these areas change, docs updates are required in the same PR/commit:

- API: `src/app/api/`, `src/lib/api/` -> `docs/api.md` or `docs/changelog.md`
- Schema/contracts: `src/server/schema.sql`, `scripts_db_init.sql`, `src/server/graph-schema.ts`, `src/lib/projects-types.ts` -> `docs/schema.md` or `docs/changelog.md`
- Workflow: `src/server/worker.ts`, `src/server/jobs/`, `src/server/services/`, `src/server/ingest.ts`, `src/server/boss.ts` -> `docs/workers.md` or `docs/changelog.md`

---

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
