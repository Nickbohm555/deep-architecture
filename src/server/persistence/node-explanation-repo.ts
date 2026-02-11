import { pool } from "../db";

export type ExplanationStatus = "queued" | "running" | "ready" | "failed";

export type NodeExplanationRecord = {
  project_id: string;
  graph_id: string;
  node_key: string;
  status: ExplanationStatus;
  question: string | null;
  explanation: string | null;
  error: string | null;
  context: Record<string, unknown>;
  job_id: string | null;
  created_at: string;
  updated_at: string;
};

let schemaReadyPromise: Promise<void> | null = null;

async function ensureNodeExplanationSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS node_explanations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          graph_id UUID NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
          node_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          question TEXT,
          explanation TEXT,
          error TEXT,
          context JSONB NOT NULL DEFAULT '{}'::jsonb,
          job_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      );

      await pool.query(
        `ALTER TABLE node_explanations
         ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb`
      );

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS node_explanations_graph_node_idx
         ON node_explanations(graph_id, node_key)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS node_explanations_project_node_idx
         ON node_explanations(project_id, node_key)`
      );
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

export async function getNodeExplanation(projectId: string, nodeKey: string) {
  await ensureNodeExplanationSchema();
  const { rows } = await pool.query<NodeExplanationRecord>(
    `SELECT ne.project_id, ne.graph_id, ne.node_key, ne.status, ne.question,
            ne.explanation, ne.error, ne.context, ne.job_id, ne.created_at, ne.updated_at
     FROM node_explanations ne
     JOIN projects p ON p.latest_graph_id = ne.graph_id
     WHERE p.id = $1 AND ne.node_key = $2`,
    [projectId, nodeKey]
  );

  return rows[0] ?? null;
}

export async function queueNodeExplanation(input: {
  projectId: string;
  graphId: string;
  nodeKey: string;
  question: string;
  jobId: string | null;
}) {
  await ensureNodeExplanationSchema();
  const { projectId, graphId, nodeKey, question, jobId } = input;

  await pool.query(
    `INSERT INTO node_explanations (
      project_id, graph_id, node_key, status, question, explanation, error, job_id
    ) VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)
    ON CONFLICT (graph_id, node_key)
    DO UPDATE SET
      status = EXCLUDED.status,
      question = EXCLUDED.question,
      error = NULL,
      job_id = EXCLUDED.job_id,
      updated_at = now()`,
    [projectId, graphId, nodeKey, "queued", question, jobId]
  );
}

export async function updateNodeExplanationStatus(input: {
  graphId: string;
  nodeKey: string;
  status: ExplanationStatus;
  error?: string | null;
}) {
  await ensureNodeExplanationSchema();
  const { graphId, nodeKey, status, error } = input;
  await pool.query(
    `UPDATE node_explanations
     SET status = $1, error = $2, updated_at = now()
     WHERE graph_id = $3 AND node_key = $4`,
    [status, error ?? null, graphId, nodeKey]
  );
}

export async function saveNodeExplanationText(input: {
  graphId: string;
  nodeKey: string;
  explanation: string;
  context?: Record<string, unknown> | null;
}) {
  await ensureNodeExplanationSchema();
  const { graphId, nodeKey, explanation, context } = input;
  await pool.query(
    `UPDATE node_explanations
     SET status = 'ready', explanation = $1, error = NULL, context = $2, updated_at = now()
     WHERE graph_id = $3 AND node_key = $4`,
    [explanation, JSON.stringify(context ?? {}), graphId, nodeKey]
  );
}

export async function upsertNodeExplanationTextByProject(input: {
  projectId: string;
  nodeKey: string;
  explanation: string;
}) {
  await ensureNodeExplanationSchema();
  const { projectId, nodeKey, explanation } = input;

  await pool.query(
    `INSERT INTO node_explanations (
      project_id, graph_id, node_key, status, question, explanation, error, job_id
    )
    SELECT p.id, p.latest_graph_id, $2, 'ready', COALESCE(ne.question, NULL), $3, NULL, NULL
    FROM projects p
    LEFT JOIN node_explanations ne
      ON ne.graph_id = p.latest_graph_id AND ne.node_key = $2
    WHERE p.id = $1 AND p.latest_graph_id IS NOT NULL
    ON CONFLICT (graph_id, node_key)
    DO UPDATE SET
      status = 'ready',
      explanation = EXCLUDED.explanation,
      error = NULL,
      updated_at = now()`,
    [projectId, nodeKey, explanation]
  );
}

export async function getLatestGraphId(projectId: string) {
  const { rows } = await pool.query<{ latest_graph_id: string | null }>(
    "SELECT latest_graph_id FROM projects WHERE id = $1",
    [projectId]
  );

  return rows[0]?.latest_graph_id ?? null;
}

export async function getGraphContext(graphId: string) {
  const [graphRes, nodesRes, edgesRes] = await Promise.all([
    pool.query<{ project_id: string; summary: string | null }>(
      "SELECT project_id, summary FROM graphs WHERE id = $1",
      [graphId]
    ),
    pool.query<{
      node_key: string;
      kind: string;
      label: string;
      data: Record<string, unknown>;
    }>(
      "SELECT node_key, kind, label, data FROM graph_nodes WHERE graph_id = $1",
      [graphId]
    ),
    pool.query<{
      source_key: string;
      target_key: string;
      kind: string;
      label: string | null;
      data: Record<string, unknown> | null;
    }>(
      "SELECT source_key, target_key, kind, label, data FROM graph_edges WHERE graph_id = $1",
      [graphId]
    )
  ]);

  return {
    projectId: graphRes.rows[0]?.project_id ?? "",
    summary: graphRes.rows[0]?.summary ?? null,
    nodes: nodesRes.rows,
    edges: edgesRes.rows
  };
}
