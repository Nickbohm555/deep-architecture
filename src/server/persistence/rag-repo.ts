import { pool } from "../db";

export type RagChunkInput = {
  projectId: string;
  graphId: string;
  path: string;
  symbol: string | null;
  kind: string;
  startLine: number;
  endLine: number;
  content: string;
  metadata: Record<string, unknown>;
  contentHash: string;
  embedding: number[];
};

export type RagChunkMatch = {
  id: string;
  path: string;
  symbol: string | null;
  kind: string;
  start_line: number;
  end_line: number;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
};

let schemaReadyPromise: Promise<void> | null = null;

async function ensureRagSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

      await pool.query(
        `CREATE TABLE IF NOT EXISTS rag_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
          path TEXT NOT NULL,
          symbol TEXT,
          kind TEXT NOT NULL,
          start_line INT NOT NULL,
          end_line INT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          content_hash TEXT NOT NULL,
          embedding vector(3072) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      );

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS rag_chunks_graph_hash_idx
         ON rag_chunks(graph_id, content_hash)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS rag_chunks_graph_idx
         ON rag_chunks(graph_id)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS rag_chunks_path_idx
         ON rag_chunks(graph_id, path)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS rag_chunks_content_tsv_idx
         ON rag_chunks USING GIN (to_tsvector('english', content))`
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function replaceGraphRagChunks(graphId: string, chunks: RagChunkInput[]) {
  await ensureRagSchema();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM rag_chunks WHERE graph_id = $1", [graphId]);

    const batchSize = 20;
    for (let index = 0; index < chunks.length; index += batchSize) {
      const batch = chunks.slice(index, index + batchSize);
      const values = batch.flatMap((chunk) => [
        chunk.projectId,
        chunk.graphId,
        chunk.path,
        chunk.symbol,
        chunk.kind,
        chunk.startLine,
        chunk.endLine,
        chunk.content,
        JSON.stringify(chunk.metadata),
        chunk.contentHash,
        toVectorLiteral(chunk.embedding)
      ]);

      const placeholders = batch
        .map((_, batchIndex) => {
          const base = batchIndex * 11;
          return `(
            $${base + 1},
            $${base + 2},
            $${base + 3},
            $${base + 4},
            $${base + 5},
            $${base + 6},
            $${base + 7},
            $${base + 8},
            $${base + 9}::jsonb,
            $${base + 10},
            $${base + 11}::vector
          )`;
        })
        .join(", ");

      await client.query(
        `INSERT INTO rag_chunks (
          project_id,
          graph_id,
          path,
          symbol,
          kind,
          start_line,
          end_line,
          content,
          metadata,
          content_hash,
          embedding
        ) VALUES ${placeholders}`,
        values
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function searchRagChunksSemantic(input: {
  graphId: string;
  queryEmbedding: number[];
  limit: number;
}) {
  await ensureRagSchema();

  const vector = toVectorLiteral(input.queryEmbedding);
  const { rows } = await pool.query<RagChunkMatch>(
    `SELECT id, path, symbol, kind, start_line, end_line, content, metadata,
            1 - (embedding <=> $2::vector) AS score
     FROM rag_chunks
     WHERE graph_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [input.graphId, vector, input.limit]
  );

  return rows;
}

export async function searchRagChunksKeyword(input: {
  graphId: string;
  query: string;
  limit: number;
}) {
  await ensureRagSchema();

  const { rows } = await pool.query<RagChunkMatch>(
    `SELECT id, path, symbol, kind, start_line, end_line, content, metadata,
            ts_rank_cd(to_tsvector('english', content), websearch_to_tsquery('english', $2)) AS score
     FROM rag_chunks
     WHERE graph_id = $1
       AND to_tsvector('english', content) @@ websearch_to_tsquery('english', $2)
     ORDER BY score DESC
     LIMIT $3`,
    [input.graphId, input.query, input.limit]
  );

  return rows;
}

export async function searchRagChunksByPaths(input: {
  graphId: string;
  paths: string[];
  limit: number;
}) {
  await ensureRagSchema();

  if (input.paths.length === 0) {
    return [] as RagChunkMatch[];
  }

  const { rows } = await pool.query<RagChunkMatch>(
    `SELECT id, path, symbol, kind, start_line, end_line, content, metadata,
            1.0 AS score
     FROM rag_chunks
     WHERE graph_id = $1
       AND path = ANY($2)
     ORDER BY path, start_line ASC
     LIMIT $3`,
    [input.graphId, input.paths, input.limit]
  );

  return rows;
}
