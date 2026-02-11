import { boss, ensureQueue } from "../boss";
import { pool } from "../db";
import { ValidationError } from "../errors";
import { QUEUE_NAMES } from "../queues";
import {
  createGraph,
  getGraphEdges,
  getGraphNodes,
  getProjectByIdWithLatestGraph,
  listProjectsWithLatestGraph,
  setGraphJobId,
  setProjectLatestGraph,
  upsertProjectByRepoUrl
} from "../persistence/projects-repo";
import { getGraphNodeDetails } from "../persistence/graph-node-details-repo";
import { getRepoName, isSupportedRepoUrl } from "./projects-service.utils";

export async function listProjects() {
  return listProjectsWithLatestGraph();
}

export async function getProjectDetail(projectId: string) {
  const project = await getProjectByIdWithLatestGraph(projectId);
  if (!project) {
    return null;
  }

  const graphId = project.graph_id as string | null;

  if (!graphId) {
    return { project, nodes: [], edges: [], node_details: [] };
  }

  const [nodes, edges, nodeDetails] = await Promise.all([
    getGraphNodes(graphId),
    getGraphEdges(graphId),
    getGraphNodeDetails(graphId)
  ]);

  return {
    project,
    nodes,
    edges,
    node_details: nodeDetails
  };
}

export type EnqueueIngestResult = {
  projectId: string;
  graphId: string;
  jobId: string | null;
};

export async function enqueueIngest(repoUrl: string): Promise<EnqueueIngestResult> {
  if (!isSupportedRepoUrl(repoUrl)) {
    throw new ValidationError("Only GitHub HTTPS URLs are supported", "unsupported_repo_url");
  }

  const name = getRepoName(repoUrl);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectId = await upsertProjectByRepoUrl(client, name, repoUrl);
    const graphId = await createGraph(client, projectId, "Initial", "queued");
    await setProjectLatestGraph(client, projectId, graphId);

    await ensureQueue(QUEUE_NAMES.INGEST_REPO);
    const jobId = await boss.send(QUEUE_NAMES.INGEST_REPO, { repoUrl, projectId, graphId });

    await setGraphJobId(client, graphId, jobId);
    await client.query("COMMIT");

    return { projectId, graphId, jobId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
