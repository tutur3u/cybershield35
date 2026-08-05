import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * The sidebar renders on the server, where localStorage does not exist. Seeding
 * a `useState` from it makes the server and the first client render disagree;
 * React resolves that by reusing DOM nodes, and individual nav links end up
 * wearing the collapsed variant's classes (gap-0, px-0) while the sidebar is
 * drawn expanded. That is a visual bug with no error to trace it back to, so it
 * is guarded structurally.
 */
describe("sidebar preferences never hydrate from useState", () => {
	const shell = readFileSync("components/dashboard/shell.tsx", "utf8");
	const layout = readFileSync(
		"components/dashboard/dashboard-layout-shell.tsx",
		"utf8",
	);

	test("browser-stored preferences are read through useSyncExternalStore", () => {
		expect(layout).toContain("useSyncExternalStore(");
		expect(layout).toContain("subscribeSidebarCollapsed");
		expect(layout).toContain("readServerSidebarCollapsed");
		expect(shell).toContain("subscribeSidebarSections");
		expect(shell).toContain("readServerSidebarSections");
	});

	test("neither preference is seeded into useState", () => {
		expect(layout).not.toContain("useState(readSidebarCollapsed)");
		expect(shell).not.toContain("useState(readSidebarSections)");
		expect(shell).not.toContain("useState<Record<string, boolean>>(readSidebarSections)");
	});

	test("the server snapshot is the neutral default, not a stored value", () => {
		// If the server snapshot ever read storage it would throw during SSR, and
		// if it returned a non-default the mismatch would come straight back.
		expect(layout).toMatch(
			/function readServerSidebarCollapsed\(\)[^}]*return false;/u,
		);
		expect(shell).toMatch(
			/function readServerSidebarSections\(\)[^}]*return EMPTY_SIDEBAR_SECTIONS;/u,
		);
	});

	test("snapshots are cached so useSyncExternalStore can bail out", () => {
		// The hook compares snapshots by reference on every render; returning a
		// freshly parsed object each time is an infinite render loop.
		expect(shell).toContain("if (raw === sidebarSectionsRaw) return sidebarSectionsValue;");
	});
});
