import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { analyzeArchitectureGraph, analyzeGraphNodeDetails } from "../analysis/openai";
import { buildFallbackNodeDetails } from "../analysis/node-details";
import { cloneRepo, collectRepoContext, cleanupRepo } from "../ingest";
import {
  saveGraphOutput,
  updateGraphStatus,
  updateProjectLatestGraph
} from "../persistence/graph-repo";

export type IngestRepoJobData = {
  repoUrl: string;
  projectId: string;
  graphId: string;
};

export async function analyzeRepoJob({ repoUrl, projectId, graphId }: IngestRepoJobData) {
  const workDir = path.join(os.tmpdir(), "deep-architecture", `${projectId}-${randomUUID()}`);
  await updateGraphStatus(graphId, "running");

  try {
    await cloneRepo(repoUrl, workDir);
    const { tree, importantContents } = await collectRepoContext(workDir);
    const output = await analyzeArchitectureGraph({ repoUrl, tree, importantContents });
    const nodeDetails = await analyzeGraphNodeDetails({
      repoUrl,
      graph: output,
      tree,
      importantContents
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      return buildFallbackNodeDetails(output).map((item) => ({
        ...item,
        error: message
      }));
    });

    await saveGraphOutput(graphId, output, nodeDetails);
    await updateProjectLatestGraph(projectId, graphId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateGraphStatus(graphId, "failed", message);
    throw error;
  } finally {
    await cleanupRepo(workDir);
  }
}
