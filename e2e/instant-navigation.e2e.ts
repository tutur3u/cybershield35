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
		heading: "Chủ đề",
		to: "/topics",
	},
	{
		from: "/topics",
		heading: "Kho bằng chứng",
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
		heading: "Chat LLM",
		to: "/chat",
	},
] as const;

for (const navigation of instantNavigationCases) {
	test(`renders ${navigation.to} from the instant navigation cache`, async ({
		page,
	}) => {
		await page.goto(navigation.from);
		const destination = page
			.locator(`a[href="${navigation.to}"]`)
			.first();
		await destination.hover();
		await page.waitForLoadState("networkidle");

		await instant(page, async () => {
			await destination.click();
			await expect(
				page.getByRole("heading", { name: navigation.heading }),
			).toBeVisible();
		});

		await expect(page).toHaveURL(navigation.to);
		await expect(
			page.getByLabel("Đang tải bảng điều khiển"),
		).toHaveCount(0, { timeout: 15_000 });
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
		page.getByRole("heading", { name: "Tổng quan tình báo điều hành" }),
	).toBeVisible();
	await page.waitForTimeout(250);

	expect(healthRequests).toHaveLength(0);
});
