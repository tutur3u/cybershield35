import { expect, test } from "bun:test";
import { scopeArticleProposal } from "../lib/articles/ai-action-scope";
import type { ArticleContent } from "../lib/articles/schemas";

test("field actions cannot replace body, media or authorship with unsolicited model edits", () => {
  const current: ArticleContent = { title: "Gốc", description: "Trích yếu gốc.", author: "Tác giả", coverUrl: "https://example.com/cover.png", commentsEnabled: false, blocks: [{ id: "one", type: "text", content: "Nội dung gốc." }] };
  const proposed: ArticleContent & {reviewNotes:string[]} = { ...current, title: "Mới", description: "Trích yếu mới.", author: "AI", coverUrl: null, commentsEnabled: true, blocks: [], reviewNotes: ["Luận điểm cần nguồn."] };
  expect(scopeArticleProposal("claim_check", current, proposed)).toEqual({ ...current, reviewNotes: proposed.reviewNotes });
  expect(scopeArticleProposal("title_description", current, proposed)).toEqual({ ...current, title: proposed.title, description: proposed.description, reviewNotes: proposed.reviewNotes });
  expect(scopeArticleProposal("description", current, proposed)).toEqual({ ...current, description: proposed.description, reviewNotes: proposed.reviewNotes });
  expect(scopeArticleProposal("rewrite", current, proposed)).toEqual(proposed);
});
