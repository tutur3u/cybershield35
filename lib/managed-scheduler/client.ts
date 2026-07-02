import type { ManagedSchedulerStatusView } from "@/components/dashboard/types";

const LOCAL_SCHEDULER_STORAGE_NOT_READY =
	"LOCAL_SCHEDULER_STORAGE_NOT_READY";

export async function parseManagedSchedulerStatusResponse(
	response: Response,
	fallbackMessage = "Không thể cập nhật managed scheduler.",
): Promise<ManagedSchedulerStatusView> {
	const payload = await response.json().catch(() => null);

	if (isManagedSchedulerStatusPayload(payload)) {
		if (
			response.ok ||
			payload.adminRecoveryHref ||
			payload.approvalHref ||
			payload.setupDisabled ||
			payload.setupDisabledReason ||
			payload.error ||
			payload.code === LOCAL_SCHEDULER_STORAGE_NOT_READY
		) {
			return normalizeManagedSchedulerStatus(payload);
		}
	}

	if (response.ok) return emptyManagedSchedulerStatus();

	throw new Error(managedSchedulerErrorMessage(payload, fallbackMessage));
}

export function managedSchedulerErrorMessage(
	payload: unknown,
	fallbackMessage = "Không thể cập nhật managed scheduler.",
) {
	if (payload && typeof payload === "object") {
		const record = payload as Record<string, unknown>;
		if (typeof record.error === "string" && record.error.trim()) {
			return record.error.trim();
		}
		if (typeof record.message === "string" && record.message.trim()) {
			return record.message.trim();
		}
	}

	return fallbackMessage;
}

export function emptyManagedSchedulerStatus(): ManagedSchedulerStatusView {
	return {
		configured: false,
		enabled: false,
		jobs: [],
		localStorageReady: true,
		setupDisabled: false,
		tokenLastFour: null,
		updatedAt: null,
	};
}

function isManagedSchedulerStatusPayload(
	value: unknown,
): value is ManagedSchedulerStatusView {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;

	return (
		typeof record.configured === "boolean" &&
		typeof record.enabled === "boolean" &&
		Array.isArray(record.jobs)
	);
}

function normalizeManagedSchedulerStatus(
	payload: ManagedSchedulerStatusView,
): ManagedSchedulerStatusView {
	return {
		...payload,
		jobs: Array.isArray(payload.jobs)
			? payload.jobs.map((job) => ({
					...job,
					isOverdue: job.isOverdue === true,
					lastExecution: job.lastExecution ?? null,
					overdueReason: job.overdueReason ?? null,
					overdueSince: job.overdueSince ?? null,
					scheduleDescription: job.scheduleDescription ?? "",
					scheduleTimezone: job.scheduleTimezone ?? "UTC",
				}))
			: [],
		localStorageReady: payload.localStorageReady !== false,
		remoteConfigured:
			typeof payload.remoteConfigured === "boolean"
				? payload.remoteConfigured
				: undefined,
		remoteStatusAvailable:
			typeof payload.remoteStatusAvailable === "boolean"
				? payload.remoteStatusAvailable
				: undefined,
		setupDisabled:
			(Boolean(payload.setupDisabled) && !payload.approvalHref) ||
			Boolean(payload.setupDisabledReason) ||
			payload.localStorageReady === false ||
			payload.code === LOCAL_SCHEDULER_STORAGE_NOT_READY,
		tokenLastFour: payload.tokenLastFour ?? null,
		updatedAt: payload.updatedAt ?? null,
	};
}
