import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("first-class Chat platform", () => {
  const migration = read("drizzle/0011_gray_spiral.sql");

  test("protects persistent chat, attachment, run, tool, and draft-version data", () => {
    for (const table of [
      "chat_conversations",
      "chat_messages",
      "chat_attachments",
      "chat_attachment_chunks",
      "chat_model_runs",
      "chat_tool_runs",
      "counter_argument_draft_versions",
    ]) {
      expect(migration).toContain(
        `ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY`,
      );
      expect(migration).toContain(
        `REVOKE ALL ON TABLE "public"."${table}" FROM PUBLIC`,
      );
    }
    expect(migration).toContain("chat_attachment_chunks_search_idx");
    expect(migration).toContain("chat_tool_runs_model_call_idx");
    expect(migration).toContain("ON DELETE cascade");
  });

  test("uses scoped Tuturuuu Drive uploads without persisting signed URLs", () => {
    const drive = read("lib/chat/tuturuuu-drive.ts");
    const attachmentRoute = read(
      "app/api/chat/conversations/[id]/attachments/route.ts",
    );
    expect(drive).toContain("/external-apps/drive");
    expect(drive).toContain("/upload-url");
    expect(drive).toContain("/finalize");
    expect(attachmentRoute).not.toContain("signedUrl:");
    expect(migration).not.toContain("signed_url");
  });

  test("caps agent loops and requires approval for every write tool", () => {
    const route = read("app/api/chat/conversations/[id]/messages/route.ts");
    const tools = read("lib/chat/tools.ts");
    expect(route).toContain('input.thinkingMode === "deep" ? 12 : 6');
    expect(route).toContain("sendReasoning: true");
    expect(tools.match(/needsApproval: true/g)?.length).toBe(6);
    expect(tools).not.toContain("publishArticle");
    expect(tools).not.toContain("scheduleArticle");
    expect(tools).toContain("createDraft");
    expect(tools).toContain("createScanFromAttachment");
    expect(tools).toContain("updateEvidenceTriage");
  });

  test("supports purpose-specific modes with fast and deep investigation", () => {
    const types = read("lib/chat/types.ts");
    const route = read("app/api/chat/conversations/[id]/messages/route.ts");
    expect(types).toContain('["ask", "investigate", "draft", "report"]');
    expect(types).toContain('["fast", "deep"]');
    expect(route).toContain("chatModeInstruction(input.mode)");
    expect(route).toContain("thinkingModeInstruction(input.thinkingMode)");
    expect(route).toContain("không tiết lộ chuỗi suy nghĩ nội bộ");
    expect(route).toContain("Hoàn tất yêu cầu ngay trong lượt hiện tại");
    expect(route).toContain("bắt buộc phải gọi công cụ phù hợp");
    expect(route).toContain("shouldRequireGrounding(input.mode, incoming)");
    expect(route).toContain('toolChoice: "required"');
    expect(route).toContain('"searchEvidence"');
    expect(route).toContain('"getInsights"');
  });

  test("keeps all generated content internal and human reviewed", () => {
    const generation = read("lib/llm/generation.ts");
    const worker = read("lib/workers/scans.ts");
    expect(generation).toContain("never publish or automate posting");
    expect(worker).toContain('status: "needs_review"');
    expect(worker).toContain('"draft_generated"');
  });
});
