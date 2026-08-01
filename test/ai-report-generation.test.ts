import { describe, expect, test } from "bun:test";

import { reportAiOutputSchema } from "@/lib/llm/schemas";
import { readFileSync } from "node:fs";

const validReport = {
  title: "Báo cáo chuyên sâu về diễn biến thông tin",
  executiveSummary:
    "Báo cáo tổng hợp các dữ kiện chính, phân biệt rõ nội dung đã được nguồn xác nhận với nhận định cần kiểm chứng thêm, đồng thời nêu tác động và hướng xử lý ưu tiên cho đội ngũ vận hành.",
  sections: [
    {
      heading: "Bối cảnh và diễn biến",
      content:
        "Các bằng chứng được sắp xếp theo thời gian và nguồn phát sinh. Phần này làm rõ những điểm nhất quán giữa các nguồn, những khác biệt cần đối chiếu và mức độ ảnh hưởng có thể quan sát từ dữ liệu hiện có.",
      evidenceIds: ["evidence-1"],
    },
  ],
  keyFindings: ["Thông tin cốt lõi xuất hiện nhất quán trong nguồn đã chọn."],
  recommendations: [
    "Ưu tiên kiểm chứng các điểm còn khác biệt trước khi sử dụng bên ngoài.",
  ],
  limitations: ["Báo cáo chỉ dựa trên bằng chứng có trong lượt quét hiện tại."],
  reviewNotes: [
    "Con người cần duyệt lại số liệu và tên riêng trước khi phát hành.",
  ],
};

describe("AI report output", () => {
  test("accepts a structured, evidence-linked long-form report", () => {
    const result = reportAiOutputSchema.parse(validReport);

    expect(result.sections[0]?.evidenceIds).toEqual(["evidence-1"]);
    expect(result.limitations).toHaveLength(1);
  });

  test("rejects shallow report output", () => {
    expect(() =>
      reportAiOutputSchema.parse({
        ...validReport,
        executiveSummary: "Quá ngắn.",
        sections: [{ ...validReport.sections[0], content: "Thiếu chiều sâu." }],
      }),
    ).toThrow();
  });

  test("bounds evidence context and uses the gateway-compatible text path", () => {
    const generation = readFileSync("lib/llm/generation.ts", "utf8");
    expect(generation).toContain("const compactEvidence");
    expect(generation).toContain("text: plainTextReport");
    expect(generation).toContain("Trả về văn bản thuần, không JSON");
    expect(generation).toContain("toSorted");
    expect(generation).toContain("riskRank");
    expect(generation).toContain("options.analysis.claims.slice(0, 12)");
    const reportFunction = generation.slice(
      generation.indexOf("export async function generateInDepthReport"),
      generation.indexOf("export async function generateArticleRevision"),
    );
    expect(reportFunction).not.toContain("maxOutputTokens");
  });
});
