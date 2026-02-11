import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MAX_FILE_BYTES = 48_000;
const MAX_TREE_ENTRIES = 400;
const MAX_FLOW_FILES = 48;

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
