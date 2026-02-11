# API Reference

## Projects

- `GET /api/projects`
  - Lists projects and latest graph status.
- `POST /api/projects/ingest`
  - Body: `{ repoUrl: string }`
  - Enqueues repo ingestion.

## Project detail

- `GET /api/projects/:id`
  - Returns project details with graph nodes/edges.

## Node explanation

- `POST /api/projects/:id/nodes/:nodekey/explain`
  - Body: `{ question?: string }`
  - Enqueues explanation job.
- `GET /api/projects/:id/nodes/:nodekey/explanation`
  - Reads latest explanation state.
- `PUT /api/projects/:id/nodes/:nodekey/explanation`
  - Body: `{ explanation: string }`
  - Saves edited explanation text.
