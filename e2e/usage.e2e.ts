import { expect, test } from "@playwright/test";
import { expenseAnalytics } from "../lib/costs/expense-analytics";
import { summarizeUsage } from "../lib/costs/usage";
const now = new Date("2026-09-07T12:00:00Z");
const days = [
	{ day: "2026-09-07", amountUsd: 2, records: 1, synced: 1 },
	{ day: "2026-08-01", amountUsd: 3, records: 1, synced: 1 },
];
const base = {
	requests: 0,
	inputTokens: 0,
	outputTokens: 0,
	mode: "Nhà cung cấp",
	source: "provider_api",
};
const fixture = {
	...summarizeUsage(days, now),
	storageReady: true,
	providerSync: [{ provider: "apify", records: 2, synced: 2 }],
	observedAt: now.toISOString(),
	studioUrl: "https://ai.tuturuuu.com/test/usage",
	aiStatus: "ready",
	aiThrough: now.toISOString(),
	browserStatus: "ready",
	firecrawl: { status: "ready", remaining: 100, plan: 1000 },
	chat: { requests: 10, tokens: 500, requests30: 3, tokens30: 100 },
	bill: expenseAnalytics(
		[
			...days.map((row) => ({
				...base,
				day: row.day,
				amountUsd: row.amountUsd,
				provider: "Apify",
				service: "Thu thập",
			})),
			{
				...base,
				day: "2026-09-07",
				amountUsd: 0.5,
				provider: "AI",
				service: "google/gemini · analysis",
				mode: "AI nền",
				requests: 5,
				inputTokens: 100,
				outputTokens: 50,
			},
		],
		now,
	),
};

test.beforeEach(async ({ page }) => {
	await page.route("**/api/usage", (route) => route.fulfill({ json: fixture }));
	await page.route("**/api/**", (route) =>
		["GET", "HEAD"].includes(route.request().method())
			? route.fallback()
			: route.abort(),
	);
});

test("usage ledger, periods, export and responsive layouts", async ({
	page,
}, info) => {
	await page.goto("/usage");
	await expect(
		page.getByRole("heading", { name: "Mức sử dụng & chi phí" }),
	).toBeVisible({ timeout: 45000 });
	await expect(
		page.getByRole("heading", { name: "Toàn thời gian", exact: true }),
	).toBeVisible({ timeout: 45000 });
	await expect(
		page
			.getByRole("table", { name: "Lịch sử chi phí hàng ngày" })
			.locator("tbody tr")
			.first(),
	).toBeVisible();
	const recentCount = await page
		.getByRole("table", { name: "Lịch sử chi phí hàng ngày" })
		.locator("tbody tr")
		.count();
	expect(recentCount).toBeLessThanOrEqual(30);
	await page.getByLabel("Khoảng thời gian chi phí").selectOption("all");
	expect(
		await page
			.getByRole("table", { name: "Lịch sử chi phí hàng ngày" })
			.locator("tbody tr")
			.count(),
	).toBeGreaterThanOrEqual(recentCount);
	const download = page.waitForEvent("download");
	await page.getByRole("button", { name: "Xuất CSV" }).click();
	expect((await download).suggestedFilename()).toMatch(/^cs35-usage-.*\.csv$/);
	await page.screenshot({
		path: info.outputPath("usage-desktop.png"),
		fullPage: true,
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await page.evaluate(() =>
		document.documentElement.setAttribute("data-theme", "dark"),
	);
	await expect
		.poll(() =>
			page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		)
		.toBe(true);
	await page.screenshot({
		path: info.outputPath("usage-mobile-dark.png"),
		fullPage: true,
	});
});

test("usage failure is retryable and does not show zero costs", async ({
	page,
}) => {
	await page.route("**/api/usage", (route) =>
		route.fulfill({
			status: 503,
			contentType: "application/json",
			body: '{"error":"unavailable"}',
		}),
	);
	await page.goto("/usage");
	await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible({
		timeout: 45000,
	});
	await expect(
		page.getByRole("heading", { name: "Toàn thời gian", exact: true }),
	).toHaveCount(0);
	await page.unroute("**/api/usage");
	await page.route("**/api/usage", (route) => route.fulfill({ json: fixture }));
	await page.getByRole("button", { name: "Thử lại" }).click();
	await expect(
		page.getByRole("heading", { name: "Toàn thời gian", exact: true }),
	).toBeVisible({ timeout: 45000 });
});

test("overview prioritizes workload and links to first-class usage", async ({
	page,
}, info) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Nhịp công việc" }),
	).toBeVisible({ timeout: 45000 });
	await expect(page.getByRole("link", { name: "Xem chi phí" })).toBeVisible();
	await page.screenshot({
		path: info.outputPath("overview-desktop.png"),
		fullPage: true,
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await expect
		.poll(() =>
			page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		)
		.toBe(true);
	await page.screenshot({
		path: info.outputPath("overview-mobile.png"),
		fullPage: true,
	});
	await page.getByRole("link", { name: "Xem chi phí" }).click();
	await expect(page).toHaveURL(/\/usage$/);
	await expect(
		page.getByRole("heading", { name: "Mức sử dụng & chi phí" }),
	).toBeVisible();
});
