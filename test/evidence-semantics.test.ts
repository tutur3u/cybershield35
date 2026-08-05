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
	rankEvidenceRelationship,
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
		expect(text).toStartWith("Sự kiện:");
		expect(text).toContain(input.quote);
		expect(text).toContain(input.summary);
		expect(text).not.toContain(input.author);
		expect(text).not.toContain(input.sourceLabel);
	});

	test("does not duplicate summaries that are already a quote prefix", () => {
		const text = evidenceSemanticText({
			...input,
			quote: `${input.summary} Nội dung bổ sung.`,
		});
		expect(text).not.toContain("Diễn giải:");
	});

	test("reranks concrete event matches above same-source contextual similarity", () => {
		const target = relationshipInput(
			"Quán cho một cháu sạc xe điện, sau đó cháu tiện tay lấy luôn chiếc nón của chủ quán.",
			"Vụ lấy nón tại quán ở BMT.",
		);
		const sameContext = relationshipInput(
			"Khách sạc xe điện hơn một giờ tại quán cà phê rồi phàn nàn vì bị phụ thu.",
			"Tranh cãi phụ thu sạc xe tại quán ở BMT.",
		);
		const sharedTheft = relationshipInput(
			"Một người vào cửa hàng rồi tiện tay lấy chiếc mũ bảo hiểm của chủ quán.",
			"Vụ lấy mũ bảo hiểm tại cửa hàng.",
		);

		const contextualRank = rankEvidenceRelationship(target, sameContext, 0.85);
		const theftRank = rankEvidenceRelationship(target, sharedTheft, 0.78);

		expect(theftRank.score).toBeGreaterThan(contextualRank.score);
		expect(theftRank.reasons).toContain("Cùng hành vi trộm cắp");
		expect(contextualRank.relationship).not.toBe("same_event");
	});

	test("recognizes exact cross-scan copies and suppresses conflicting incidents", () => {
		const target = relationshipInput(
			"Người đàn ông lạ mặt tiếp cận và dẫn một bé gái đi nơi khác.",
			"Cảnh báo an toàn trẻ em tại Ea Kao.",
		);
		const exactCopy = { ...target, sourceUrl: "https://example.com/copy" };
		const traffic = relationshipInput(
			"Tài xế vượt đèn đỏ, gây va chạm giao thông nghiêm trọng.",
			"Một vụ vi phạm an toàn giao thông.",
		);

		const exactRank = rankEvidenceRelationship(target, exactCopy, 1);
		const trafficRank = rankEvidenceRelationship(target, traffic, 0.81);

		expect(exactRank.relationship).toBe("same_event");
		expect(exactRank.score).toBe(1);
		expect(exactRank.reasons).toContain("Nội dung trùng khớp");
		expect(trafficRank.score).toBeLessThan(RELATED_EVIDENCE_MIN_RELEVANCE);
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
		const server = readFileSync("lib/dashboard/timeline-server.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-shared.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-mapping.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-related.ts", "utf8") +
		readFileSync("lib/dashboard/timeline-triage.ts", "utf8");
		const worker = readFileSync("lib/workers/evidence-semantics.ts", "utf8");
		const migration = readFileSync("drizzle/0018_violet_wrecker.sql", "utf8");
		expect(server).toContain("cosineDistance");
		expect(server).toContain("RELATED_EVIDENCE_MIN_RELEVANCE");
		expect(server).toContain("getCachedRelatedEvidence");
		expect(server).toContain("cacheLife({ stale: 60");
		expect(server).toContain("rankEvidenceRelationship");
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
		expect(worker).toContain("MAX_BATCHES_PER_REBUILD_REQUEST = 7");
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

function relationshipInput(quote: string, summary: string) {
	return {
		author: "example-fanpage",
		publishedAt: "2026-08-01T13:26:32.000Z",
		quote,
		sourceUrl: null,
		summary,
		topicSlugs: [],
	};
}
