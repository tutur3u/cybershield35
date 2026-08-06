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

	test("both parties are named in the shell, so every page carries it", () => {
		expect(shell).toContain("Công an phường Ea Kao");
		expect(shell).toContain("https://tuturuuu.com");
		expect(shell).toContain("Phát triển &amp; cung cấp công nghệ");
	});

	test("the README names them in both languages", () => {
		expect(readme).toContain("**Đơn vị chủ quản:** Công an phường Ea Kao");
		expect(readme).toContain("**Stakeholder:** Công an phường Ea Kao");
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
