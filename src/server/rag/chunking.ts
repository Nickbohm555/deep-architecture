import crypto from "crypto";

export type RagChunkCandidate = {
  path: string;
  symbol: string | null;
  kind: string;
  startLine: number;
  endLine: number;
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
};

const MAX_CHARS = 3200;
const OVERLAP_CHARS = 320;

function hashContent(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isCodeExtension(path: string) {
  return /\.(ts|tsx|js|jsx)$/.test(path);
}

function inferKind(path: string) {
  if (path.includes("/api/")) return "api";
  if (path.includes("/services/")) return "service";
  if (path.includes("/jobs/")) return "job";
  if (path.includes("schema.sql") || path.endsWith(".sql")) return "schema";
  if (path.endsWith(".md")) return "docs";
  if (path.endsWith("package.json") || path.endsWith("tsconfig.json")) return "config";
  return "code";
}

function splitBySymbolBoundaries(lines: string[]) {
  const boundaries = new Set<number>([0]);

  lines.forEach((line, index) => {
    if (
      /^\s*(export\s+)?(async\s+)?function\s+[A-Za-z_$]/.test(line) ||
      /^\s*(export\s+)?class\s+[A-Za-z_$]/.test(line) ||
      /^\s*(export\s+)?const\s+[A-Za-z_$][\w$]*\s*=\s*(async\s*)?\(/.test(line) ||
      /^\s*export\s+default\s+function\s+/.test(line)
    ) {
      boundaries.add(index);
    }
  });

  boundaries.add(lines.length);

  return [...boundaries].sort((a, b) => a - b);
}

function detectSymbol(header: string) {
  const normalized = header.trim();
  const patterns = [
    /function\s+([A-Za-z_$][\w$]*)/,
    /class\s+([A-Za-z_$][\w$]*)/,
    /const\s+([A-Za-z_$][\w$]*)\s*=/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function splitLargeChunk(path: string, kind: string, baseLine: number, content: string, symbol: string | null) {
  if (content.length <= MAX_CHARS) {
    return [
      {
        path,
        symbol,
        kind,
        startLine: baseLine,
        endLine: baseLine + content.split("\n").length - 1,
        content
      }
    ];
  }

  const parts: Array<{
    path: string;
    symbol: string | null;
    kind: string;
    startLine: number;
    endLine: number;
    content: string;
  }> = [];

  let cursor = 0;
  while (cursor < content.length) {
    const end = Math.min(content.length, cursor + MAX_CHARS);
    const slice = content.slice(cursor, end);
    const prefix = content.slice(0, cursor);
    const startLine = baseLine + (prefix.match(/\n/g)?.length ?? 0);
    const lineCount = slice.match(/\n/g)?.length ?? 0;

    parts.push({
      path,
      symbol,
      kind,
      startLine,
      endLine: startLine + lineCount,
      content: slice.trim()
    });

    if (end >= content.length) break;
    cursor = Math.max(end - OVERLAP_CHARS, cursor + 1);
  }

  return parts;
}

export function chunkFileForRag(path: string, content: string): RagChunkCandidate[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const kind = inferKind(path);

  const baseChunks: Array<{
    path: string;
    symbol: string | null;
    kind: string;
    startLine: number;
    endLine: number;
    content: string;
  }> = [];

  if (isCodeExtension(path)) {
    const boundaries = splitBySymbolBoundaries(lines);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      if (end <= start) continue;

      const block = lines.slice(start, end).join("\n").trim();
      if (!block) continue;

      const symbol = detectSymbol(lines[start] ?? "");
      baseChunks.push(...splitLargeChunk(path, kind, start + 1, block, symbol));
    }
  } else {
    baseChunks.push(...splitLargeChunk(path, kind, 1, normalized, null));
  }

  return baseChunks
    .map((chunk) => ({
      ...chunk,
      contentHash: hashContent(`${path}:${chunk.startLine}:${chunk.endLine}:${chunk.content}`),
      metadata: {
        path,
        kind,
        symbol: chunk.symbol
      }
    }))
    .filter((chunk) => chunk.content.length > 0);
}
