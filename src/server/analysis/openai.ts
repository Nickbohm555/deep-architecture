import OpenAI from "openai";
import { graphJsonSchema, type GraphOutput } from "../graph-schema";
import { normalizeNodeDetails, type NodeArchitectureDetailRecord } from "./node-details";
import { sanitizeGraphOutput } from "./graph-postprocess";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const RAG_EMBED_MODEL = process.env.RAG_EMBED_MODEL ?? "text-embedding-3-large";

export const OPENAI_GRAPH_SCHEMA_NAME = graphJsonSchema.name;

const nodeDetailsJsonSchema = {
  name: "graph_node_details_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["nodeDetails"],
    properties: {
      nodeDetails: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nodeKey", "details"],
          properties: {
            nodeKey: { type: "string" },
            details: {
              type: "object",
              additionalProperties: false,
              required: [
                "overview",
                "roleInFlow",
                "triggers",
                "inputs",
                "outputs",
                "internalFlowSteps",
                "keyFunctions",
                "keyClasses",
                "dependencies",
                "failureModes",
                "observability",
                "sourcePointers"
              ],
              properties: {
                overview: { type: "string" },
                roleInFlow: { type: "string" },
                triggers: { type: "array", items: { type: "string" } },
                inputs: { type: "array", items: { type: "string" } },
                outputs: { type: "array", items: { type: "string" } },
                internalFlowSteps: { type: "array", items: { type: "string" } },
                keyFunctions: { type: "array", items: { type: "string" } },
                keyClasses: { type: "array", items: { type: "string" } },
                dependencies: { type: "array", items: { type: "string" } },
                failureModes: { type: "array", items: { type: "string" } },
                observability: { type: "array", items: { type: "string" } },
                sourcePointers: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    }
  }
} as const;

function buildPrompt() {
  return [
    "You are an architecture analyst specializing in agentic AI systems.",
    "Given a repository context, produce a JSON graph focused on runtime data flow, trigger paths, and AI agent execution loops.",
    "Do NOT produce a feature list or UI-centric map.",
    "Prioritize this structure:",
    "1) inbound triggers (http/webhook/cron/queue/event),",
    "2) gateway/router/auth/context building,",
    "3) agent orchestration and planning,",
    "4) model/tool execution,",
    "5) memory/retrieval/state writes,",
    "6) outbound actions and user-visible outputs.",
    "Model nodes as major runtime actors only: service, worker, queue/topic, scheduler, webhook, datastore, cache, external API, model gateway, LLM callsite, prompt/template, tool executor, retrieval, memory store, guardrail/evaluator, and key entry functions.",
    "When AI/agent logic exists, include as many of these as are present in the code: trigger, context builder, planner/router, prompt composer, model invocation, tool adapter, retrieval/memory, post-processor, guardrail/evaluator, output channel.",
    "Model edges with explicit direction and concrete edge kinds such as: http, webhook_trigger, cron_trigger, queue_publish, queue_consume, event_emit, event_consume, prompt_build, llm_infer, tool_call, retrieval_query, memory_read, memory_write, db_read, db_write, output_emit.",
    "Use edge labels to describe what data moves or what trigger fires (short and concrete).",
    "Prefer fewer high-signal runtime nodes over many low-value nodes.",
    "If async/background processing exists, show producer->queue->consumer clearly.",
    "Return a concise summary focused on end-to-end request lifecycle and trigger-to-output flow.",
    "Use stable node keys, e.g., service:api, queue:ingest-repo, llm:openai-chat, tool:whatsapp-client, memory:postgres.",
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

export async function embedTexts(input: { texts: string[] }) {
  if (input.texts.length === 0) {
    return [] as number[][];
  }

  const response = await openai.embeddings.create({
    model: RAG_EMBED_MODEL,
    input: input.texts
  });

  return response.data.map((item) => item.embedding);
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
    "You are an architecture explainer for agentic systems.",
    "Explain the selected node in detail, then explain triggers, inbound data, outbound data, and failure points.",
    "Describe how this node participates in upstream/downstream execution flow with connected nodes.",
    "If this node is part of agentic AI, clarify its role in planning, prompting, tool use, retrieval/memory, guardrails, or output orchestration.",
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

export async function analyzeGraphNodeDetails(input: {
  repoUrl: string;
  graph: GraphOutput;
  tree: string[];
  importantContents: Record<string, string>;
}): Promise<NodeArchitectureDetailRecord[]> {
  const prompt = [
    "You are an architecture analyst specializing in agentic AI systems.",
    "Given repository context and an existing architecture graph, produce structured per-node implementation details.",
    "Focus on how each node works internally: classes, functions, dependencies, triggers, and data flow.",
    "Prioritize AI/agent architecture where present: planner/router, prompt construction, model invocation, tools, retrieval, memory/state, guardrails, output dispatch.",
    "For each node, provide concise structured fields with concrete references.",
    "Use sourcePointers for likely files/functions, as repo-relative paths or symbol-like pointers.",
    "Do not invent entities not supported by repository context.",
    "Return JSON that matches schema exactly."
  ].join("\n");

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(input, null, 2) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: nodeDetailsJsonSchema
    }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No node details returned from OpenAI");
  }

  const parsed = JSON.parse(content) as { nodeDetails?: Array<Partial<NodeArchitectureDetailRecord>> };
  return normalizeNodeDetails(input.graph, parsed.nodeDetails ?? []);
}
