import { expect, test } from "@playwright/test";

const routes = [
	"/",
	"/sources",
	"/sources?view=pages",
	"/sources?view=automation",
	"/sources?view=queue",
	"/intelligence",
	"/intelligence?view=topics",
	"/intelligence?view=alerts",
	"/intelligence?view=sources",
	"/evidence",
	"/articles",
	"/chat",
	"/members",
	"/audit",
	"/settings",
	"/operations",
	"/operations?view=services",
	"/operations?view=costs",
	"/operations?view=activity",
	"/guides/user-guide",
	"/guides/5-step-process",
	"/guides/policies",
];

// This suite reads configured data. It must never publish, invite, scan or call AI.
test.beforeEach(async ({ page }) => {
	await page.route("**/api/**", (route) =>
		["GET", "HEAD"].includes(route.request().method())
			? route.continue()
			: route.abort(),
	);
});

for (const route of routes) {
	test(`workspace route ${route} renders on desktop and mobile`, async ({
		page,
	}, testInfo) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.setViewportSize({ width: 1440, height: 1000 });
		const response = await page.goto(route);
		expect(response?.status()).toBeLessThan(400);
		await expect(page.locator("h1").first()).toBeVisible({ timeout: 45000 });
		await expect(
			page.getByRole("heading", { name: "Không thể tải trang này" }),
		).toHaveCount(0);
		await expect(page.getByLabel("Đang tải bảng điều khiển")).toHaveCount(0, {
			timeout: 45000,
		});
		await page.screenshot({ path: testInfo.outputPath("desktop.png") });
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.locator("h1").first()).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
		await page.screenshot({ path: testInfo.outputPath("mobile.png") });
		await page.evaluate(() =>
			document.documentElement.setAttribute("data-theme", "dark"),
		);
		await page.screenshot({ path: testInfo.outputPath("mobile-dark.png") });
		expect(errors).toEqual([]);
	});
}

const redirects = [
	["/topics", "/intelligence?view=topics"],
	["/analysis", "/intelligence?view=overview"],
	["/alerts", "/intelligence?view=alerts"],
	["/drafts", "/articles"],
	["/counter-arguments", "/articles"],
	["/reports", "/articles"],
	["/articles/new", "/evidence"],
];
for (const [from, to] of redirects)
	test(`legacy route ${from} reaches ${to}`, async ({ page }) => {
		await page.goto(from!);
		await expect(page).toHaveURL(new RegExp(`${to!.replace(/[?]/g, "\\?")}$`));
		await expect(page.locator("h1").first()).toBeVisible();
	});

test("operations tabs support keyboard, URLs, filtering and cancelled maintenance", async ({
	page,
}) => {
	await page.goto("/operations");
	const overview = page.getByRole("tab", { name: "Tổng quan", exact: true });
	await overview.focus();
	await page.keyboard.press("ArrowRight");
	await expect(
		page.getByRole("tab", { name: "Kết nối & bảo trì" }),
	).toBeFocused();
	await expect(page).toHaveURL(/view=services/);
	await page.getByRole("button", { name: "Dọn tệp Drive" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("tab", { name: "Kết nối & bảo trì" }).focus();
	await page.keyboard.press("End");
	await expect(page.getByRole("tab", { name: "Nhật ký xử lý" })).toBeFocused();
	await page.keyboard.press("Home");
	await page
		.getByRole("textbox", { name: "Tìm lượt quét" })
		.fill("__no_matching_scan__");
	await expect(
		page.getByText("Không có lượt quét phù hợp bộ lọc."),
	).toBeVisible();
	await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
	await expect(
		page.getByRole("textbox", { name: "Tìm lượt quét" }),
	).toHaveValue("");
	await page.getByRole("tab", { name: "Chi phí & AI" }).click();
	await expect(
		page.getByRole("heading", { name: "Chi phí nhà cung cấp", exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(page.getByRole("tab", { name: "Chi phí & AI" })).toHaveAttribute(
		"aria-selected",
		"true",
	);
});

test("operations preserves old data with a visible retry when refresh fails", async ({
	page,
}) => {
	await page.goto("/operations");
	await expect(
		page.getByRole("textbox", { name: "Tìm lượt quét" }),
	).toBeVisible();
	await page.route("**/api/operations/overview", (route) =>
		route.fulfill({ status: 503, json: { error: "Unavailable" } }),
	);
	await page.getByRole("button", { name: "Làm mới", exact: true }).click();
	await expect(
		page.getByRole("alert").filter({ hasText: "Không thể làm mới" }),
	).toContainText("Dữ liệu bên dưới là lần tải thành công gần nhất", {
		timeout: 20000,
	});
	await expect(
		page.getByRole("textbox", { name: "Tìm lượt quét" }),
	).toBeVisible();
});

for (const [list, selector] of [
	["/articles", 'a[href^="/articles/"]'],
	["/evidence", 'a[href^="/evidence/"]'],
	["/intelligence?view=topics", 'a[href^="/topics/"]'],
	["/operations", 'a[href^="/scans/"]'],
]) {
	test(`existing detail from ${list} supports desktop and mobile`, async ({
		page,
	}, testInfo) => {
		await page.goto(list!);
		const link = page.locator(selector!).first();
		await expect(link).toBeVisible({ timeout: 30000 });
		const href = await link.getAttribute("href");
		await page.goto(href!);
		await expect(page.locator("h1").first()).toBeVisible({ timeout: 45000 });
		await expect(
			page.getByRole("heading", { name: "Không thể tải trang này" }),
		).toHaveCount(0);
		await page.screenshot({ path: testInfo.outputPath("detail-desktop.png") });
		await page.setViewportSize({ width: 390, height: 844 });
		await expect
			.poll(() =>
				page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			)
			.toBe(true);
		await page.screenshot({ path: testInfo.outputPath("detail-mobile.png") });
		await page.evaluate(() =>
			document.documentElement.setAttribute("data-theme", "dark"),
		);
		await page.screenshot({ path: testInfo.outputPath("detail-dark.png") });
	});
}

test("article search and selection remain reversible", async ({ page }) => {
	await page.goto("/articles");
	const search = page.getByRole("textbox", { name: "Tìm bài viết" });
	await search.fill("__no_matching_article__");
	await expect(
		page.getByText("Không có bài viết phù hợp bộ lọc."),
	).toBeVisible();
	await search.clear();
	const all = page.getByRole("checkbox", {
		name: "Chọn tất cả bài viết đang hiển thị",
	});
	await expect(all).toBeEnabled();
	await all.check();
	await expect(all).toBeChecked();
	await all.uncheck();
	await expect(all).not.toBeChecked();
});

test("missing evidence and tokenless verification recover safely", async ({
	page,
}) => {
	await page.goto("/evidence/not-a-valid-id");
	await expect(
		page.getByRole("heading", { name: "Không tìm thấy nội dung" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Về tổng quan", exact: true }),
	).toBeVisible();
	await page.goto("/verify-token");
	await expect(page.locator("h1")).toBeVisible();
	// The localhost test session is already authenticated, so login returns home.
	await expect(page).toHaveURL("/");
});

test("source and analysis tabs support history, keyboard and filters", async ({
	page,
}) => {
	await page.goto("/sources");
	await page.getByRole("tab", { name: "Nguồn theo dõi" }).focus();
	await page.keyboard.press("End");
	await expect(
		page.getByRole("tab", { name: "Lượt quét", exact: true }),
	).toBeFocused();
	await expect(page).toHaveURL(/view=queue/);
	await page.reload();
	await expect(
		page.getByRole("tab", { name: "Lượt quét", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await page.goto("/intelligence");
	await page.getByRole("tab", { name: "Chủ đề", exact: true }).click();
	await page.getByRole("tab", { name: "Nhận định", exact: true }).click();
	await page.goBack();
	await expect(
		page.getByRole("tab", { name: "Chủ đề", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	const order = page.getByRole("combobox", { name: "Sắp xếp" });
	await order.selectOption("oldest");
	await expect(page).toHaveURL(/sort=oldest/);
	await page.reload();
	await expect(order).toHaveValue("oldest");
});

test("mobile analysis keeps advanced filters available without hiding results", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/intelligence?view=topics");
	const toggle = page.getByRole("button", { name: "Bộ lọc & sắp xếp" });
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(
		page.getByRole("combobox", { name: "Thời gian" }),
	).not.toBeVisible();
	await toggle.click();
	await expect(page.getByRole("combobox", { name: "Thời gian" })).toBeVisible();
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("topic query failures offer retry instead of claiming an empty result", async ({
	page,
}) => {
	await page.goto("/intelligence?view=topics");
	await page.route("**/api/intelligence/topics?**", (route) =>
		route.fulfill({ status: 503, json: { error: "Unavailable" } }),
	);
	await page
		.getByRole("textbox", { name: "Tìm nội dung phân tích" })
		.fill("audit_failure_probe");
	const failure = page
		.getByRole("alert")
		.filter({ hasText: "Không thể tải dữ liệu mới nhất" });
	await expect(failure).toBeVisible({ timeout: 20000 });
	await expect(
		page.getByText("Chưa có chủ đề phù hợp với bộ lọc hiện tại."),
	).toHaveCount(0);
	await page.unroute("**/api/intelligence/topics?**");
	await failure.getByRole("button", { name: "Thử lại" }).click();
	await expect(failure).toHaveCount(0, { timeout: 20000 });
});

test("legacy draft detail retains scan context and authenticated login redirects home", async ({
	page,
}) => {
	await page.goto(
		"/drafts/00000000-0000-4000-8000-000000000000?scanId=example",
	);
	await expect(page).toHaveURL(/\/articles\?scanId=example$/);
	await page.goto("/login");
	await expect(page).toHaveURL("/");
});
