# Deep Architecture

Local-first architecture flow explorer for understanding how data and triggers move through a codebase.

## What this system does

- Ingests a GitHub repository.
- Builds a graph of architecture nodes and edges (focused on data flow and trigger paths).
- Renders a layered interactive graph (top-down) with search and visibility controls.
- Lets the user ask AI for deeper explanation of a specific node and persist the response.

## Design goals

- Preserve a clear separation of concerns across API, service, persistence, jobs, and analysis.
- Keep UI behavior responsive with async workflows.
- Make ingestion and explanation jobs retry-safe and observable through DB status fields.
- Prioritize understandable data-flow maps over purely feature-based grouping.

## Non-goals (current scope)

- Multi-user access control and tenant isolation.
- Real-time collaboration.
- Guaranteed semantic correctness of LLM output without human review.

## Architecture overview

### Frontend

- `src/app/page.tsx`
  - Composes top-level state and connects hooks/components.
- `src/components/home/*`
  - Focused UI panels:
    - top bar
    - ingest controls
    - graph canvas
    - snapshots list
    - inspector/explanation panel
- `src/lib/hooks/*`
  - Focused hook modules (`projects`, `graph`, `node explanation`).
- `src/lib/api/projects.ts`
  - Typed API client for route calls.
- `src/lib/graph-view.ts`
  - Builds layered graph view and visibility behavior.

### Backend

- `src/app/api/projects/*`
  - HTTP contracts only (request/response mapping and error mapping).
- `src/server/services/*`
  - Use-case orchestration and validation.
- `src/server/persistence/*`
  - SQL and transaction boundaries.
- `src/server/jobs/*`
  - Background job orchestration.
- `src/server/analysis/*`
  - LLM prompt/response processing and graph post-processing.
- `src/server/worker.ts`
  - Registers queue workers and dispatches jobs.
- `src/server/queues.ts`
  - Central queue names to avoid string drift.
- `src/server/errors.ts`
  - Typed app errors mapped to HTTP statuses.

## Data flow by feature

### 1) Repository ingest flow

1. User submits GitHub URL from UI ingest panel.
2. API route `POST /api/projects/ingest` calls `enqueueIngest`.
3. Service creates/updates project, creates queued graph row, sets project latest graph, enqueues `ingest-repo`.
4. Worker consumes `ingest-repo`.
5. Job clones repo, samples repository context, asks LLM for architecture graph, post-processes graph.
6. Persistence saves graph summary/nodes/edges and marks graph ready (or failed on error).
7. UI polls project detail and updates graph display.

### 2) Node explanation flow (Ask AI)

1. User selects a node and submits a question.
2. API route `POST /api/projects/[id]/nodes/[nodekey]/explain` calls explanation service.
3. Service enqueues `explain-node` and upserts queued explanation record.
4. Worker consumes `explain-node`, fetches graph context, asks LLM for a targeted explanation.
5. Persistence stores explanation and updates status.
6. UI polls explanation endpoint until status is `ready` or `failed`.

## Data model summary

Main tables in `src/server/schema.sql`:

- `projects`
  - Canonical repository entries and `latest_graph_id`.
- `graphs`
  - Snapshot of an analysis run (`queued | running | ready | failed`) plus summary/metadata/error.
- `graph_nodes`
  - Node records keyed by `(graph_id, node_key)`.
- `graph_edges`
  - Directed edges between node keys for a graph snapshot.
- `node_explanations`
  - Async explanation records keyed by `(graph_id, node_key)` with status lifecycle.

## Key design choices and tradeoffs

### Layered architecture with strict boundaries

- Choice:
  - Keep routes thin and move behavior to service/persistence/job layers.
- Benefit:
  - Easier testing, lower coupling, clearer ownership of logic.
- Tradeoff:
  - More files and indirection, but far better maintainability.

### Async queues for heavy work

- Choice:
  - `pg-boss` for ingest and node explanation jobs.
- Benefit:
  - UI stays fast; job retries and durable state are possible.
- Tradeoff:
  - Requires worker process availability. If worker is down, status remains queued.

### Store latest graph pointer on project

- Choice:
  - `projects.latest_graph_id` points to current graph for UI reads.
- Benefit:
  - Fast reads and simple API surface.
- Tradeoff:
  - Historical graph browsing needs explicit route/query support.

### Transactional graph writes

- Choice:
  - Save summary/status/nodes/edges in one transaction and replace edge set for graph snapshot.
- Benefit:
  - Avoid partial graph states on failures.
- Tradeoff:
  - Replace strategy is simple and deterministic but can be heavier than per-edge diff updates.

### LLM-first architecture extraction with post-processing

- Choice:
  - Use prompt + schema validation + post-processing sanitization.
- Benefit:
  - Flexible extraction for varied repositories.
- Tradeoff:
  - Output quality depends on prompt and sampled repository context; still probabilistic.

## Error handling strategy

- Domain errors use `AppError` subclasses (validation/not found) in services.
- API routes map errors via `getHttpError`.
- Job failures write status + error text to DB (`graphs.error`, `node_explanations.error`).

## Testing strategy

Current test seams:

- Service behavior:
  - `src/server/services/projects-service.test.ts`
  - `src/server/services/node-explanations-service.test.ts`
- Utility validation:
  - `src/server/services/projects-service.utils.test.ts`
- Persistence behavior:
  - `src/server/persistence/graph-repo.test.ts`
- Analysis post-processing:
  - `src/server/analysis/graph-postprocess.test.ts`
- Graph view shaping:
  - `src/lib/graph-view.test.ts`

Run tests:

```bash
pnpm test
```

## Local setup

1. Start Postgres:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
pnpm install
```

3. Build and run worker:

```bash
pnpm worker
```

4. Run app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Required environment variables

Set these in your shell (do not edit `.env` files managed by someone else):

- `DATABASE_URL` (example: `postgres://deep_arch:deep_arch@localhost:5432/deep_arch`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)

Optional local setup:

```bash
pnpm worker:env
```

## Troubleshooting

### Jobs stuck in `queued`

- Confirm worker is running (`pnpm worker`).
- Confirm queue names are present and match:
  - `ingest-repo`
  - `explain-node`
- Check DB status in `graphs` and `node_explanations`.

### No edges or odd node labels

- Likely caused by model output quality for the sampled repository context.
- Tune prompts in `src/server/analysis/openai.ts`.
- Tune post-processing in `src/server/analysis/graph-postprocess.ts`.

### Next.js runtime module errors (for example missing chunk in `.next`)

- Stop dev server.
- Remove build artifacts and restart:
  - `rm -rf .next-dev .next`
  - `pnpm dev`

## Scripts

- `pnpm dev` - run Next.js dev server
- `pnpm build` - production app build
- `pnpm lint` - ESLint checks
- `pnpm test` - Vitest suite
- `pnpm build:worker` - compile worker TS entry
- `pnpm worker` - compile + run worker
- `pnpm worker:env` - run worker using `.env.local`

## Current limitations and next improvements

- Single-user assumptions still exist in data access patterns.
- Graph quality can improve with domain-specific prompts and larger context windows.
- Historical graph comparison exists in schema but is not fully surfaced in UI.
- No auth/permissions layer yet.
