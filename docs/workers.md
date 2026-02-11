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
4. Worker clones repo, collects context, generates graph, node internals, and repo chunks for retrieval.
5. Persistence saves graph + internals + chunks in one transaction and marks status.

## Explain workflow

1. `POST /api/projects/:id/nodes/:nodekey/explain`
2. Service gets latest graph and queues `explain-node`.
3. Worker gathers graph context, runs RAG retrieval from `repo_chunks`, then calls LLM with graph + retrieved evidence.
4. Worker falls back to non-RAG explanation if retrieval/agent steps fail.
5. Explanation status moves queued -> running -> ready/failed and stores retrieval context/citations.

## RAG explain internals

- Retrieval source table: `repo_chunks` (indexed during ingest).
- Retrieval mode: hybrid full-text + node-hinted bias.
- RAG orchestration: `src/server/services/rag-agent-service.ts`.
- Worker usage: `src/server/jobs/node-explanation-worker.ts`.
- Saved context: `node_explanations.context` includes retrieval query and citations.
