import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
	fullyParallel: false,
	outputDir: "test-results",
	reporter: [["list"], ["html", { open: "never" }]],
	retries: process.env.CI ? 2 : 0,
	testDir: "./e2e",
	testMatch: "**/*.e2e.ts",
	timeout: 60_000,
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		trace: "retain-on-failure",
	},
	webServer: {
		command: `AUTH_LOCAL_BYPASS=true bun run dev --hostname 127.0.0.1 --port ${port}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		url: `http://127.0.0.1:${port}`,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
