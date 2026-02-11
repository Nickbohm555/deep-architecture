import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function parseArgs(argv) {
  const args = { staged: false, base: null };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--staged") {
      args.staged = true;
      continue;
    }

    if (value === "--base") {
      args.base = argv[i + 1] ?? null;
      i += 1;
    }
  }

  return args;
}

function changedFiles({ staged, base }) {
  if (staged) {
    return run("git diff --cached --name-only");
  }

  if (base) {
    return run(`git diff --name-only ${base}...HEAD`);
  }

  try {
    return run("git diff --name-only HEAD~1..HEAD");
  } catch {
    return run("git show --pretty='' --name-only HEAD");
  }
}

function normalizeList(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const files = normalizeList(changedFiles(args));

if (files.length === 0) {
  console.log("docs guard: no changed files found");
  process.exit(0);
}

const rules = [
  {
    name: "API",
    trigger: ["src/app/api/", "src/lib/api/"],
    docs: ["docs/api.md", "docs/changelog.md"]
  },
  {
    name: "Schema",
    trigger: [
      "src/server/schema.sql",
      "scripts_db_init.sql",
      "src/server/graph-schema.ts",
      "src/lib/projects-types.ts"
    ],
    docs: ["docs/schema.md", "docs/changelog.md"]
  },
  {
    name: "Workflow",
    trigger: [
      "src/server/worker.ts",
      "src/server/jobs/",
      "src/server/services/",
      "src/server/ingest.ts",
      "src/server/boss.ts"
    ],
    docs: ["docs/workers.md", "docs/changelog.md"]
  }
];

function touchesAny(changed, prefixes) {
  return changed.some((file) => prefixes.some((prefix) => file.startsWith(prefix)));
}

const errors = [];

for (const rule of rules) {
  const areaChanged = touchesAny(files, rule.trigger);
  if (!areaChanged) {
    continue;
  }

  const docsUpdated = touchesAny(files, rule.docs);
  if (!docsUpdated) {
    errors.push(
      `${rule.name} files changed but docs were not updated. Required one of: ${rule.docs.join(", ")}`
    );
  }
}

if (errors.length > 0) {
  console.error("docs guard failed:\n");
  for (const message of errors) {
    console.error(`- ${message}`);
  }

  console.error("\nChanged files:");
  for (const file of files) {
    console.error(`- ${file}`);
  }

  process.exit(1);
}

console.log("docs guard passed");
