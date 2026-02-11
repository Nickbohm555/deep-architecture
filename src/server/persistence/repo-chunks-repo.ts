import type { PoolClient } from "pg";
import { pool } from "../db";
import type { RepoChunk } from "../ingest";

type Queryable = Pick<PoolClient, "query">;

export type RepoChunkRow = {
  path: string;
  chunk_index: number;
  language: string | null;
  content: string;
  score: number;
};

let schemaReadyPromise: Promise<void> | null = null;

async function ensureRepoChunksSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS repo_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
          path TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          language TEXT,
          content TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      );

      await pool.query(`CREATE INDEX IF NOT EXISTS repo_chunks_graph_idx ON repo_chunks(graph_id)`);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS repo_chunks_project_graph_idx ON repo_chunks(project_id, graph_id)`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS repo_chunks_tsv_idx
         ON repo_chunks
         USING GIN (to_tsvector('english', content))`
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

function buildPlaceholders(rowCount: number, width: number) {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const base = rowIndex * width;
    const values = Array.from({ length: width }, (_, colIndex) => `$${base + colIndex + 1}`);
    return `(${values.join(", ")})`;
  }).join(",");
}

export async function saveRepoChunksWithClient(
  client: Queryable,
  input: {
    projectId: string;
    graphId: string;
    chunks: RepoChunk[];
  }
) {
  await ensureRepoChunksSchema();
  await client.query("DELETE FROM repo_chunks WHERE graph_id = $1", [input.graphId]);

  if (input.chunks.length === 0) {
    return;
  }

  const values = input.chunks.flatMap((chunk) => [
    input.projectId,
    input.graphId,
    chunk.path,
    chunk.chunkIndex,
    chunk.language,
    chunk.content
  ]);

  await client.query(
    `INSERT INTO repo_chunks (project_id, graph_id, path, chunk_index, language, content)
     VALUES ${buildPlaceholders(input.chunks.length, 6)}`,
    values
  );
}

export async function searchRepoChunks(input: {
  projectId: string;
  graphId: string;
  query: string;
  nodeKey?: string;
  limit?: number;
}) {
  await ensureRepoChunksSchema();

  const q = input.query.trim();
  const limit = Math.max(1, Math.min(input.limit ?? 8, 20));
  const nodeHint = (input.nodeKey ?? "").trim().replace(/:/g, " ");

  if (!q && !nodeHint) {
    return [] as RepoChunkRow[];
  }

  const queryText = q || nodeHint;
  const queryLike = `%${queryText}%`;
  const nodeLike = `%${nodeHint}%`;

  const { rows } = await pool.query<RepoChunkRow>(
    `SELECT
       path,
       chunk_index,
       language,
       content,
       (
         COALESCE(ts_rank_cd(
           to_tsvector('english', content),
           plainto_tsquery('english', $3)
         ), 0)
         +
         CASE
           WHEN $4 <> '' AND (path ILIKE $5 OR content ILIKE $5) THEN 0.35
           ELSE 0
         END
       ) AS score
     FROM repo_chunks
     WHERE project_id = $1
       AND graph_id = $2
       AND (
         to_tsvector('english', content) @@ plainto_tsquery('english', $3)
         OR content ILIKE $6
         OR ($4 <> '' AND (path ILIKE $5 OR content ILIKE $5))
       )
     ORDER BY score DESC, chunk_index ASC
     LIMIT $7`,
    [input.projectId, input.graphId, queryText, nodeHint, nodeLike, queryLike, limit]
  );

  return rows;
}
