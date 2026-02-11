import type { PoolClient, QueryResult } from "pg";
import { pool } from "../db";

type Queryable = Pick<PoolClient, "query">;

type ProjectRow = {
  id: string;
  name: string;
  repo_url: string;
  created_at: string;
  graph_id: string | null;
  status: string | null;
  summary: string | null;
  metadata?: Record<string, unknown> | null;
  graph_created_at: string | null;
};

type GraphNodeRow = {
  node_key: string;
  kind: string;
  label: string;
  data: Record<string, unknown>;
};

type GraphEdgeRow = {
  source_key: string;
  target_key: string;
  kind: string;
  label: string | null;
  data: Record<string, unknown> | null;
};

export async function listProjectsWithLatestGraph() {
  const { rows } = await pool.query<ProjectRow>(
    `SELECT p.id, p.name, p.repo_url, p.created_at,
            g.id AS graph_id, g.status, g.summary, g.created_at AS graph_created_at
     FROM projects p
     LEFT JOIN graphs g ON g.id = p.latest_graph_id
     ORDER BY p.created_at DESC`
  );

  return rows;
}

export async function getProjectByIdWithLatestGraph(projectId: string) {
  const result = await pool.query<ProjectRow>(
    `SELECT p.id, p.name, p.repo_url, p.created_at,
            g.id AS graph_id, g.status, g.summary, g.metadata, g.created_at AS graph_created_at
     FROM projects p
     LEFT JOIN graphs g ON g.id = p.latest_graph_id
     WHERE p.id = $1`,
    [projectId]
  );

  return result.rows[0] ?? null;
}

export async function getGraphNodes(graphId: string) {
  const result = await pool.query<GraphNodeRow>(
    `SELECT node_key, kind, label, data
     FROM graph_nodes
     WHERE graph_id = $1`,
    [graphId]
  );

  return result.rows;
}

export async function getGraphEdges(graphId: string) {
  const result = await pool.query<GraphEdgeRow>(
    `SELECT source_key, target_key, kind, label, data
     FROM graph_edges
     WHERE graph_id = $1`,
    [graphId]
  );

  return result.rows;
}

export async function upsertProjectByRepoUrl(
  client: Queryable,
  name: string,
  repoUrl: string
) {
  const result: QueryResult<{ id: string }> = await client.query(
    `INSERT INTO projects (name, repo_url)
     VALUES ($1, $2)
     ON CONFLICT (repo_url) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, repoUrl]
  );

  return result.rows[0].id;
}

export async function createGraph(client: Queryable, projectId: string, label: string, status: string) {
  const result: QueryResult<{ id: string }> = await client.query(
    `INSERT INTO graphs (project_id, label, status)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [projectId, label, status]
  );

  return result.rows[0].id;
}

export async function setProjectLatestGraph(client: Queryable, projectId: string, graphId: string) {
  await client.query("UPDATE projects SET latest_graph_id = $1 WHERE id = $2", [graphId, projectId]);
}

export async function setGraphJobId(client: Queryable, graphId: string, jobId: string | null) {
  await client.query("UPDATE graphs SET job_id = $1 WHERE id = $2", [jobId, graphId]);
}
