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
});
