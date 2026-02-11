# Deep Architecture

Local-first architecture flow explorer.

## Getting started

1. Start Postgres:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
pnpm install
```

3. Run the worker (repo ingest + analysis):

```bash
pnpm worker
```

4. Run the app:

```bash
pnpm dev
```

Open http://localhost:3000

## Required env vars

Set these in your shell (do not edit `.env`):

- `DATABASE_URL` (example: `postgres://deep_arch:deep_arch@localhost:5432/deep_arch`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-4.1-mini`)

If you prefer to use a local env file, create `.env.local` yourself and run:

```bash
pnpm worker:env
```

Example `.env.local` contents (create this file manually):

```
DATABASE_URL=postgres://deep_arch:deep_arch@localhost:5432/deep_arch
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

## Notes

- This project uses Next.js App Router.
- React Flow renders interactive graphs in the UI.
- Postgres is provisioned via Docker Compose and auto-loads `scripts_db_init.sql`.
