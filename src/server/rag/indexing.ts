import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { chunkFileForRag, type RagChunkCandidate } from "./chunking";

const execFileAsync = promisify(execFile);

const MAX_FILE_BYTES = 120_000;
const MAX_FILES = 1_500;

const INCLUDE_PATTERNS = [
  /^src\/.*\.(ts|tsx|js|jsx)$/,
  /^docs\/.*\.md$/,
  /^README\.md$/,
  /^src\/server\/schema\.sql$/,
  /^scripts_db_init\.sql$/,
  /^src\/server\/graph-schema\.ts$/,
  /^src\/lib\/projects-types\.ts$/
];

const EXCLUDE_PATTERNS = [/^node_modules\//, /^\.next/, /^\.tsbuild/, /^dist\//, /^coverage\//];

function isIndexable(filePath: string) {
  if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath))) {
    return false;
  }

  return INCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

async function readFileSafe(absolutePath: string) {
  try {
    const data = await fs.readFile(absolutePath);
    return data.subarray(0, MAX_FILE_BYTES).toString("utf8");
  } catch {
    return null;
  }
}

export async function listRagFiles(repoDir: string) {
  const { stdout } = await execFileAsync("git", ["-C", repoDir, "ls-files"], {
    maxBuffer: 32 * 1024 * 1024
  });

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((entry) => isIndexable(entry))
    .slice(0, MAX_FILES);
}

export async function buildRagChunksFromRepo(repoDir: string) {
  const files = await listRagFiles(repoDir);
  const chunks: RagChunkCandidate[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(repoDir, relativePath);
    const content = await readFileSafe(absolutePath);
    if (!content) continue;

    chunks.push(...chunkFileForRag(relativePath, content));
  }

  return chunks;
}
