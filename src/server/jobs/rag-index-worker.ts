import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { embedTexts } from "../analysis/openai";
import { cloneRepo, cleanupRepo } from "../ingest";
import { replaceGraphRagChunks } from "../persistence/rag-repo";
import { buildRagChunksFromRepo } from "../rag/indexing";

export type RagIndexJobData = {
  repoUrl: string;
  projectId: string;
  graphId: string;
};

async function embedInBatches(texts: string[]) {
  const batchSize = 20;
  const embeddings: number[][] = [];

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    const embedded = await embedTexts({ texts: batch });
    embeddings.push(...embedded);
  }

  return embeddings;
}

export async function indexRepoForRagJob({ repoUrl, projectId, graphId }: RagIndexJobData) {
  const workDir = path.join(os.tmpdir(), "deep-architecture-rag", `${projectId}-${randomUUID()}`);

  try {
    await cloneRepo(repoUrl, workDir);
    const chunks = await buildRagChunksFromRepo(workDir);

    const embeddings = await embedInBatches(chunks.map((chunk) => chunk.content));
    const rows = chunks.map((chunk, index) => {
      const embedding = embeddings[index];
      if (!embedding || embedding.length === 0) {
        throw new Error(`Missing embedding for chunk ${chunk.path}:${chunk.startLine}`);
      }

      return {
        projectId,
        graphId,
        path: chunk.path,
        symbol: chunk.symbol,
        kind: chunk.kind,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        metadata: chunk.metadata,
        contentHash: chunk.contentHash,
        embedding
      };
    });

    await replaceGraphRagChunks(graphId, rows);
  } finally {
    await cleanupRepo(workDir);
  }
}
