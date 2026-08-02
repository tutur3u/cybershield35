import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { EvidenceSemanticRebuildResult } from "@/components/dashboard/types";
import type { TuturuuuAdminSession } from "@/lib/auth/tuturuuu-session";
import { adminDb } from "@/lib/db/client";
import { evidenceItems, evidenceSemanticProfiles } from "@/lib/db/schema";
import {
	EVIDENCE_EMBEDDING_DIMENSIONS,
	EVIDENCE_EMBEDDING_MODEL,
	evidenceSemanticHash,
	evidenceSemanticText,
	type EvidenceSemanticInput,
} from "@/lib/domain/evidence-semantics";

const EMBEDDING_BATCH_SIZE = 64;
const EMBEDDING_CONCURRENCY = 3;

const embeddingResponseSchema = z.object({
	data: z.array(
		z.object({
			embedding: z.array(z.number().finite()).length(EVIDENCE_EMBEDDING_DIMENSIONS),
			index: z.number().int().nonnegative(),
		}),
	),
	model: z.string(),
});

type ProfileInput = EvidenceSemanticInput & { contentHash: string };

export async function rebuildEvidenceSemanticProfiles(
	session: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">,
	options: { force?: boolean } = {},
): Promise<EvidenceSemanticRebuildResult> {
	if (
		session.accessToken === "local-dev-bypass" ||
		!session.workspaceId ||
		!session.accessToken.startsWith("ttr_app_")
	) {
		throw new Error("Phiên Tuturuuu hiện tại không thể tạo semantic embedding.");
	}

	const [evidence, profiles] = await Promise.all([
		adminDb
			.select({
				author: evidenceItems.author,
				id: evidenceItems.id,
				quote: evidenceItems.quote,
				sourceLabel: evidenceItems.sourceLabel,
				summary: evidenceItems.summary,
			})
			.from(evidenceItems),
		adminDb
			.select({
				contentHash: evidenceSemanticProfiles.contentHash,
				evidenceItemId: evidenceSemanticProfiles.evidenceItemId,
			})
			.from(evidenceSemanticProfiles),
	]);
	const existing = new Map(
		profiles.map((profile) => [profile.evidenceItemId, profile.contentHash]),
	);
	const inputs: ProfileInput[] = evidence.map((item) => ({
		...item,
		contentHash: evidenceSemanticHash(item),
	}));
	const pending = options.force
		? inputs
		: inputs.filter((item) => existing.get(item.id) !== item.contentHash);
	const batches = chunk(pending, EMBEDDING_BATCH_SIZE);
	let failed = 0;
	let generated = 0;

	await runPool(batches, EMBEDDING_CONCURRENCY, async (batch) => {
		try {
			const embeddings = await createTuturuuuEmbeddings(session, batch);
			await adminDb.transaction(async (tx) => {
				for (const [index, item] of batch.entries()) {
					const embedding = embeddings[index];
					if (!embedding) throw new Error("Tuturuuu trả thiếu embedding.");
					await tx
						.insert(evidenceSemanticProfiles)
						.values({
							contentHash: item.contentHash,
							embedding,
							evidenceItemId: item.id,
							model: EVIDENCE_EMBEDDING_MODEL,
							updatedAt: new Date(),
						})
						.onConflictDoUpdate({
							set: {
								contentHash: item.contentHash,
								embedding,
								model: EVIDENCE_EMBEDDING_MODEL,
								updatedAt: new Date(),
							},
							target: evidenceSemanticProfiles.evidenceItemId,
						});
				}
			});
			generated += batch.length;
		} catch (error) {
			failed += batch.length;
			console.error("Evidence semantic embedding batch failed", {
				batchSize: batch.length,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	return {
		failed,
		generated,
		model: EVIDENCE_EMBEDDING_MODEL,
		skipped: evidence.length - pending.length,
		total: evidence.length,
	};
}

export async function invalidateEvidenceSemanticProfile(evidenceId: string) {
	await adminDb
		.delete(evidenceSemanticProfiles)
		.where(eq(evidenceSemanticProfiles.evidenceItemId, evidenceId));
}

async function createTuturuuuEmbeddings(
	session: Pick<TuturuuuAdminSession, "accessToken" | "workspaceId">,
	inputs: ProfileInput[],
) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 90_000);
	try {
		const response = await fetch(
			process.env.TUTURUUU_EMBEDDINGS_URL?.trim() ??
				"https://ai.tuturuuu.com/v1/embeddings",
			{
				body: JSON.stringify({
					dimensions: EVIDENCE_EMBEDDING_DIMENSIONS,
					input: inputs.map(evidenceSemanticText),
					model: EVIDENCE_EMBEDDING_MODEL,
				}),
				cache: "no-store",
				headers: {
					Authorization: `Bearer ${session.accessToken}`,
					"Content-Type": "application/json",
					"X-Request-Id": crypto.randomUUID(),
					"X-Tuturuuu-Workspace-Id": session.workspaceId ?? "",
				},
				method: "POST",
				signal: controller.signal,
			},
		);
		const body = await response.json().catch(() => null);
		if (!response.ok) {
			const message =
				body && typeof body === "object" && "error" in body
					? JSON.stringify(body.error)
					: `HTTP ${response.status}`;
			throw new Error(`Tuturuuu embeddings failed: ${message}`);
		}
		const parsed = embeddingResponseSchema.parse(body);
		if (parsed.data.length !== inputs.length) {
			throw new Error("Tuturuuu trả số lượng embedding không khớp.");
		}
		return parsed.data
			.toSorted((left, right) => left.index - right.index)
			.map((item) => item.embedding);
	} finally {
		clearTimeout(timeout);
	}
}

function chunk<T>(items: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size));
	}
	return result;
}

async function runPool<T>(
	items: T[],
	concurrency: number,
	run: (item: T) => Promise<void>,
) {
	let nextIndex = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (nextIndex < items.length) {
				const item = items[nextIndex];
				nextIndex += 1;
				if (item) await run(item);
			}
		}),
	);
}
