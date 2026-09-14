import { describe, expect, test } from "bun:test";
import { createAgentUIStreamResponse, stepCountIs, tool, ToolLoopAgent } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { withGatewayChatTools } from "../lib/chat/gateway-tools";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const response = (text: string, toolCalls: Array<{ name: string; arguments: string }> = []) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ text, toolCalls }) }],
  finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [],
});

describe("text gateway chat tools", () => {
  test("executes a data tool then answers using its result with usage preserved", async () => {
    let calls = 0;
    const provider = new MockLanguageModelV4({ doGenerate: [
      response("", [{ name: "readFile", arguments: '{"id":"fixture"}' }]),
      response("CS35-DEMO-1409"),
    ] });
    const agent = new ToolLoopAgent({
      model: withGatewayChatTools(provider), stopWhen: stepCountIs(3),
      tools: { readFile: tool({ inputSchema: z.object({ id: z.string() }), execute: async ({ id }) => { expect(id).toBe("fixture"); calls++; return { code: "CS35-DEMO-1409" }; } }) },
    });
    const result = await agent.generate({ prompt: "Read the uploaded file" });
    expect(calls).toBe(1);
    expect(result.text).toBe("CS35-DEMO-1409");
    expect(result.totalUsage.totalTokens).toBe(30);
    expect(provider.doGenerateCalls.every((c) => c.tools === undefined)).toBe(true);
    expect(provider.doGenerateCalls[1]?.prompt.some((m) => m.role === "tool")).toBe(false);
    expect(JSON.stringify(provider.doGenerateCalls[1]?.prompt)).toContain("CS35-DEMO-1409");
  });

  test("streams an approval request without executing a write", async () => {
    let writes = 0;
    const provider = new MockLanguageModelV4({ doGenerate: response("Saved!", [{ name: "saveDraft", arguments: '{"body":"A complete draft."}' }]) });
    const agent = new ToolLoopAgent({ model: withGatewayChatTools(provider), tools: {
      saveDraft: tool({ inputSchema: z.object({ body: z.string() }), needsApproval: true, execute: async () => { writes++; return { saved: true }; } }),
    } });
    const result = await createAgentUIStreamResponse({ agent, uiMessages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: "Save draft" }] }] });
    const body = await result.text();
    expect(writes).toBe(0);
    expect(body).toContain("tool-approval-request");
    expect(body).not.toContain("Saved!");
  });

  test("rejects an unknown tool before anything can execute", async () => {
    const provider = new MockLanguageModelV4({ doGenerate: response("", [{ name: "publish", arguments: "{}" }]) });
    const agent = new ToolLoopAgent({ model: withGatewayChatTools(provider), maxRetries: 0 });
    await expect(agent.generate({ prompt: "Hello" })).rejects.toThrow("unavailable tool");
  });

  test("rejects a text answer when the application requires a lookup", async () => {
    const provider = new MockLanguageModelV4({ doGenerate: response("I checked it") });
    const agent = new ToolLoopAgent({ model: withGatewayChatTools(provider), maxRetries: 0, toolChoice: { type: "tool", toolName: "getInsights" }, tools: {
      getInsights: tool({ inputSchema: z.object({}), execute: async () => ({}) }),
    } });
    await expect(agent.generate({ prompt: "Investigate" })).rejects.toThrow("required data lookup");
  });
});
