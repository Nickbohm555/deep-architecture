import { ensureQueue, boss } from "./boss";
import { OPENAI_GRAPH_SCHEMA_NAME } from "./analysis/openai";
import { analyzeRepoJob, type IngestRepoJobData } from "./jobs/ingest-worker";
import { explainNodeJob, type ExplainNodeJobData } from "./jobs/node-explanation-worker";
import { indexRepoForRagJob, type RagIndexJobData } from "./jobs/rag-index-worker";
import { QUEUE_NAMES } from "./queues";

type BossJob<T> = { data?: Partial<T> } | Array<{ data?: Partial<T> }>;

function getJobData<T>(job: BossJob<T>): Partial<T> {
  return (Array.isArray(job) ? job[0]?.data : job.data) ?? {};
}

async function main() {
  console.log(`Starting worker with schema: ${OPENAI_GRAPH_SCHEMA_NAME}`);
  await ensureQueue(QUEUE_NAMES.INGEST_REPO);
  await ensureQueue(QUEUE_NAMES.EXPLAIN_NODE);
  await ensureQueue(QUEUE_NAMES.RAG_INDEX);

  await boss.work(QUEUE_NAMES.INGEST_REPO, async (job) => {
    const data = getJobData<IngestRepoJobData>(job as BossJob<IngestRepoJobData>);

    if (!data.repoUrl || !data.projectId || !data.graphId) {
      throw new Error("Ingest job payload is missing required fields");
    }

    await analyzeRepoJob({
      repoUrl: data.repoUrl,
      projectId: data.projectId,
      graphId: data.graphId
    });

    return { ok: true };
  });

  await boss.work(QUEUE_NAMES.EXPLAIN_NODE, async (job) => {
    const data = getJobData<ExplainNodeJobData>(job as BossJob<ExplainNodeJobData>);

    if (!data.graphId || !data.nodeKey || !data.question) {
      throw new Error("Explain job payload is missing required fields");
    }

    await explainNodeJob({
      graphId: data.graphId,
      nodeKey: data.nodeKey,
      question: data.question
    });

    return { ok: true };
  });

  await boss.work(QUEUE_NAMES.RAG_INDEX, async (job) => {
    const data = getJobData<RagIndexJobData>(job as BossJob<RagIndexJobData>);

    if (!data.repoUrl || !data.projectId || !data.graphId) {
      throw new Error("RAG index job payload is missing required fields");
    }

    await indexRepoForRagJob({
      repoUrl: data.repoUrl,
      projectId: data.projectId,
      graphId: data.graphId
    });

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
