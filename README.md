# Deep Architecture

Architecture flow explorer for understanding how data and triggers move through a repository.

## At A Glance

- Ingest a GitHub repo and generate an architecture graph.
- Explore nodes/edges in an interactive layered view.
- Ask AI for node-level explanations and save edits.
- Track ingest/explain work through async queue status.

## Stack

- App: Next.js 14 + React Flow
- DB: Postgres
- Queue: pg-boss
- Analysis: OpenAI API
- Docs: VitePress

## Quick Start

1. Start Postgres:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
pnpm install
```

3. Run worker (required for ingest/explain jobs):

```bash
pnpm worker
```

4. Run app:

```bash
pnpm dev
```

5. Optional docs site (separate port):

```bash
pnpm docs:dev
```

- App: `http://localhost:3000`
- Docs: `http://localhost:3001`

## Environment Variables

Set these in your shell:

- `DATABASE_URL` (example: `postgres://deep_arch:deep_arch@localhost:5432/deep_arch`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default: `gpt-4.1-mini`)

Optional local run with `.env.local`:

```bash
pnpm worker:env
```

## Architecture Layout

### Frontend

- `src/app/page.tsx`: top-level composition.
- `src/components/home/*`: dashboard panels.
- `src/lib/api/projects.ts`: typed API client.
- `src/lib/graph-view.ts`: graph projection/layout.

### Backend

- `src/app/api/*`: HTTP layer.
- `src/server/services/*`: orchestration and validation.
- `src/server/persistence/*`: SQL/data access.
- `src/server/jobs/*`: worker job handlers.
- `src/server/analysis/*`: prompt + graph processing.
- `src/server/worker.ts`: queue worker entrypoint.

## Core Flows

### Repository Ingest

1. `POST /api/projects/ingest`
2. Service validates URL + creates graph snapshot record.
3. Job queued to `ingest-repo`.
4. Worker clones repository and builds graph output.
5. Graph is saved to Postgres with status updates.

### Node Explanation

1. `POST /api/projects/:id/nodes/:nodekey/explain`
2. Service queues `explain-node` and persists queued state.
3. Worker loads graph context and generates explanation.
4. Explanation transitions: `queued -> running -> ready|failed`.

## Data Model

Defined in `src/server/schema.sql`:

- `projects`
- `graphs`
- `graph_nodes`
- `graph_edges`
- `node_explanations`

## Scripts

- `pnpm dev`: run app dev server
- `pnpm build`: production app build
- `pnpm start`: run production app
- `pnpm lint`: ESLint checks
- `pnpm test`: Vitest suite
- `pnpm build:worker`: compile worker
- `pnpm worker`: compile + run worker
- `pnpm worker:env`: run worker using `.env.local`
- `pnpm docs:dev`: run docs on port `3001`
- `pnpm docs:build`: build docs
- `pnpm docs:preview`: preview built docs
- `pnpm docs:guard`: enforce docs updates for API/schema/workflow changes
- `pnpm docs:guard:staged`: same check for staged files

## Docs Enforcement Policy

`docs-guard` requires docs updates in the same PR/commit when these areas change:

- API (`src/app/api/`, `src/lib/api/`) -> update `docs/api.md` or `docs/changelog.md`
- Schema/contracts (`src/server/schema.sql`, `scripts_db_init.sql`, `src/server/graph-schema.ts`, `src/lib/projects-types.ts`) -> update `docs/schema.md` or `docs/changelog.md`
- Workflow (`src/server/worker.ts`, `src/server/jobs/`, `src/server/services/`, `src/server/ingest.ts`, `src/server/boss.ts`) -> update `docs/workers.md` or `docs/changelog.md`

CI workflow: `.github/workflows/docs-guard.yml`

## Troubleshooting

### Jobs stay queued

- Confirm worker is running: `pnpm worker`
- Confirm queue names match: `ingest-repo`, `explain-node`

### Graph quality seems off

- Tune prompts in `src/server/analysis/openai.ts`
- Tune post-processing in `src/server/analysis/graph-postprocess.ts`

### Next.js build artifacts cause weird runtime errors

```bash
rm -rf .next-dev .next
pnpm dev
```
