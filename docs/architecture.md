# Architecture

## Layer boundaries

- App/UI: `src/app/*`, `src/components/*`, `src/lib/*`
- API routes: `src/app/api/*`
- Services: `src/server/services/*`
- Persistence: `src/server/persistence/*`
- Worker runtime: `src/server/worker.ts`, `src/server/jobs/*`

## Data flow

1. User ingests a repo from UI.
2. API enqueues `ingest-repo`.
3. Worker clones repo and generates graph via OpenAI.
4. Graph is stored in Postgres.
5. UI loads graph nodes/edges and explanation state.
