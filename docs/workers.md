# Workers And Workflows

## Queues

- `ingest-repo`
- `explain-node`

## Worker entrypoint

- `src/server/worker.ts`

## Ingest workflow

1. `POST /api/projects/ingest`
2. Service validates URL and creates graph row.
3. Queue job `ingest-repo`.
4. Worker clones repo, collects context, generates graph.
5. Persistence saves graph and marks status.

## Explain workflow

1. `POST /api/projects/:id/nodes/:nodekey/explain`
2. Service gets latest graph and queues `explain-node`.
3. Worker gathers graph context and calls LLM.
4. Explanation status moves queued -> running -> ready/failed.
