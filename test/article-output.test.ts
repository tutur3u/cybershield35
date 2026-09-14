import { expect, test } from "bun:test";
import { z } from "zod";
import { articleGenerationSchema, articleFromGeneration } from "@/lib/llm/article-output";
import { articleAiOutputSchema } from "@/lib/llm/schemas";
import { articleCompletionIssues } from "@/lib/llm/article-completion";

test("gateway blocks avoid unions and validate as editor content without unused fields", () => {
  const schema = z.toJSONSchema(articleGenerationSchema);
  expect(JSON.stringify(schema.properties?.blocks)).not.toMatch(/anyOf|oneOf/);
  const value = articleGenerationSchema.parse({author:"CS35",title:"Bản tin",description:"Nội dung đầy đủ.",coverUrl:"",commentsEnabled:true,reviewNotes:[],blocks:[
    {id:"body",type:"text",content:"Đoạn đầu hoàn chỉnh.\n\nĐoạn tiếp theo hoàn chỉnh.",url:"",caption:""},
    {id:"source",type:"text",content:"Nguồn: Báo Công lý: https://example.com/news",url:"",caption:""},
    {id:"image",type:"image",content:"",url:"https://example.com/image.jpg",caption:"Ảnh từ nguồn"},
  ]});
  const content = articleAiOutputSchema.parse(articleFromGeneration(value));
  expect(content.blocks[0]).not.toHaveProperty("url");
  expect(content.blocks[2]).not.toHaveProperty("content");
  expect(articleCompletionIssues(content,"draft")).toEqual([]);
  expect(articleAiOutputSchema.safeParse(articleFromGeneration({...value,blocks:[{...value.blocks[2]!,url:"bad"}]})).success).toBe(false);
  expect(articleCompletionIssues({...content,blocks:[{id:"broken",type:"text",content:"Đoạn này bị cắt dở\n\nNguồn: https://example.com"}]},"draft").length).toBeGreaterThan(0);
});
