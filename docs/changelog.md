# Changelog

## 2026-02-11

- Added VitePress live docs scaffolding on port `3001`.
- Added docs guard automation for API/schema/workflow changes.
- Refactored API routes to use shared JSON body parsing and error response helpers.
- Kept API contracts unchanged while reducing route-level duplication.
- Aligned API route helper imports for Vitest compatibility without changing runtime behavior.
- Added structured `graph_node_details` persistence populated during ingest for per-node architecture internals.
- Added inspector "Node Internals" tab with structured flow/functions/classes/dependency pointers for selected nodes.
- Updated graph click behavior to select nodes without collapsing/changing graph view.
- Added RAG-backed Ask AI pipeline: repo chunk indexing at ingest, retrieval during node explanation, and persisted citation context.
- Refactored RAG service/worker flow for clearer stages, helper boundaries, and improved citation dedupe behavior.
