import OpenAI from "openai";
import { graphJsonSchema, type GraphOutput } from "../graph-schema";
import { sanitizeGraphOutput } from "./graph-postprocess";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

export const OPENAI_GRAPH_SCHEMA_NAME = graphJsonSchema.name;

function buildPrompt() {
  return [
    "You are an architecture analyst.",
    "Given a repository context, produce a JSON graph focused on runtime data flow and triggers, not feature lists.",
    "Prioritize: inbound triggers, processing stages, storage boundaries, outbound effects.",
    "Model nodes as major runtime actors (services, workers, queues, topics, databases, external APIs, schedulers, webhooks, modules, key entry functions).",
    "Model edges as flow relationships with explicit direction and type (e.g., http, event, queue_publish, queue_consume, db_read, db_write, cron_trigger, webhook_trigger, stream, cache_read, cache_write).",
    "Prefer fewer high-signal nodes over many UI/feature nodes.",
    "If the repo has async/background processing, represent trigger paths clearly.",
    "Return a concise summary that describes the end-to-end data flow and primary trigger paths.",
    "Use stable node keys, e.g., service:api, queue:ingest-repo, db:postgres, function:payments.process.",
    "Only return JSON that matches the provided schema."
  ].join("\n");
}

export async function analyzeArchitectureGraph(input: {
  repoUrl: string;
  tree: string[];
  importantContents: Record<string, string>;
}): Promise<GraphOutput> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: buildPrompt() },
      { role: "user", content: JSON.stringify(input, null, 2) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: graphJsonSchema
    }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from OpenAI");
  }

  return sanitizeGraphOutput(JSON.parse(content));
}

export async function explainGraphNode(input: {
  graphSummary: string | null;
  node: {
    key: string;
    kind: string;
    label: string;
    data: Record<string, unknown>;
  };
  incoming: Array<{
    from: string;
    kind: string;
    label: string | null;
  }>;
  outgoing: Array<{
    to: string;
    kind: string;
    label: string | null;
  }>;
  question: string;
}) {
  const prompt = [
    "You are an architecture explainer.",
    "Explain the selected node in detail, then explain how data enters/leaves it and what triggers it.",
    "Describe how this node participates in upstream/downstream flow with connected nodes.",
    "Do not invent behavior not present in the provided graph context.",
    "Use concise, practical language with short sections and bullets."
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(input, null, 2) }
    ]
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("No explanation content returned from OpenAI");
  }

  return content;
}
