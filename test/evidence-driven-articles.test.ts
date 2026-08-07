import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("evidence-driven article creation", () => {
	test("orders the default article catalog by creation time", () => {
		const store = read("lib/articles/store.ts");
		const workspace = read("components/dashboard/articles-workspace.tsx");
		const route = read("app/api/articles/route.ts");

		expect(store).toContain(
			".orderBy(desc(articles.createdAt), desc(articles.id))",
		);
		expect(store).toContain("[desc(articles.createdAt), desc(articles.id)]");
		expect(store).toContain("[asc(articles.createdAt), asc(articles.id)]");
		expect(workspace).toContain('useState<ArticleListFilters["sort"]>("created_desc")');
		expect(workspace).toContain('["created_desc", "Mới tạo"]');
		expect(route).toContain('sort === "created_desc"');
		expect(route).toContain('sort === "created_asc"');
	});

	test("keeps native article creation on evidence surfaces only", () => {
		const catalogRoute = read("app/api/articles/route.ts");
		const evidenceRoute = read("app/api/evidence/[id]/article/route.ts");
		const redirect = read("app/articles/new/page.tsx");
		const workspace = read("components/dashboard/articles-workspace.tsx");
		const chatTools = read("lib/chat/tools.ts");

		expect(catalogRoute).not.toContain("export async function POST");
		expect(evidenceRoute).toContain("const article = await createArticle(");
		expect(evidenceRoute).not.toContain("findArticleIdByOriginDraftId");
		expect(evidenceRoute).not.toContain("originEvidenceItemId),");
		expect(redirect).toContain('permanentRedirect("/evidence")');
		expect(workspace).not.toContain('href="/articles/new"');
		expect(chatTools).not.toContain("createArticle: tool({");
	});

	test("creates from both evidence views and blocks repeated clicks only while pending", () => {
		const client = read("lib/articles/client-queries.ts");
		const timeline = read("components/dashboard/evidence-timeline/index.tsx");
		const details = read("components/dashboard/evidence-details-page.tsx");

		expect(client).toContain("export function createArticleFromEvidence");
		expect(client).toContain("method: \"POST\"");
		expect(timeline).toContain("createArticleFromEvidence(post.id)");
		expect(details).toContain("mutationFn: createArticleFromEvidence");
		expect(details).toContain("disabled={articleMutation.isPending}");
		expect(details).toContain("articleMutation.mutate(evidence.id)");
	});

	test("retires automatic drafting without deleting its history", () => {
		const scanStages = read("lib/workers/scan-stages.ts");
		const scheduler = read("lib/managed-scheduler/server.ts");
		const migration = read("drizzle/0025_retire_automatic_drafting.sql");
		const schema = read("lib/db/schema.ts");

		expect(scanStages).not.toContain("enqueueEvidenceDraftJobs");
		expect(scheduler).not.toContain("processNextAutomatedDraftJob");
		expect(migration).toContain('"auto_draft_enabled" = false');
		expect(migration).toContain("WHERE \"status\" IN ('queued', 'running', 'retrying')");
		expect(migration).toContain('"status" = \'skipped\'');
		expect(schema).toContain('"draft_automation_jobs"');
	});
});
