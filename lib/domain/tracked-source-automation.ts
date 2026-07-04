import type { ScanStatus } from "@/lib/db/schema";

export const ACTIVE_TRACKED_SOURCE_SCAN_STATUSES: ScanStatus[] = [
	"queued",
	"running",
	"retrying",
];

export const TRACKED_SOURCE_DUPLICATE_GUARD_MS = 60 * 60 * 1000;
export const TRACKED_SOURCE_STALE_ACTIVE_SCAN_MS = 12 * 60 * 60 * 1000;

export type TrackedSourceAutomationKind =
	| "due"
	| "inactive"
	| "in_progress"
	| "recent"
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

	return {
		blocksEnqueue: false,
		help: "Nguồn đang bật và đủ điều kiện để được xếp hàng ở lần chạy hằng ngày hoặc khi bấm xếp hàng ngay.",
		kind: "due",
		label: "Đến hạn",
		reason: "due",
		tone: "warning",
	};
}

function normalizeTime(value?: Date | string | null) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}
