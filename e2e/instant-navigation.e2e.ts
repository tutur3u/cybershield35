import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const instantNavigationCases = [
	{
		from: "/",
		heading: "Nguồn & Quét",
		to: "/sources",
	},
	{
		from: "/sources",
		heading: "Vận hành hệ thống",
		to: "/operations",
	},
	{
		from: "/operations",
		heading: "Phân tích",
		to: "/intelligence",
	},
	{
		from: "/intelligence",
		heading: "Dòng thời gian",
		to: "/evidence",
	},
	{
		from: "/",
		heading: "Hướng dẫn sử dụng",
		to: "/guides/user-guide",
	},
	{
		from: "/guides/user-guide",
		heading: "Cấu hình",
		to: "/settings",
	},
	{
		from: "/settings",
		heading: "Chat",
		to: "/chat",
	},
] as const;

for (const navigation of instantNavigationCases) {
	test(`acknowledges ${navigation.to} navigation before dynamic data`, async ({
		page,
	}) => {
		await page.goto(navigation.from);
		const destination = page.locator(`a[href="${navigation.to}"]`).first();
		await destination.hover();
		await page.waitForLoadState("networkidle");

		await instant(page, async () => {
			await destination.click();
			// Request-scoped data is deliberately deferred by instant(). The
			// cached shell or immediate link feedback must acknowledge the click.
			await expect(
				page
					.getByRole("heading", { exact: true, name: navigation.heading })
					.or(page.getByLabel("Đang tải bảng điều khiển"))
					.or(page.getByLabel("Đang chuẩn bị dữ liệu phân tích gần nhất"))
					.or(page.getByLabel("Đang tải Chat"))
					.or(page.getByRole("status", { name: "Đang mở trang" }))
					.first(),
			).toBeVisible();
		});

		await expect(page).toHaveURL(navigation.to, { timeout: 30000 });
		await expect(
			page.getByRole("heading", { exact: true, name: navigation.heading }),
		).toBeVisible({ timeout: 30000 });
		await expect(page.getByLabel("Đang tải bảng điều khiển")).toHaveCount(0, {
			timeout: 15_000,
		});
	});
}

test("does not fetch operational health before settings is opened", async ({
	page,
}) => {
	const healthRequests: string[] = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname === "/api/health") {
			healthRequests.push(request.url());
		}
	});

	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Tổng quan", exact: true }),
	).toBeVisible();
	await page.waitForTimeout(250);

	expect(healthRequests).toHaveLength(0);
});
