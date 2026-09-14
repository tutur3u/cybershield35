import { z } from "zod";

// Keep the provider wire schema simple: the external Google gateway rejects
// nested unions and some JSON Schema constraints. Validate editor limits after
// decoding, rather than asking the gateway to interpret them.
export const articleGenerationSchema = z.object({
  author: z.string(),
  title: z.string(),
  description: z.string(),
  coverUrl: z.string(),
  commentsEnabled: z.boolean(),
  reviewNotes: z.array(z.string()),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.enum(["text", "image"]),
    content: z.string(),
    url: z.string(),
    caption: z.string(),
  })),
});

export function articleFromGeneration(value: z.infer<typeof articleGenerationSchema>) {
  return {
    ...value,
    coverUrl: value.coverUrl || null,
    blocks: value.blocks.map(block => block.type === "text"
      ? { id: block.id, type: block.type, content: block.content }
      : { id: block.id, type: block.type, url: block.url, ...(block.caption ? { caption: block.caption } : {}) }),
  };
}
