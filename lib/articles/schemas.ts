import { z } from "zod";

export const articleTextBlockSchema = z
	.object({
		content: z.string().max(20_000),
		id: z.string().min(1).max(80),
		type: z.literal("text"),
	})
	.strict();

export const articleImageBlockSchema = z
	.object({
		caption: z.string().trim().max(300).optional(),
		id: z.string().min(1).max(80),
		type: z.literal("image"),
		url: z.string().url().max(2_000),
	})
	.strict();

export const articleBlockSchema = z.discriminatedUnion("type", [
	articleTextBlockSchema,
	articleImageBlockSchema,
]);

export const articleContentSchema = z
	.object({
		author: z.string().trim().max(50).default(""),
		blocks: z.array(articleBlockSchema).max(100).default([]),
		commentsEnabled: z.boolean().default(true),
		coverUrl: z.string().url().max(2_000).nullable().optional(),
		description: z.string().trim().max(300).default(""),
		title: z.string().trim().max(150).default(""),
	})
	.strict();

export const articleUpdateSchema = articleContentSchema
	.partial()
	.extend({
		targetOaConnectionId: z.string().uuid().nullable().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, "Missing article update")
	.strict();

export const articleReviewSchema = z
	.object({
		status: z.enum(["draft", "needs_review", "approved", "rejected"]),
	})
	.strict();

export const articleScheduleSchema = z
	.object({
		scheduledAt: z.string().datetime({ offset: true }),
	})
	.strict();

export const articleEvidenceSchema = z
	.object({
		evidenceItemIds: z.array(z.string().uuid()).min(1).max(100),
	})
	.strict();

export const articleAiSchema = z
	.object({
		action: z.enum([
			"draft",
			"outline",
			"rewrite",
			"shorten",
			"expand",
			"title_description",
			"claim_check",
		]),
		context: z.string().trim().max(20_000).optional(),
		editorialIntent: z
			.enum(["counter_argument", "support", "balanced"])
			.default("counter_argument"),
		instruction: z.string().trim().max(2_000).optional(),
		model: z.string().trim().min(1).max(120).optional(),
		tone: z.string().trim().min(1).max(120).default("Điềm tĩnh, khách quan"),
		voice: z.string().trim().min(1).max(120).default("Tự nhiên, gần gũi"),
	})
	.strict();

export const articleIdSchema = z.string().uuid();

export const articleWorkspaceSettingsSchema = z
	.object({
		autoSyncDrafts: z.boolean(),
	})
	.strict();

export const articleBulkActionSchema = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("set_review_status"),
			articleIds: z.array(articleIdSchema).min(1).max(100),
			status: z.enum(["draft", "needs_review", "approved", "rejected"]),
		})
		.strict(),
	z
		.object({
			// `publish` is here too: making an article visible is the operation
			// operators most often want to repeat across a batch, and the per-item
			// guards still apply, so an unapproved article fails on its own rather
			// than blocking the rest.
			action: z.enum(["sync_hidden", "publish", "hide", "delete"]),
			articleIds: z.array(articleIdSchema).min(1).max(100),
		})
		.strict(),
]);

export type ArticleBlock = z.infer<typeof articleBlockSchema>;
export type ArticleContent = z.infer<typeof articleContentSchema>;
