import { NextResponse } from "next/server";
import { pool } from "@/server/db";
import { ensureQueue, boss } from "@/server/boss";

export const runtime = "nodejs";

function getRepoName(repoUrl: string) {
  const trimmed = repoUrl.replace(/\.git$/, "").split("/");
  return trimmed[trimmed.length - 1] || "unknown";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";

  if (!repoUrl.startsWith("https://github.com/")) {
    return NextResponse.json({ error: "Only GitHub HTTPS URLs are supported" }, { status: 400 });
  }

  const name = getRepoName(repoUrl);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `INSERT INTO projects (name, repo_url)
       VALUES ($1, $2)
       ON CONFLICT (repo_url) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name, repoUrl]
    );

    const projectId = projectResult.rows[0].id as string;

    const graphResult = await client.query(
      `INSERT INTO graphs (project_id, label, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [projectId, "Initial", "queued"]
    );

    const graphId = graphResult.rows[0].id as string;

    await client.query(
      "UPDATE projects SET latest_graph_id = $1 WHERE id = $2",
      [graphId, projectId]
    );

    await ensureQueue("ingest-repo");
    const jobId = await boss.send("ingest-repo", { repoUrl, projectId, graphId });

    await client.query(
      "UPDATE graphs SET job_id = $1 WHERE id = $2",
      [jobId, graphId]
    );

    await client.query("COMMIT");

    return NextResponse.json({ projectId, graphId, jobId });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Failed to enqueue ingest" }, { status: 500 });
  } finally {
    client.release();
  }
}
