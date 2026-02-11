import { describe, expect, it } from "vitest";
import { sanitizeGraphOutput } from "./graph-postprocess";

describe("sanitizeGraphOutput", () => {
  it("normalizes and filters invalid nodes/edges", () => {
    const output = sanitizeGraphOutput({
      summary: " test ",
      nodes: [
        { key: "service:gateway", kind: "service", label: "Gateway", data: { x: 1 } },
        { key: "service:gateway", kind: "service", label: "Gateway dup", data: {} },
        { key: "", kind: "module", label: "Invalid", data: {} }
      ],
      edges: [
        {
          source: "service:gateway",
          target: "service:gateway",
          kind: "flow",
          label: "self",
          data: {}
        }
      ]
    });

    expect(output.summary).toBe("test");
    expect(output.nodes).toHaveLength(1);
    expect(output.edges.every((edge) => edge.source !== edge.target)).toBe(true);
  });

  it("infers hierarchy edges when model returns none", () => {
    const output = sanitizeGraphOutput({
      summary: "s",
      nodes: [
        { key: "service:gateway", kind: "service", label: "Gateway", data: {} },
        { key: "service:gateway.module:wa", kind: "module", label: "WA", data: {} }
      ],
      edges: []
    });

    expect(output.edges.length).toBeGreaterThan(0);
    expect(output.edges[0].source).toBe("service:gateway");
    expect(output.edges[0].target).toBe("service:gateway.module:wa");
  });

  it("infers critical flow chain when known keywords are present", () => {
    const output = sanitizeGraphOutput({
      summary: "s",
      nodes: [
        { key: "infra:docker", kind: "infra", label: "Docker", data: {} },
        { key: "service:gateway", kind: "service", label: "Gateway", data: {} },
        { key: "channel:whatsapp-baileys", kind: "channel", label: "WhatsApp", data: {} },
        { key: "service:agent", kind: "service", label: "Agent", data: {} },
        { key: "service:output", kind: "service", label: "Output", data: {} }
      ],
      edges: []
    });

    const edgePairs = new Set(output.edges.map((edge) => `${edge.source}->${edge.target}`));
    expect(edgePairs.has("infra:docker->service:gateway")).toBe(true);
    expect(edgePairs.has("service:gateway->channel:whatsapp-baileys")).toBe(true);
    expect(edgePairs.has("channel:whatsapp-baileys->service:agent")).toBe(true);
    expect(edgePairs.has("service:agent->service:output")).toBe(true);
  });

  it("infers agentic flow chain for ai architecture nodes", () => {
    const output = sanitizeGraphOutput({
      summary: "s",
      nodes: [
        { key: "service:webhook-gateway", kind: "service", label: "Webhook Gateway", data: {} },
        { key: "service:agent-orchestrator", kind: "service", label: "Agent Orchestrator", data: {} },
        { key: "module:prompt-builder", kind: "module", label: "Prompt Builder", data: {} },
        { key: "llm:openai-chat", kind: "llm", label: "OpenAI Chat", data: {} },
        { key: "tool:whatsapp-baileys", kind: "tool", label: "WhatsApp Baileys", data: {} },
        { key: "memory:postgres", kind: "memory", label: "Postgres Memory", data: {} },
        { key: "service:output-dispatcher", kind: "service", label: "Output Dispatcher", data: {} }
      ],
      edges: []
    });

    const byPair = new Map(output.edges.map((edge) => [`${edge.source}->${edge.target}`, edge]));

    expect(byPair.has("service:webhook-gateway->service:agent-orchestrator")).toBe(true);
    expect(byPair.get("service:webhook-gateway->service:agent-orchestrator")?.kind).toBe("http");

    expect(byPair.has("service:agent-orchestrator->module:prompt-builder")).toBe(true);
    expect(byPair.get("service:agent-orchestrator->module:prompt-builder")?.kind).toBe("flow");

    expect(byPair.has("module:prompt-builder->llm:openai-chat")).toBe(true);
    expect(byPair.get("module:prompt-builder->llm:openai-chat")?.kind).toBe("prompt_build");

    expect(byPair.has("llm:openai-chat->tool:whatsapp-baileys")).toBe(true);
    expect(byPair.get("llm:openai-chat->tool:whatsapp-baileys")?.kind).toBe("llm_infer");
  });
});
