import { expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { cleanChatToolContext } from "../lib/chat/model-context";

test("tool results with decorative emoji remain usable without changing stored evidence or user text", () => {
  const messages: ModelMessage[] = [
    { role: "user", content: "Giải thích biểu tượng 📢" },
    { role: "tool", content: [
      { type: "tool-result", toolCallId: "a", toolName: "getInsights", output: { type: "json", value: { quote: "📢".repeat(15) + " Thứ Bảy 14/9/2026.", count: 25, href: "/evidence/123" } } },
      { type: "tool-result", toolCallId: "b", toolName: "searchAttachments", output: { type: "text", value: "📌 Mã: CS35-DEMO-1409." } },
    ] },
  ];
  const clean = cleanChatToolContext(messages);
  expect(clean[0]).toEqual(messages[0]);
  expect(JSON.stringify(clean[1])).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(JSON.stringify(clean[1])).toContain("Thứ Bảy 14/9/2026.");
  expect(JSON.stringify(clean[1])).toContain("CS35-DEMO-1409.");
  expect(JSON.stringify(clean[1])).toContain('"count":25');
  expect(JSON.stringify(messages[1])).toContain("📢".repeat(15));
});
