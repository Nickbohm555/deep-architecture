import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MAX_FILE_BYTES = 48_000;
const MAX_TREE_ENTRIES = 400;
const MAX_FLOW_FILES = 48;
const MAX_RAG_FILES = 140;
const MAX_RAG_CHUNK_CHARS = 1_600;
const MAX_RAG_CHUNK_OVERLAP = 220;

const IMPORTANT_FILES = [
  "README.md",
  "README.MD",
  "README",
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "pyproject.toml",
  "requirements.txt",
  "poetry.lock",
  "Pipfile",
  "go.mod",
  "go.sum",
  "Cargo.toml",
  "Cargo.lock",
  "Gemfile",
  "Gemfile.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Makefile",
  "docker-compose.yml",
  "Dockerfile"
];

const FLOW_FILE_MATCHERS = [
  "docker",
  "compose",
  "gateway",
  "whatsapp",
  "baileys",
  "agent",
  "worker",
  "queue",
  "event",
  "webhook",
  "channel",
  "message",
  "send",
  "outbound",
  "inbound",
  "handler",
  "route",
  "api",
  "db",
  "postgres",
  "redis"
];

const RAG_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".cs",
  ".sql",
  ".md",
  ".yaml",
  ".yml",
  ".json"
]);

export type RepoChunk = {
  path: string;
  chunkIndex: number;
  language: string | null;
  content: string;
};

export async function cloneRepo(repoUrl: string, targetDir: string) {
  await execFileAsync("git", ["clone", "--depth", "1", repoUrl, targetDir], {
    maxBuffer: 32 * 1024 * 1024
  });
}

export async function getRepoTree(repoDir: string) {
  const { stdout } = await execFileAsync("git", ["-C", repoDir, "ls-files"], {
    maxBuffer: 32 * 1024 * 1024
  });
  const entries = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_TREE_ENTRIES);
  return entries;
}

async function readFileSafe(filePath: string) {
  try {
    const data = await fs.readFile(filePath);
    return data.subarray(0, MAX_FILE_BYTES).toString("utf8");
  } catch {
    return null;
  }
}

function selectFlowFiles(tree: string[]) {
  const matches = tree.filter((entry) => {
    const lowered = entry.toLowerCase();
    return FLOW_FILE_MATCHERS.some((matcher) => lowered.includes(matcher));
  });

  return matches.slice(0, MAX_FLOW_FILES);
}

export async function collectRepoContext(repoDir: string) {
  const tree = await getRepoTree(repoDir);
  const importantContents: Record<string, string> = {};

  for (const file of IMPORTANT_FILES) {
    const filePath = path.join(repoDir, file);
    const content = await readFileSafe(filePath);
    if (content) {
      importantContents[file] = content;
    }
  }

  const readmePath = tree.find((entry) => entry.toLowerCase().startsWith("readme"));
  if (readmePath && !importantContents[readmePath]) {
    const content = await readFileSafe(path.join(repoDir, readmePath));
    if (content) {
      importantContents[readmePath] = content;
    }
  }

  for (const file of selectFlowFiles(tree)) {
    if (importantContents[file]) continue;
    const content = await readFileSafe(path.join(repoDir, file));
    if (content) {
      importantContents[file] = content;
    }
  }

  return {
    tree,
    importantContents
  };
}

export async function cleanupRepo(repoDir: string) {
  await fs.rm(repoDir, { recursive: true, force: true });
}

function inferLanguage(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "typescript";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    case ".java":
      return "java";
    case ".kt":
      return "kotlin";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".cs":
      return "csharp";
    case ".sql":
      return "sql";
    case ".json":
      return "json";
    case ".md":
      return "markdown";
    case ".yaml":
    case ".yml":
      return "yaml";
    default:
      return null;
  }
}

function splitIntoChunks(content: string) {
  const chunks: string[] = [];
  let cursor = 0;
  const source = content.trim();

  while (cursor < source.length) {
    const next = Math.min(cursor + MAX_RAG_CHUNK_CHARS, source.length);
    const chunk = source.slice(cursor, next).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (next >= source.length) break;
    cursor = Math.max(0, next - MAX_RAG_CHUNK_OVERLAP);
  }

  return chunks;
}

function selectRagFiles(tree: string[]) {
  return tree
    .filter((entry) => {
      const lowered = entry.toLowerCase();
      if (lowered.includes("node_modules/")) return false;
      if (lowered.includes("dist/") || lowered.includes(".next/") || lowered.includes(".next-dev/")) {
        return false;
      }
      return RAG_FILE_EXTENSIONS.has(path.extname(lowered));
    })
    .slice(0, MAX_RAG_FILES);
}

export async function collectRepoChunks(repoDir: string, tree: string[]): Promise<RepoChunk[]> {
  const chunks: RepoChunk[] = [];

  for (const file of selectRagFiles(tree)) {
    const content = await readFileSafe(path.join(repoDir, file));
    if (!content) continue;

    const split = splitIntoChunks(content);
    for (let index = 0; index < split.length; index += 1) {
      chunks.push({
        path: file,
        chunkIndex: index,
        language: inferLanguage(file),
        content: split[index]
      });
    }
  }

  return chunks;
}
