import type { PoolClient } from "pg";
import { pool } from "../db";
import type { NodeArchitectureDetail } from "../analysis/node-details";

type Queryable = Pick<PoolClient, "query">;

export type GraphNodeDetailInput = {
  nodeKey: string;
  status?: "ready" | "fallback" | "failed";
  details: NodeArchitectureDetail;
  error?: string | null;
};

export type GraphNodeDetailRow = {
  node_key: string;
  status: string;
  details: NodeArchitectureDetail;
  error: string | null;
  updated_at: string;
};

let schemaReadyPromise: Promise<void> | null = null;

async function ensureGraphNodeDetailsSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS graph_node_details (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
          node_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ready',
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      );

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS graph_node_details_graph_node_idx
         ON graph_node_details(graph_id, node_key)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS graph_node_details_graph_idx
         ON graph_node_details(graph_id)`
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

export async function getGraphNodeDetails(graphId: string) {
  await ensureGraphNodeDetailsSchema();
  const { rows } = await pool.query<GraphNodeDetailRow>(
    `SELECT node_key, status, details, error, updated_at
     FROM graph_node_details
     WHERE graph_id = $1`,
    [graphId]
  );

  return rows;
}

export async function saveGraphNodeDetailsWithClient(
  client: Queryable,
  graphId: string,
  details: GraphNodeDetailInput[]
) {
  await ensureGraphNodeDetailsSchema();
  await client.query("DELETE FROM graph_node_details WHERE graph_id = $1", [graphId]);

  if (details.length === 0) {
    return;
  }

  const values = details.flatMap((item) => [
    graphId,
    item.nodeKey,
    item.status ?? "ready",
    JSON.stringify(item.details),
    item.error ?? null
  ]);

  const placeholders = details
    .map((_, index) => {
      const base = index * 5;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, $${base + 5})`;
    })
    .join(", ");

  await client.query(
    `INSERT INTO graph_node_details (graph_id, node_key, status, details, error)
     VALUES ${placeholders}`,
    values
  );
}
