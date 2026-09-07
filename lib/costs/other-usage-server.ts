import "server-only";
import { z } from "zod";
import type { ExpenseLine } from "./expense-analytics";

const sessionSchema = z.object({
	id: z.string(),
	createdAt: z.string().datetime({ offset: true }),
	totalCostUsd: z
		.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
		.transform(Number)
		.pipe(z.number().finite().nonnegative()),
	totalInputTokens: z.number().optional(),
	totalOutputTokens: z.number().optional(),
});
const sessionsSchema = z.object({
	sessions: z.array(sessionSchema),
	total: z.number().int().nonnegative(),
});
export async function readBrowserUsage(): Promise<{
	status: string;
	lines: ExpenseLine[];
	accountId?: string;
}> {
	const key = process.env.BROWSER_USE_API_KEY?.trim();
	if (!key) return { status: "unconfigured", lines: [] };
	try {
		const signal = AbortSignal.timeout(20_000);
		const billingResponse = await fetch(
			"https://api.browser-use.com/api/v2/billing/account",
			{ headers: { "X-Browser-Use-API-Key": key }, cache: "no-store", signal },
		);
		if (!billingResponse.ok) throw new Error("Account identity unavailable");
		const account = z
			.object({ projectId: z.string().regex(/^[a-zA-Z0-9_-]+$/) })
			.parse(await billingResponse.json());
		const sessions = new Map<string, z.infer<typeof sessionSchema>>();
		for (let page = 1; page <= 100; page++) {
			const response = await fetch(
				`https://api.browser-use.com/api/v3/sessions?page=${page}&page_size=100`,
				{
					headers: { "X-Browser-Use-API-Key": key },
					cache: "no-store",
					signal,
				},
			);
			if (!response.ok) throw new Error("Billing unavailable");
			const data = sessionsSchema.parse(await response.json());
			for (const session of data.sessions) sessions.set(session.id, session);
			if (sessions.size >= data.total)
				return {
					status: "ready",
					accountId: account.projectId,
					lines: [...sessions.values()].map((row) => ({
						day: new Date(row.createdAt).toISOString().slice(0, 10),
						provider: "Browser Use",
						service: "Phiên trình duyệt",
						mode: "Nhà cung cấp",
						amountUsd: row.totalCostUsd,
						requests: 1,
						inputTokens: row.totalInputTokens ?? 0,
						outputTokens: row.totalOutputTokens ?? 0,
						source: "browser_use_session_api",
					})),
				};
			if (!data.sessions.length) throw new Error("Incomplete session history");
		}
		throw new Error("Incomplete session history");
	} catch {
		return { status: "unavailable", lines: [] };
	}
}
export async function readFirecrawlCredits() {
	const key = process.env.FIRECRAWL_API_KEY?.trim();
	if (!key) return { status: "unconfigured", remaining: null, plan: null };
	try {
		const response = await fetch(
			"https://api.firecrawl.dev/v2/team/credit-usage",
			{
				headers: { Authorization: `Bearer ${key}` },
				cache: "no-store",
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!response.ok) throw new Error("Credits unavailable");
		const data = z
			.object({
				success: z.literal(true),
				data: z.object({
					remainingCredits: z.number().finite(),
					planCredits: z.number().finite(),
				}),
			})
			.parse(await response.json());
		return {
			status: "ready",
			remaining: data.data.remainingCredits,
			plan: data.data.planCredits,
		};
	} catch {
		return { status: "unavailable", remaining: null, plan: null };
	}
}
