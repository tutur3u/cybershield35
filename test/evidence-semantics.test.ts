import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	EVIDENCE_EMBEDDING_DIMENSIONS,
	EVIDENCE_EMBEDDING_MODEL,
	LOCAL_EVIDENCE_EMBEDDING_MODEL,
	LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE,
	RELATED_EVIDENCE_MIN_RELEVANCE,
	evidenceSemanticHash,
	evidenceSemanticText,
	localEvidenceEmbedding,
} from "@/lib/domain/evidence-semantics";

const input = {
	author: "Trang cộng đồng",
	id: "00000000-0000-4000-8000-000000000001",
	quote: "Một người lấy mũ bảo hiểm sau khi sạc xe điện.",
	sourceLabel: "Tin địa phương",
	summary: "Sự việc lấy mũ bảo hiểm.",
};

describe("evidence semantic relationships", () => {
	test("grounds embeddings in the concrete event fields", () => {
		const text = evidenceSemanticText(input);
		expect(text).toContain("sự kiện, chủ thể, hành vi và mối lo ngại cụ thể");
		expect(text).toContain(input.quote);
		expect(text).toContain(input.summary);
	});

	test("uses a stable content hash and a strict relevance floor", () => {
		expect(evidenceSemanticHash(input)).toBe(evidenceSemanticHash({ ...input }));
		expect(evidenceSemanticHash(input)).not.toBe(
			evidenceSemanticHash({ ...input, quote: `${input.quote} Khác.` }),
		);
		expect(EVIDENCE_EMBEDDING_MODEL).toBe("google/gemini-embedding-2");
		expect(EVIDENCE_EMBEDDING_DIMENSIONS).toBe(768);
		expect(LOCAL_EVIDENCE_EMBEDDING_MODEL).toStartWith("local/");
		expect(LOCAL_RELATED_EVIDENCE_MIN_RELEVANCE).toBeGreaterThanOrEqual(0.5);
		expect(RELATED_EVIDENCE_MIN_RELEVANCE).toBeGreaterThanOrEqual(0.7);
	});

	test("the private fallback separates petty theft from traffic incidents", () => {
		const theft = localEvidenceEmbedding(input);
		const relatedTheft = localEvidenceEmbedding({
			...input,
			id: "00000000-0000-4000-8000-000000000002",
			quote: "Khách vào quán rồi tiện tay lấy luôn chiếc mũ của chủ quán.",
			summary: "Một vụ lấy mũ tại quán.",
		});
		const traffic = localEvidenceEmbedding({
			...input,
			id: "00000000-0000-4000-8000-000000000003",
			quote: "Tài xế vi phạm giao thông, vượt đèn đỏ và gây va chạm.",
			summary: "Một vụ vi phạm giao thông.",
		});
		expect(cosine(theft, relatedTheft)).toBeGreaterThan(cosine(theft, traffic));
	});

	test("queries the whole corpus with pgvector and hides weak matches", () => {
		const server = readFileSync("lib/dashboard/timeline-server.ts", "utf8");
		const worker = readFileSync("lib/workers/evidence-semantics.ts", "utf8");
		const migration = readFileSync("drizzle/0018_violet_wrecker.sql", "utf8");
		expect(server).toContain("cosineDistance");
		expect(server).toContain("RELATED_EVIDENCE_MIN_RELEVANCE");
		expect(server).toContain("ne(evidenceItems.id, evidenceId)");
		expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS vector");
		expect(migration).toContain("USING hnsw");
		expect(migration).toContain("halfvec_cosine_ops");
		expect(worker).toContain("tuturuuuAllowsEmbeddingModel");
		expect(worker).toContain("model.id === EVIDENCE_EMBEDDING_MODEL");
		expect(worker).not.toContain('tuturuuu?.type === "embedding"');
		expect(worker).toContain("batch.map(localEvidenceEmbedding)");
		expect(worker).toContain("projectEmbedding(item.embedding)");
		expect(worker).toContain("const EMBEDDING_CONCURRENCY = 1");
		expect(worker).toContain(".min(EVIDENCE_EMBEDDING_DIMENSIONS)");
		expect(worker).not.toContain(
			"dimensions: EVIDENCE_EMBEDDING_DIMENSIONS",
		);
		expect(worker).not.toContain("GOOGLE_GENERATIVE_AI_API_KEY");
	});
});

function cosine(left: number[], right: number[]) {
	return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}
