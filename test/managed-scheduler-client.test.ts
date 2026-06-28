import { afterEach, describe, expect, mock, test } from "bun:test";

import { fetchManagedSchedulerStatus } from "@/lib/dashboard/client-queries";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	mock.restore();
});

describe("managed scheduler client queries", () => {
	test("returns scheduler readiness bodies as data instead of generic query errors", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json(
					{
						code: "LOCAL_SCHEDULER_STORAGE_NOT_READY",
						configured: false,
						enabled: false,
						error: "Managed scheduler storage is not ready. Run bun db:migrate, then restart the app.",
						jobs: [],
						localStorageReady: false,
						setupDisabled: true,
						tokenLastFour: null,
						updatedAt: null,
					},
					{ status: 503 },
				),
			),
		) as unknown as typeof fetch;

		const status = await fetchManagedSchedulerStatus();

		expect(status).toMatchObject({
			code: "LOCAL_SCHEDULER_STORAGE_NOT_READY",
			configured: false,
			enabled: false,
			localStorageReady: false,
			setupDisabled: true,
		});
		expect(status.error).toContain("bun db:migrate");
	});

	test("returns upstream approval bodies as scheduler state", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json(
					{
						approvalHref:
							"https://tuturuuu.com/vi/internal/infrastructure/external-apps/approve?feature=managed-cron",
						code: "CRON_APPROVAL_REQUIRED",
						configured: false,
						enabled: false,
						error: "Managed scheduler approval required",
						jobs: [],
						localStorageReady: true,
						missingApprovalItems: ["domain"],
						setupDisabled: true,
						setupOrigin: "https://cybershield.example.com",
						tokenLastFour: null,
						updatedAt: null,
					},
					{ status: 403 },
				),
			),
		) as unknown as typeof fetch;

		const status = await fetchManagedSchedulerStatus();

		expect(status).toMatchObject({
			approvalHref:
				"https://tuturuuu.com/vi/internal/infrastructure/external-apps/approve?feature=managed-cron",
			code: "CRON_APPROVAL_REQUIRED",
			missingApprovalItems: ["domain"],
			setupDisabled: false,
			setupOrigin: "https://cybershield.example.com",
		});
	});

	test("uses sanitized upstream messages instead of the generic load error", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json(
					{
						code: "MANAGED_CRON_UNAVAILABLE",
						message: "Managed scheduler provider is unavailable.",
					},
					{ status: 503 },
				),
			),
		) as unknown as typeof fetch;

		let error: unknown;
		try {
			await fetchManagedSchedulerStatus();
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe(
			"Managed scheduler provider is unavailable.",
		);
		expect((error as Error).message).not.toBe("Không thể tải dữ liệu.");
	});
});
