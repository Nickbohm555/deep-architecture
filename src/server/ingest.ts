import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MAX_FILE_BYTES = 48_000;
const MAX_TREE_ENTRIES = 400;

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

export async function cloneRepo(repoUrl: string, targetDir: string) {
  await execFileAsync("git", ["clone", "--depth", "1", repoUrl, targetDir]);
}

export async function getRepoTree(repoDir: string) {
  const { stdout } = await execFileAsync("git", ["-C", repoDir, "ls-files"]);
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

  return {
    tree,
    importantContents
  };
}

export async function cleanupRepo(repoDir: string) {
  await fs.rm(repoDir, { recursive: true, force: true });
}
