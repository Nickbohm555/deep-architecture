import { NextResponse } from "next/server";
import { pool } from "@/server/db";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  const projectResult = await pool.query(
    `SELECT p.id, p.name, p.repo_url, p.created_at,
            g.id AS graph_id, g.status, g.summary, g.metadata, g.created_at AS graph_created_at
     FROM projects p
     LEFT JOIN graphs g ON g.id = p.latest_graph_id
     WHERE p.id = $1`,
    [projectId]
  );

  if (projectResult.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const graphId = projectResult.rows[0].graph_id as string | null;

  if (!graphId) {
    return NextResponse.json({ project: projectResult.rows[0], nodes: [], edges: [] });
  }

  const nodesResult = await pool.query(
    `SELECT node_key, kind, label, data
     FROM graph_nodes
     WHERE graph_id = $1`,
    [graphId]
  );

  const edgesResult = await pool.query(
    `SELECT source_key, target_key, kind, label, data
     FROM graph_edges
     WHERE graph_id = $1`,
    [graphId]
  );

  return NextResponse.json({
    project: projectResult.rows[0],
    nodes: nodesResult.rows,
    edges: edgesResult.rows
  });
}
