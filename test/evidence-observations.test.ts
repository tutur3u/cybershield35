import { expect, test } from "bun:test";
import { uniqueEvidenceObservations } from "@/lib/domain/evidence-observations";

test("same-post retries count once while changed text and unlinked evidence remain distinct", () => {
  const rows = [
    { id: "first", sourceUrl: "https://example.com/post/1", quote: "Original" },
    { id: "retry", sourceUrl: "https://example.com/post/1", quote: "Original" },
    { id: "edited", sourceUrl: "https://example.com/post/1", quote: "Updated" },
    { id: "other", sourceUrl: "https://example.com/post/2", quote: "Original" },
    { id: "text1", sourceUrl: null, quote: "Original" },
    { id: "text2", sourceUrl: null, quote: "Original" },
  ];
  expect(uniqueEvidenceObservations(rows).map((row) => row.id)).toEqual(["first", "edited", "other", "text1", "text2"]);
});
