import { describe, expect, test } from "bun:test";
import { matchesFileAccept } from "../lib/chat/file-accept";

describe("chat file picker validation", () => {
  test("accepts advertised document extensions even without browser MIME metadata", () => {
    for (const name of ["notes.txt", "NOTES.MD", "data.csv", "data.json", "report.pdf", "report.docx", "sheet.xlsx", "slides.pptx"]) {
      expect(matchesFileAccept({ name, type: "" }, ".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.pptx,image/png")).toBe(true);
    }
  });
  test("preserves MIME wildcards and rejects unsupported or disguised extensions", () => {
    expect(matchesFileAccept({ name: "photo.jpg", type: "image/jpeg" }, "image/*")).toBe(true);
    expect(matchesFileAccept({ name: "photo.png", type: "image/png" }, "image/png")).toBe(true);
    expect(matchesFileAccept({ name: "note.txt.exe", type: "application/octet-stream" }, ".txt")).toBe(false);
    expect(matchesFileAccept({ name: "video.mp4", type: "video/mp4" }, ".txt,image/*")).toBe(false);
    expect(matchesFileAccept({ name: "file", type: "" }, " ")).toBe(true);
  });
});
