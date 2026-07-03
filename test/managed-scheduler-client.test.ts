import { afterEach, describe, expect, mock, test } from "bun:test";

import {
	fetchManagedSchedulerExecutions,
	fetchManagedSchedulerStatus,
} from "@/lib/dashboard/client-queries";

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

	test("returns blocked upstream scheduler states with sanitized diagnostics", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json(
					{
						adminRecoveryHref:
							"https://tuturuuu.com/vi/internal/infrastructure/monitoring/cron?focus=cron-runner",
						adminRecoveryReason:
							"Tuturuuu managed scheduler status check returned HTTP 503.",
						code: "MANAGED_CRON_UNAVAILABLE",
						configured: false,
						enabled: false,
						error: "Managed scheduler provider is unavailable.",
						jobs: [],
						localStorageReady: true,
						setupDisabled: true,
						setupDisabledReason:
							"Tuturuuu managed scheduler status check returned HTTP 503.",
						tokenLastFour: null,
						updatedAt: null,
						upstreamStatus: 503,
					},
					{ status: 503 },
				),
			),
		) as unknown as typeof fetch;

		const status = await fetchManagedSchedulerStatus();

		expect(status).toMatchObject({
			adminRecoveryHref:
				"https://tuturuuu.com/vi/internal/infrastructure/monitoring/cron?focus=cron-runner",
			adminRecoveryReason:
				"Tuturuuu managed scheduler status check returned HTTP 503.",
			code: "MANAGED_CRON_UNAVAILABLE",
			error: "Managed scheduler provider is unavailable.",
			setupDisabled: true,
			setupDisabledReason:
				"Tuturuuu managed scheduler status check returned HTTP 503.",
			upstreamStatus: 503,
		});
	});

	test("preserves local setup and remote status diagnostics independently", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json(
					{
						adminRecoveryHref:
							"https://tuturuuu.com/vi/internal/infrastructure/monitoring/cron?focus=cron-runner",
						code: "MANAGED_CRON_STATUS_CHECK_FAILED",
						configured: true,
						enabled: true,
						error:
							"Managed cron operation failed inside Tuturuuu. Check Tuturuuu server logs, then retry.",
						jobs: [],
						localStorageReady: true,
						remoteConfigured: false,
						remoteStatusAvailable: false,
						setupDisabled: true,
						setupDisabledReason:
							"Managed cron operation failed inside Tuturuuu. Check Tuturuuu server logs, then retry.",
						tokenLastFour: "nxHA",
						updatedAt: "2026-06-29T11:28:00.000Z",
						upstreamStatus: 500,
					},
					{ status: 500 },
				),
			),
		) as unknown as typeof fetch;

		const status = await fetchManagedSchedulerStatus();

		expect(status).toMatchObject({
			configured: true,
			remoteConfigured: false,
			remoteStatusAvailable: false,
			setupDisabled: true,
			tokenLastFour: "nxHA",
			upstreamStatus: 500,
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

	test("preserves schedule timezone, history summary, and overdue fields", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json({
					configured: true,
					enabled: true,
					generatedAt: "2026-06-29T11:41:00.000Z",
					jobs: [
						{
							active: true,
							failureCount: 0,
							isOverdue: true,
							jobKey: "process-queue",
							lastExecution: {
								id: "execution-1",
								jobKey: "process-queue",
								source: "manual",
								status: "success",
							},
							lastRunAt: null,
							lastStatus: null,
							name: "Managed scheduler process queue",
							nextRunAt: "2026-06-29T11:30:00.000Z",
							overdueReason:
								"No execution recorded after scheduled time.",
							overdueSince: "2026-06-29T11:30:00.000Z",
							schedule: "*/30 * * * *",
							scheduleDescription: "Every 30 minutes (Asia/Ho_Chi_Minh)",
							scheduleTimezone: "Asia/Ho_Chi_Minh",
						},
					],
					serverNow: "2026-06-29T11:41:00.000Z",
					tokenLastFour: "nxHA",
					updatedAt: "2026-06-29T11:28:00.000Z",
				}),
			),
		) as unknown as typeof fetch;

		const status = await fetchManagedSchedulerStatus();

		expect(status.generatedAt).toBe("2026-06-29T11:41:00.000Z");
		expect(status.serverNow).toBe("2026-06-29T11:41:00.000Z");
		expect(status.jobs[0]).toMatchObject({
			isOverdue: true,
			overdueReason: "No execution recorded after scheduled time.",
			scheduleTimezone: "Asia/Ho_Chi_Minh",
		});
		expect(status.jobs[0]?.lastExecution).toMatchObject({
			id: "execution-1",
			source: "manual",
		});
	});

	test("preserves Vercel Cron scheduler metadata", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				Response.json({
					configured: true,
					enabled: true,
					jobs: [
						{
							active: true,
							failureCount: 0,
							jobKey: "process-queue",
							lastRunAt: null,
							lastStatus: null,
							lockedByDeployment: true,
							name: "Managed scheduler process queue",
							nextRunAt: "2026-07-03T04:05:00.000Z",
							schedule: "*/30 * * * *",
							scheduleDescription: "Every 30 minutes",
							scheduleTimezone: "UTC",
						},
					],
					localStorageReady: true,
					schedulerProvider: "vercel-cron",
					setupDisabled: false,
					tokenLastFour: null,
					updatedAt: null,
				}),
			),
		) as unknown as typeof fetch;

		const status = await fetchManagedSchedulerStatus();

		expect(status.schedulerProvider).toBe("vercel-cron");
		expect(status.jobs[0]).toMatchObject({
			lockedByDeployment: true,
			scheduleTimezone: "UTC",
		});
	});

	test("loads managed scheduler execution history", async () => {
		globalThis.fetch = mock((url: string | URL) => {
			expect(String(url)).toContain("/api/workspace/cron/jobs/process-queue/executions");
			return Promise.resolve(
				Response.json({
					items: [
						{
							durationMs: 100,
							id: "execution-1",
							jobKey: "process-queue",
							jobName: "Managed scheduler process queue",
							source: "manual",
							startedAt: "2026-06-29T11:40:00.000Z",
							status: "success",
						},
					],
					total: 1,
				}),
			);
		}) as unknown as typeof fetch;

		const history = await fetchManagedSchedulerExecutions("process-queue");

		expect(history.total).toBe(1);
		expect(history.items).toEqual([
			expect.objectContaining({
				id: "execution-1",
				source: "manual",
				status: "success",
			}),
		]);
	});
});
