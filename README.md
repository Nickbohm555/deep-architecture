# Deep Architecture

> Map runtime behavior, not just file trees.
> Build a living graph of triggers, data movement, and system boundaries.

---

## System Snapshot

| Layer | Tech |
|---|---|
| Web App | Next.js 14, React 18, React Flow |
| Data | Postgres |
| Jobs | pg-boss |
| Analysis | OpenAI API |
| Docs | VitePress |

---

## Fast Launch

```bash
# 1) start database
docker compose up -d

# 2) install dependencies
pnpm install

# 3) run worker (required for ingest + explanation jobs)
pnpm worker

# 4) run web app
pnpm dev

# 5) optional: run docs site on a separate port
pnpm docs:dev
```

Endpoints:

- App: `http://localhost:3000`
- Docs: `http://localhost:3001`

---

## Mission Profile

- Ingest a GitHub repository.
- Generate an architecture graph focused on real execution flow.
- Navigate nodes/edges in an interactive layered canvas.
- Ask AI for node-level explanation and persist reviewed edits.

---

## Runtime Architecture

### Frontend Surface

- `src/app/page.tsx`: workspace orchestration.
- `src/components/home/*`: dashboard panels and graph UI.
- `src/lib/api/projects.ts`: typed browser API client.
- `src/lib/graph-view.ts`: graph projection + layout logic.

### Backend Core

- `src/app/api/*`: HTTP routes only.
- `src/server/services/*`: orchestration + business validation.
- `src/server/persistence/*`: SQL and repository layer.
- `src/server/jobs/*`: async worker handlers.
- `src/server/analysis/*`: prompt + graph processing.
- `src/server/worker.ts`: queue worker bootstrapping.

---

## Core Pipelines

### Ingest Pipeline

1. `POST /api/projects/ingest`
2. Service validates repo URL and creates queued graph snapshot.
3. Job published to `ingest-repo`.
4. Worker clones repo, extracts context, generates graph output.
5. Graph snapshot stored in Postgres (`queued -> running -> ready|failed`).

### Node Explain Pipeline

1. `POST /api/projects/:id/nodes/:nodekey/explain`
2. Service queues explanation job (`explain-node`).
3. Worker assembles node context and requests explanation.
4. Status lifecycle: `queued -> running -> ready|failed`.

---

## Data Plane

Schema source: `src/server/schema.sql`

Primary tables:

- `projects`
- `graphs`
- `graph_nodes`
- `graph_edges`
- `node_explanations`

---

## Env Contract

Required variables:

- `DATABASE_URL` (example: `postgres://deep_arch:deep_arch@localhost:5432/deep_arch`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)

Optional local env execution:

```bash
pnpm worker:env
```

---

## Command Deck

- `pnpm dev` - start app dev server
- `pnpm build` - build app
- `pnpm start` - run production app
- `pnpm lint` - run ESLint
- `pnpm test` - run Vitest
- `pnpm build:worker` - compile worker
- `pnpm worker` - compile + run worker
- `pnpm worker:env` - run worker with `.env.local`
- `pnpm docs:dev` - run docs on port `3001`
- `pnpm docs:build` - build docs
- `pnpm docs:preview` - preview docs build
- `pnpm docs:guard` - enforce docs updates on API/schema/workflow changes
- `pnpm docs:guard:staged` - same guard for staged files

---

## Docs Sync Protocol

Guard workflow: `.github/workflows/docs-guard.yml`

When code changes in these areas, docs must be updated in the same PR/commit:

- API (`src/app/api/`, `src/lib/api/`) -> update `docs/api.md` or `docs/changelog.md`
- Schema/contracts (`src/server/schema.sql`, `scripts_db_init.sql`, `src/server/graph-schema.ts`, `src/lib/projects-types.ts`) -> update `docs/schema.md` or `docs/changelog.md`
- Workflow (`src/server/worker.ts`, `src/server/jobs/`, `src/server/services/`, `src/server/ingest.ts`, `src/server/boss.ts`) -> update `docs/workers.md` or `docs/changelog.md`

---

## Troubleshooting

### Jobs remain queued

- Ensure worker is running: `pnpm worker`
- Ensure queue names match: `ingest-repo`, `explain-node`

### Graph output quality is weak

- Tune prompt logic in `src/server/analysis/openai.ts`
- Tune post-processing in `src/server/analysis/graph-postprocess.ts`

### Next.js build artifact issues

```bash
rm -rf .next-dev .next
pnpm dev
```
