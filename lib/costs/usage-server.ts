import { readBrowserUsage, readFirecrawlCredits } from "./other-usage-server";
import { readAiUsage } from "./ai-usage-server";
import {
	expenseAnalytics,
	mergeBrowserExpenses,
	type ExpenseLine,
} from "./expense-analytics";
import "server-only";
import { adminSqlClient as sql } from "@/lib/db/client";
import { aiStudioWorkspaceUrl } from "@/lib/tuturuuu/ai-studio-links";
import { summarizeUsage, type UsageOverview } from "./usage";
import { parseBillingInvoices } from "./invoices";

export async function getUsageOverview(
	accessToken?: string,
): Promise<UsageOverview> {
	const workspace =
		process.env.TUTURUUU_AI_WORKSPACE_ID?.trim() ||
		process.env.TUTURUUU_CYBERSHIELD35_WORKSPACE_ID?.trim() ||
		"";
	const now = new Date();
	const invoices = parseBillingInvoices(process.env.CS35_BILLING_INVOICES_JSON);
	const { from } = summarizeUsage([], now);
	const [storage] = await sql<
		{ ready: boolean }[]
	>`select to_regclass('public.provider_account_costs') is not null as ready`;
	const [days, chatRows, ai, browser, firecrawl] = await Promise.all([
		storage?.ready
			? sql<
					{
						provider: string;
						account_id: string;
						day: string;
						amount: string;
						records: number;
						synced: number;
						observed: string;
					}[]
				>`
   select provider, account_id, day::text, sum(amount_usd)::text as amount, count(*)::int as records,
    count(*) filter(where synced_at is not null and synced_workspace_id = ${workspace})::int as synced,
    max(observed_at)::text as observed
   from provider_account_costs group by provider, account_id, day order by day desc
  `
			: Promise.resolve([]),
		sql<
			{
				requests: number;
				tokens: string;
				requests30: number;
				tokens30: string;
			}[]
		>`
   select count(*)::int as requests, coalesce(sum(total_tokens), 0)::text as tokens,
    count(*) filter(where started_at >= ${`${from}T00:00:00Z`}::timestamptz)::int as requests30,
    coalesce(sum(total_tokens) filter(where started_at >= ${`${from}T00:00:00Z`}::timestamptz), 0)::text as tokens30
   from chat_model_runs
  `,
		readAiUsage(workspace, accessToken),
		readBrowserUsage(),
		readFirecrawlCredits(),
	]);
	const chat = chatRows[0];
	const expenses: ExpenseLine[] = days.map((row) => ({
		day: row.day,
		provider:
			row.provider === "apify"
				? "Apify"
				: row.provider === "vercel"
					? "Vercel"
					: row.provider === "browser_use"
						? "Browser Use"
						: row.provider,
		service:
			row.provider === "vercel"
				? row.account_id.replace(/^prj_[^-]+-/, "").replaceAll("_", " ")
				: row.provider === "browser_use"
					? "Phiên trình duyệt"
					: "Thu thập & lưu trữ",
		mode: "Nhà cung cấp",
		amountUsd: Number(row.amount),
		requests: 0,
		inputTokens: 0,
		outputTokens: 0,
		source:
			row.provider === "vercel"
				? "vercel_billed_cost"
				: row.provider === "browser_use"
					? "browser_use_saved_usage"
					: "apify_account_api",
	}));
	for (const row of ai.data?.rows ?? [])
		expenses.push({
			day: row.day,
			provider: "AI",
			service: `${row.model} · ${row.feature}`,
			mode: row.executionMode === "background" ? "AI nền" : "AI tương tác",
			amountUsd: row.amountUsd,
			requests: row.requests,
			inputTokens: row.inputTokens,
			outputTokens: row.outputTokens,
			source: "tuturuuu_ai_metering",
		});
	for (const invoice of invoices) {
		if (days.some((row) => row.provider === invoice.provider))
			throw new Error(
				"Invoice and consumption coverage require reconciliation before combining",
			);
		expenses.push({
			day: invoice.issuedOn,
			provider: invoice.provider === "neon" ? "Neon" : "Firecrawl",
			service: `Hóa đơn ${invoice.reference}`,
			mode: "Hóa đơn đã thanh toán",
			amountUsd: invoice.amountUsd,
			requests: 0,
			inputTokens: 0,
			outputTokens: 0,
			source: "reviewed_provider_invoice",
		});
	}

	return {
		invoices,
		...summarizeUsage(
			days
				.filter((row) => row.provider === "apify")
				.map((row) => ({
					day: row.day,
					amountUsd: Number(row.amount),
					records: row.records,
					synced: row.synced,
				})),
			now,
		),
		bill: expenseAnalytics(mergeBrowserExpenses(expenses, browser.lines), now),
		providerSync: [...new Set(days.map((row) => row.provider))].map(
			(provider) => ({
				provider,
				records: days
					.filter((row) => row.provider === provider)
					.reduce((n, row) => n + row.records, 0),
				synced: days
					.filter((row) => row.provider === provider)
					.reduce((n, row) => n + row.synced, 0),
			}),
		),
		browserStatus: browser.status,
		firecrawl,
		aiStatus: ai.status,
		aiThrough: ai.data?.to ?? null,
		storageReady: Boolean(storage?.ready),
		observedAt:
			days
				.filter((row) => row.provider === "apify")
				.map((row) => new Date(row.observed).toISOString())
				.sort()
				.at(-1) ?? null,
		studioUrl: aiStudioWorkspaceUrl("usage"),
		integrationsUrl: aiStudioWorkspaceUrl("integrations"),
		chat: {
			requests: chat?.requests ?? 0,
			tokens: Number(chat?.tokens ?? 0),
			requests30: chat?.requests30 ?? 0,
			tokens30: Number(chat?.tokens30 ?? 0),
		},
	};
}
