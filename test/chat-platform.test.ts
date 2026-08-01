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
    expect(route).toContain(
      'toolChoice: { toolName: "getInsights", type: "tool" }',
    );
    expect(route).toContain('activeTools: ["getInsights"]');
    expect(route).toContain('"getInsights"');
    expect(route).toContain(
      "compactGroundingContext(await getIntelligenceOverview())",
    );
    expect(route).toContain(
      "không được tạo ID, liên kết, nguồn hay sự kiện khác",
    );
  });

  test("keeps Chat inside the viewport and scrolls only its internal panes", () => {
    const chatPage = read("app/chat/page.tsx");
    const conversationPage = read("app/chat/[id]/page.tsx");
    const workspace = read("components/dashboard/chat-workspace.tsx");
    const layout = read("components/dashboard/dashboard-layout-shell.tsx");
    const shell = read("components/dashboard/shell.tsx");

    for (const page of [chatPage, conversationPage]) {
      expect(page).toContain("h-[calc(100dvh-8rem)]");
      expect(page).toContain("lg:h-[calc(100dvh-4rem)]");
      expect(page).toContain("overflow-hidden");
      expect(page).not.toContain("<PageHeader");
    }
    expect(layout).toContain('pathname.startsWith("/chat")');
    expect(layout).toContain("min-h-0 flex-1 overflow-hidden");
    expect(shell).toContain('id="chat-sidebar-portal"');
    expect(shell).toContain('id="chat-topbar-portal"');
    expect(shell).toContain("lg:justify-center lg:gap-0 lg:px-0");
    expect(workspace).toContain("createPortal");
    expect(workspace).toContain("grid h-full min-h-0 min-w-0");
    expect(workspace).toContain("overflow-y-auto overscroll-contain");
    expect(workspace).not.toContain("lg:grid-cols-[248px_minmax(0,1fr)]");
    expect(workspace).not.toContain("min-h-[620px]");
  });

  test("uses a cohesive and understandable prompt composer", () => {
    const workspace = read("components/dashboard/chat-workspace.tsx");
    const promptInput = read("components/ai-elements/prompt-input.tsx");

    expect(promptInput).toContain("inputGroupClassName?: string");
    expect(workspace).toContain("bg-[var(--background)]");
    expect(workspace).toContain("bg-[var(--surface-elevated)]");
    expect(workspace).toContain("focus-within:border-[var(--brand)]");
    expect(workspace).toContain("Enter để gửi · Shift + Enter để xuống dòng");
    expect(workspace).toContain("Hỏi về bằng chứng, lần quét, chủ đề");
    expect(workspace).toContain("loading ? <ChatHistorySkeleton");
    expect(workspace).toContain(
      "!loading && !failed && conversations.length === 0",
    );
    expect(workspace).toContain(
      'PromptInputFooter className="items-center bg-[var(--surface-elevated)]',
    );
    expect(workspace).toContain(
      'className="min-h-14 bg-[var(--surface-elevated)]',
    );
    expect(workspace).toContain("min-h-14");
    expect(workspace).not.toContain(
      'PromptInputFooter className="items-end border-t',
    );
    expect(workspace).toContain('aria-label="Đính kèm tệp"');
    expect(workspace).toContain('title="Đính kèm tệp"');
    expect(workspace).toContain('aria-label="Chọn mục tiêu trò chuyện"');
    expect(workspace).toContain("<Dialog open={contextOpen}");
    expect(workspace).toContain('aria-haspopup="dialog"');
    expect(workspace).toContain('aria-label="Mở ngữ cảnh và cấu hình"');
    expect(workspace).not.toContain("<aside");
    expect(workspace).not.toContain("xl:grid-cols-[minmax(0,1fr)_264px]");
    expect(workspace).not.toContain("Ngữ cảnh và cấu hình ·");
  });

  test("keeps all generated content internal and human reviewed", () => {
    const generation = read("lib/llm/generation.ts");
    const worker = read("lib/workers/scans.ts");
    expect(generation).toContain("never publish or automate posting");
    expect(worker).toContain('status: "needs_review"');
    expect(worker).toContain('"draft_generated"');
  });
});
