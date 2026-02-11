# Changelog

## 2026-02-11

- Added VitePress live docs scaffolding on port `3001`.
- Added docs guard automation for API/schema/workflow changes.
- Refactored API routes to use shared JSON body parsing and error response helpers.
- Kept API contracts unchanged while reducing route-level duplication.
- Aligned API route helper imports for Vitest compatibility without changing runtime behavior.
