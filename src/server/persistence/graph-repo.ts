import type { PoolClient } from "pg";
import { pool } from "../db";
import type { GraphOutput } from "../graph-schema";
import type { RepoChunk } from "../ingest";
import {
  saveGraphNodeDetailsWithClient,
  type GraphNodeDetailInput
} from "./graph-node-details-repo";
import { saveRepoChunksWithClient } from "./repo-chunks-repo";

type QueryClient = Pick<PoolClient, "query">;

function buildPlaceholders(rowCount: number, width: number) {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const base = rowIndex * width;
    const values = Array.from({ length: width }, (_, colIndex) => `$${base + colIndex + 1}`);
    return `(${values.join(", ")})`;
  }).join(",");
}

export async function updateGraphStatus(graphId: string, status: string, error?: string) {
  await pool.query(
    "UPDATE graphs SET status = $1, error = $2, updated_at = now() WHERE id = $3",
    [status, error ?? null, graphId]
  );
}

export async function saveGraphOutputWithClient(
  client: QueryClient,
  projectId: string,
  graphId: string,
  output: GraphOutput,
  nodeDetails: GraphNodeDetailInput[] = [],
  repoChunks: RepoChunk[] = []
) {
  await client.query(
    "UPDATE graphs SET status = $1, summary = $2, updated_at = now(), metadata = metadata || $3 WHERE id = $4",
    ["ready", output.summary, JSON.stringify({ output }), graphId]
  );

  const nodeValues = output.nodes.map((node) => [
    graphId,
    node.key,
    node.kind,
    node.label,
    node.data
  ]);

  if (nodeValues.length > 0) {
    await client.query(
      `INSERT INTO graph_nodes (graph_id, node_key, kind, label, data)
       VALUES ${buildPlaceholders(nodeValues.length, 5)}
       ON CONFLICT (graph_id, node_key) DO UPDATE SET
         kind = EXCLUDED.kind,
         label = EXCLUDED.label,
         data = EXCLUDED.data`,
      nodeValues.flat()
    );
  }

  await client.query("DELETE FROM graph_edges WHERE graph_id = $1", [graphId]);

  const edgeValues = output.edges.map((edge) => [
    graphId,
    edge.source,
    edge.target,
    edge.kind,
    edge.label ?? null,
    edge.data ?? {}
  ]);

  if (edgeValues.length > 0) {
    await client.query(
      `INSERT INTO graph_edges (graph_id, source_key, target_key, kind, label, data)
       VALUES ${buildPlaceholders(edgeValues.length, 6)}`,
      edgeValues.flat()
    );
  }

  await saveGraphNodeDetailsWithClient(client, graphId, nodeDetails);
  await saveRepoChunksWithClient(client, { projectId, graphId, chunks: repoChunks });
}

export async function saveGraphOutput(
  projectId: string,
  graphId: string,
  output: GraphOutput,
  nodeDetails: GraphNodeDetailInput[] = [],
  repoChunks: RepoChunk[] = []
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await saveGraphOutputWithClient(client, projectId, graphId, output, nodeDetails, repoChunks);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProjectLatestGraph(projectId: string, graphId: string) {
  await pool.query("UPDATE projects SET latest_graph_id = $1 WHERE id = $2", [graphId, projectId]);
}
