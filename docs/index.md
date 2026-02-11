# Deep Architecture Docs

Live documentation for the `deep-architecture` repo.

## Run docs site

```bash
pnpm docs:dev
```

Docs run on `http://localhost:3001` while the app runs on `http://localhost:3000`.

## Docs policy

When these areas change, update matching docs in the same PR/commit:

- API code: update `docs/api.md`
- Schema/contracts: update `docs/schema.md`
- Worker/service flow: update `docs/workers.md`
- Also add an entry to `docs/changelog.md`

Automated check:

```bash
pnpm docs:guard
```
