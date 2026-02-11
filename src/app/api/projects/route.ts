import { NextResponse } from "next/server";
import { pool } from "@/server/db";

export const runtime = "nodejs";

export async function GET() {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.repo_url, p.created_at,
            g.id AS graph_id, g.status, g.summary, g.created_at AS graph_created_at
     FROM projects p
     LEFT JOIN graphs g ON g.id = p.latest_graph_id
     ORDER BY p.created_at DESC`
  );

  return NextResponse.json({ projects: rows });
}
