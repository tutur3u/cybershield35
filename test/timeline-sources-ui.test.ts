import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("the timeline card shows judgement, not repetition", () => {
	const card = read("components/dashboard/evidence-timeline/timeline-card.tsx");
	const badges = read(
		"components/dashboard/evidence-timeline/timeline-badges.tsx",
	);

	test("sentiment and stance carry their own colour", () => {
		// They were the same grey chip as every tag beside them, so the two
		// judgements a reader scans for were the least visible things on the card.
		expect(card).toContain('<ClassificationBadge kind="sentiment"');
		expect(card).toContain('<ClassificationBadge kind="stance"');
		expect(badges).toContain("critical:");
		expect(badges).toContain("--danger-soft");
		expect(badges).toContain("--success-soft");
	});

	test("a post about no agency says nothing about stance", () => {
		expect(badges).toContain('if (kind === "stance" && value === "unknown") return null;');
	});

	test("the new-post chip is gone, the accent rail is not", () => {
		// The border, the rail and the chip all said the same thing three times.
		expect(card).not.toContain("<NewBadge />");
		expect(badges).not.toContain("export function NewBadge");
		expect(card).toContain("bg-[var(--accent)]");
	});

	test("the day separator no longer pins itself under the toolbar", () => {
		// The offset was hard-coded, so it stopped matching the moment the toolbar
		// changed height and left the date floating over the card above it.
		expect(card).not.toContain("sticky top-[168px]");
	});
});

describe("the sources page keeps only what carries information", () => {
	const panel = read("components/dashboard/sources/tracked-sources-panel.tsx");
	const index = read("components/dashboard/sources/index.tsx");

	test("only a disabled source earns a badge", () => {
		// Every row here is tracked, so "Đang theo dõi" repeated the page's title
		// on each line.
		expect(panel).toContain("if (isActive) return null;");
		// The label is only referenced by the comment explaining its removal, so
		// this asserts on what the component would render.
		expect(panel).not.toContain('{isActive ? "Đang theo dõi"');
	});

	test("adding a source is a dialog, not a permanent form", () => {
		expect(panel).toContain("<Dialog onOpenChange={setAddOpen} open={addOpen}>");
		expect(panel).toContain("Thêm nguồn theo dõi");
		expect(panel).toContain("if (await createAndScan()) setAddOpen(false);");
	});

	test("the supported-sources block is gone", () => {
		expect(index).not.toContain("SupportedSourcesPanel");
		expect(index).not.toContain("SocialLogoGrid");
	});
});

describe("the product says who owns and who built it", () => {
	const shell = read("components/dashboard/shell.tsx");
	const readme = read("README.md");

	test("both parties are named and linked in the shell", () => {
		expect(shell).toContain("Công an phường Ea Kao");
		expect(shell).toContain("https://zalo.me/2629920369363080604");
		expect(shell).toContain("https://tuturuuu.com");
		expect(shell).toContain("Phát triển & công nghệ");
		expect(shell).toContain("Đơn vị chủ quản");
	});

	test("the README names them in both languages", () => {
		expect(readme).toContain(
			"[Công an phường Ea Kao](https://zalo.me/2629920369363080604)",
		);
		expect(readme).toContain("**Stakeholder:**");
		expect(readme).toContain("[Tuturuuu](https://tuturuuu.com)");
	});
});

describe("one toolbar, one set of actions", () => {
	const topics = read("components/dashboard/intelligence-topics-workspace.tsx");
	const card = read("components/dashboard/evidence-timeline/timeline-card.tsx");
	const timeline = read("components/dashboard/evidence-timeline/index.tsx");
	const toolbar = read("components/dashboard/evidence-timeline/timeline-toolbar.tsx");

	test("a nested view does not draw its own filter row", () => {
		// Its siblings had the guard; this one never got it, so the intelligence
		// page rendered two identical filter rows.
		expect(topics).toContain("{standalone ? (");
		expect(topics).toContain("standalone = false,");
	});

	test("card actions collapse into one button with a default", () => {
		// Five equal-weight buttons wrapped onto two lines and hid the one action
		// people actually take.
		expect(card).toContain("<DropdownMenuTrigger asChild>");
		expect(card).toContain("Soạn bài viết");
		expect(card).not.toContain("cardActionClass");
	});

	test("the scanned-just-now badge is gone", () => {
		expect(timeline).not.toContain("bài vừa được");
		expect(timeline).not.toContain("pendingNewCount");
	});

	test("the toolbar carries the day being read", () => {
		expect(toolbar).toContain("{visibleDay ? (");
		expect(card).toContain("data-day-label={formatDay(day)}");
	});
});

describe("solid buttons stay legible on a dark page", () => {
	const css = read("app/globals.css");

	test("fills have their own tokens, separate from text colours", () => {
		// `--accent-strong` is a text colour and is pale in dark mode, so
		// `bg-accent hover:bg-accent-strong` made every primary button grow
		// lighter on hover — reading as the button switching off, not responding.
		expect(css).toContain("--accent-fill:");
		expect(css).toContain("--accent-fill-hover:");
		expect(css).toContain("--accent-on-fill:");
	});

	test("no primary button hovers to the pale text colour any more", () => {
		for (const file of [
			"components/dashboard/evidence-timeline/timeline-card.tsx",
			"components/dashboard/articles-workspace.tsx",
			"components/dashboard/ui-primitives.tsx",
		]) {
			expect(read(file)).not.toContain("hover:bg-[var(--accent-strong)]");
		}
	});

	test("the dropdown uses the app's own surfaces", () => {
		const menu = read("components/ui/dropdown-menu.tsx");
		expect(menu).toContain("bg-[var(--surface-elevated)]");
		expect(menu).toContain("hover:bg-[var(--surface-soft)]");
		expect(menu).not.toContain("focus:bg-accent ");
	});

	test("the visible day is read from the container that actually scrolls", () => {
		// The shell scrolls an inner section, so listening on `window` meant the
		// date never moved.
		const hook = read(
			"components/dashboard/evidence-timeline/use-visible-day.ts",
		);
		expect(hook).toContain('document.addEventListener("scroll", read, {');
		expect(hook).toContain("capture: true");
	});
});

describe("the sidebar footer carries attribution, not a link dump", () => {
	const shell = read("components/dashboard/shell.tsx");
	const data = read("components/dashboard/dashboard-data.ts");

	test("the help link list is gone from the sidebar", () => {
		expect(shell).not.toContain("Trợ giúp");
		expect(shell).not.toContain("quickLinks");
		// And the list itself, since nothing else read it.
		expect(data).not.toContain("quickLinks");
	});

	test("each party reads as a destination, with its role above its name", () => {
		// "Who owns this" and "who built this" are different questions, and the
		// names alone answer neither.
		expect(shell).toContain("function AttributionLink");
		// No heading: the two roles beneath say what it is.
		expect(shell).not.toContain("Sản phẩm của");
		expect(shell).toContain('role="Đơn vị chủ quản"');
		expect(shell).toContain('role="Phát triển & công nghệ"');
		expect(shell).toContain('target="_blank"');
	});
});

describe("the top bar reads as one group, in local conventions", () => {
	const shell = read("components/dashboard/shell.tsx");

	test("the clock is 24-hour and day-first", () => {
		// "11:40 PM" is an American reading of a clock every reader of this
		// product writes as 23:40.
		expect(shell).toContain('const timeLabel = new Intl.DateTimeFormat("vi-VN"');
		expect(shell).toContain("hour12: false,");
		expect(shell).not.toContain("hour12: true,");
	});

	test("clock, source, notifications and account sit together", () => {
		// They were spaced like four separate regions of the header.
		expect(shell).toContain(
			'className="flex shrink-0 items-center gap-1.5 text-[12px]',
		);
	});
});

describe("the fanpage rows stop repeating themselves", () => {
	const panel = read("components/dashboard/sources/facebook-page-panel.tsx");

	test("the per-row headings are gone", () => {
		// Five pages meant reading "Cách xử lý nội dung / Chọn một" five times.
		expect(panel).not.toContain("<span>Cách xử lý nội dung</span>");
		expect(panel).not.toContain("<span>Chọn một</span>");
	});

	test("classification remains without an auto-draft switch", () => {
		expect(panel).toContain('className="flex flex-wrap items-center gap-2"');
		expect(panel).not.toContain("Tự động soạn nháp");
		expect(panel).not.toContain('role="switch"');
	});
});

describe("primary actions are one colour", () => {
	test("no solid button fills with the brand green any more", () => {
		// Green on a button nobody has pressed says "this succeeded" about an
		// action not yet taken; success belongs on the result, not the control.
		for (const file of [
			"components/dashboard/article-editor/shared.tsx",
			"components/dashboard/article-editor/editor-header.tsx",
			"components/dashboard/chat-workspace.tsx",
			"components/dashboard/drafts-workspace.tsx",
		]) {
			const source = read(file);
			expect(source).not.toContain("bg-[var(--brand)]");
			expect(source).not.toContain("hover:bg-[var(--brand-strong)]");
		}
	});

	test("choosing an option reads as selection, not success", () => {
		const rail = read("components/dashboard/article-editor/publish-rail.tsx");
		expect(rail).toContain(
			'? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"',
		);
		// Done-states keep their green: a finished step really did succeed.
		expect(rail).toContain('item.done ? "text-[var(--success-strong)]"');
	});
});

describe("a killed publish cannot strand its article", () => {
	const worker = read("lib/workers/article-publications.ts");
	const scheduler = read("lib/managed-scheduler/server.ts");

	test("the Zalo round trip gets a realistic budget", () => {
		// Sixty seconds was not enough to create, verify and read back an article,
		// and the killed function surfaced as a bare "Thao tác không thành công."
		for (const name of ["sync", "publish", "hide", "live-update"]) {
			expect(read(`app/api/articles/[id]/${name}/route.ts`)).toContain(
				"export const maxDuration = 300;",
			);
		}
	});

	test("a job left running is reclaimed, and its article released", () => {
		// Every path refuses while a publication is in progress, so a locked job
		// made the article unpublishable, uneditable and unretryable at once.
		expect(worker).toContain("export async function reclaimStalledPublicationJobs");
		expect(worker).toContain("lt(articlePublicationJobs.lockedAt, cutoff)");
		expect(worker).toContain("'not_synced'::article_publication_status");
		expect(scheduler).toContain("await reclaimStalledPublicationJobs()");
	});
});

describe("a post card previews, rather than reprints, its post", () => {
	const card = read("components/dashboard/evidence-timeline/timeline-card.tsx");

	test("the page's saved name leads, its handle follows", () => {
		// "facebook.com" was the loudest line on every card, and even once the
		// author replaced it the card showed the scraped handle rather than the
		// name the team gave the page and reads everywhere else.
		expect(card).toContain("pageIdentity({");
		expect(card).toContain("place-items-center rounded-full");
		expect(card).toContain("@{handle}");
	});

	test("long posts are clamped instead of printed whole", () => {
		// Each card was a page of its own; the full text is one click away.
		expect(card).toContain("line-clamp-6");
	});

	test("a summary that repeats the quote is dropped", () => {
		// Providers often store the opening of the quote as the summary, so the
		// card printed the same sentence twice before saying anything new.
		expect(card).toContain("!post.quote.startsWith(post.summary.slice(0, 60))");
	});

	test("topics are capped and counted", () => {
		expect(card).toContain("post.topicSlugs.slice(0, 3)");
		expect(card).toContain("+{hiddenTopicCount}");
	});

	test("reach and the action sit with the badges, not below the post", () => {
		// Deciding whether an item was worth acting on meant reading top-right for
		// priority, bottom-left for reach, then travelling back to bottom-right to
		// act — three corners of the card for one decision.
		const header = card.slice(
			card.indexOf("flex min-w-0 flex-wrap items-start justify-between"),
			card.indexOf("<IntentPrefetchLink"),
		);
		expect(header).toContain("<EngagementRow");
		expect(header).toContain("<RiskPill");
		expect(header).toContain("<PostActions");
	});

	test("zero engagement is not reported", () => {
		// Three zeros on every card said only that nobody had reacted yet, in the
		// same weight as the numbers that matter.
		const badges = read("components/dashboard/evidence-timeline/timeline-badges.tsx");
		expect(badges).toContain("if (!value) return null;");
		expect(badges).toContain(
			"if (!engagement.reactions && !engagement.comments && !engagement.shares)",
		);
	});

	test("every badge on a card can say what it means", () => {
		// A coloured word is an assertion; a reviewer needs to know who made it and
		// about what — the trust badge describes the page, not the post.
		const badges = read("components/dashboard/evidence-timeline/timeline-badges.tsx");
		for (const map of ["PAGE_TRUST_HELP", "TRIAGE_HELP", "CLASSIFICATION_HELP"]) {
			expect(badges).toContain(map);
		}
		// Wrapped, not merely defined.
		expect(badges).toContain("<DashboardTooltip content={PAGE_TRUST_HELP[classification]}>");
		expect(badges).toContain("<DashboardTooltip content={TRIAGE_HELP[status]}>");
	});

	test("judgements come before hashtags", () => {
		expect(card.indexOf('<ClassificationBadge kind="sentiment"')).toBeLessThan(
			card.indexOf("{shownTopics.map"),
		);
	});
});
