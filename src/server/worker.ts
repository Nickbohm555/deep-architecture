import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { pool } from "./db";
import { boss, ensureQueue } from "./boss";
import { cloneRepo, collectRepoContext, cleanupRepo } from "./ingest";
import { graphJsonSchema, GraphOutput } from "./graph-schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

async function updateGraphStatus(graphId: string, status: string, error?: string) {
  await pool.query(
    "UPDATE graphs SET status = $1, error = $2, updated_at = now() WHERE id = $3",
    [status, error ?? null, graphId]
  );
}

async function saveGraphOutput(graphId: string, output: GraphOutput) {
  await pool.query(
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
    const nodeParams = nodeValues
      .map(
        (_, idx) =>
          `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`
      )
      .join(",");
    const nodeArgs = nodeValues.flat();

    await pool.query(
      `INSERT INTO graph_nodes (graph_id, node_key, kind, label, data)
       VALUES ${nodeParams}
       ON CONFLICT (graph_id, node_key) DO UPDATE SET
         kind = EXCLUDED.kind,
         label = EXCLUDED.label,
         data = EXCLUDED.data`,
      nodeArgs
    );
  }

  const edgeValues = output.edges.map((edge) => [
    graphId,
    edge.source,
    edge.target,
    edge.kind,
    edge.label ?? null,
    edge.data ?? {}
  ]);

  if (edgeValues.length > 0) {
    const edgeParams = edgeValues
      .map(
        (_, idx) =>
          `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`
      )
      .join(",");
    const edgeArgs = edgeValues.flat();

    await pool.query(
      `INSERT INTO graph_edges (graph_id, source_key, target_key, kind, label, data)
       VALUES ${edgeParams}`,
      edgeArgs
    );
  }
}

async function analyzeRepo({ repoUrl, projectId, graphId }: { repoUrl: string; projectId: string; graphId: string }) {
  const workDir = path.join(os.tmpdir(), "deep-architecture", `${projectId}-${randomUUID()}`);
  await updateGraphStatus(graphId, "running");

  try {
    await cloneRepo(repoUrl, workDir);
    const { tree, importantContents } = await collectRepoContext(workDir);

    const prompt = [
      "You are an architecture analyst. Given a repository context, produce a JSON graph that captures the runtime data flow.",
      "Focus on major services, modules, and function-level entry points where possible.",
      "Return a concise summary and a graph of nodes and edges.",
      "Use stable node keys, e.g., service:api, module:auth, function:payments.process.",
      "Only return JSON that matches the provided schema."
    ].join("\n");

    const contextPayload = {
      repoUrl,
      tree,
      importantContents
    };

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(contextPayload, null, 2) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: graphJsonSchema
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    const output = JSON.parse(content) as GraphOutput;
    await saveGraphOutput(graphId, output);
    await pool.query(
      "UPDATE projects SET latest_graph_id = $1 WHERE id = $2",
      [graphId, projectId]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateGraphStatus(graphId, "failed", message);
    throw error;
  } finally {
    await cleanupRepo(workDir);
  }
}

async function main() {
  await ensureQueue("ingest-repo");

  await boss.work("ingest-repo", async (job) => {
    const jobItem = Array.isArray(job) ? job[0] : job;
    const { repoUrl, projectId, graphId } = (jobItem?.data ?? {}) as {
      repoUrl: string;
      projectId: string;
      graphId: string;
    };

    await analyzeRepo({ repoUrl, projectId, graphId });
    return { ok: true };
  });

  boss.on("error", (error) => {
    console.error("pg-boss error", error);
  });

  process.on("SIGINT", async () => {
    await boss.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
