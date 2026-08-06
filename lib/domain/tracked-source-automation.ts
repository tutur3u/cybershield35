import type { ScanStatus } from "@/lib/db/schema";

export const ACTIVE_TRACKED_SOURCE_SCAN_STATUSES: ScanStatus[] = [
	"queued",
	"running",
	"retrying",
];

export const TRACKED_SOURCE_DUPLICATE_GUARD_MS = 60 * 60 * 1000;
export const TRACKED_SOURCE_STALE_ACTIVE_SCAN_MS = 12 * 60 * 60 * 1000;
/**
 * How late the daily run may be before a source counts as overdue.
 *
 * The job is scheduled for midnight and takes a while to reach every source, so
 * a source not yet scanned at 00:20 is waiting its turn, not neglected.
 */
export const TRACKED_SOURCE_DUE_TOLERANCE_MS = 60 * 60 * 1000;

export type TrackedSourceAutomationKind =
	| "due"
	| "inactive"
	| "in_progress"
	| "recent"
	| "scanned_today"
	| "scheduled"
	| "stale_active";

export type TrackedSourceAutomationDecision = {
	blocksEnqueue: boolean;
	help: string;
	kind: TrackedSourceAutomationKind;
	label: string;
	reason: string;
	tone: "accent" | "neutral" | "success" | "warning";
};

export function isActiveTrackedSourceScanStatus(
	status?: ScanStatus | string | null,
) {
	return ACTIVE_TRACKED_SOURCE_SCAN_STATUSES.includes(status as ScanStatus);
}

export function classifyTrackedSourceAutomation(input: {
	duplicateGuardMs?: number;
	dueToleranceMs?: number;
	isActive: boolean;
	lastScannedAt?: Date | string | null;
	lastScanStatus?: ScanStatus | string | null;
	now?: Date;
	staleActiveScanMs?: number;
}): TrackedSourceAutomationDecision {
	const now = input.now ?? new Date();
	const duplicateGuardMs =
		input.duplicateGuardMs ?? TRACKED_SOURCE_DUPLICATE_GUARD_MS;
	const staleActiveScanMs =
		input.staleActiveScanMs ?? TRACKED_SOURCE_STALE_ACTIVE_SCAN_MS;
	const lastScannedAt = normalizeTime(input.lastScannedAt);
	const ageMs = lastScannedAt ? now.getTime() - lastScannedAt.getTime() : null;

	if (!input.isActive) {
		return {
			blocksEnqueue: true,
			help: "Nguồn đã tắt nên job hằng ngày sẽ bỏ qua.",
			kind: "inactive",
			label: "Đã tắt",
			reason: "inactive",
			tone: "neutral",
		};
	}

	if (isActiveTrackedSourceScanStatus(input.lastScanStatus)) {
		if (ageMs !== null && ageMs >= staleActiveScanMs) {
			return {
				blocksEnqueue: false,
				help: "Scan trước đó bị kẹt quá lâu; lần chạy kế tiếp sẽ đánh dấu scan cũ là lỗi và xếp hàng scan mới.",
				kind: "stale_active",
				label: "Cần khôi phục",
				reason: "stale_active_scan",
				tone: "warning",
			};
		}

		return {
			blocksEnqueue: true,
			help: "Nguồn đang có scan chưa hoàn tất nên chưa tạo scan trùng.",
			kind: "in_progress",
			label: "Đang xử lý",
			reason: "scan_in_progress",
			tone: "accent",
		};
	}

	if (ageMs !== null && ageMs >= 0 && ageMs < duplicateGuardMs) {
		return {
			blocksEnqueue: true,
			help: "Nguồn vừa được quét gần đây; hệ thống đợi qua cửa sổ chống trùng 1 giờ.",
			kind: "recent",
			label: "Mới quét",
			reason: "recently_scanned",
			tone: "success",
		};
	}

	// A daily source that already ran today is done, not owed. Reading "Đến hạn"
	// for the twenty-three hours after a successful scan described the schedule
	// rather than the source, and made a genuinely missed run impossible to spot.
	const dayStart = startOfVietnamDay(now);
	if (lastScannedAt && lastScannedAt.getTime() >= dayStart.getTime()) {
		return {
			blocksEnqueue: false,
			help: "Nguồn đã được quét trong hôm nay theo lịch hằng ngày.",
			kind: "scanned_today",
			label: "Đã quét hôm nay",
			reason: "scanned_today",
			tone: "success",
		};
	}

	const dueTolerance = input.dueToleranceMs ?? TRACKED_SOURCE_DUE_TOLERANCE_MS;
	if (now.getTime() < dayStart.getTime() + dueTolerance) {
		return {
			blocksEnqueue: false,
			help: "Lịch quét hôm nay đang chạy; nguồn sẽ tới lượt trong thời gian cho phép.",
			kind: "scheduled",
			label: "Chờ lịch hôm nay",
			reason: "within_daily_window",
			tone: "accent",
		};
	}

	return {
		blocksEnqueue: false,
		help: "Lịch hôm nay đã qua giờ cho phép mà nguồn vẫn chưa được quét.",
		kind: "due",
		label: "Đến hạn",
		reason: "due",
		tone: "warning",
	};
}

/**
 * Midnight in Vietnam, which is when the daily run is scheduled.
 *
 * The team reads these badges in local time, so a "today" measured in UTC would
 * roll over seven hours early and call a scanned source overdue.
 */
export function startOfVietnamDay(now: Date) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
	}).formatToParts(now);
	const read = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return new Date(`${read("year")}-${read("month")}-${read("day")}T00:00:00+07:00`);
}

function normalizeTime(value?: Date | string | null) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}
