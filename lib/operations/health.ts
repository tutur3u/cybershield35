import type { OperationsServiceView } from "@/components/dashboard/types";

type HealthInput = {
	services: ReadonlyArray<Pick<OperationsServiceView, "health">>;
	throughput24h: { failed: number };
	queue: { retrying: number };
	oldestQueuedAgeSeconds: number | null;
};

// Retired services remain in the history list, but must not degrade live health.
export function operationsHealth(overview?: HealthInput) {
	if (!overview)
		return {
			description: "Đang tổng hợp tín hiệu vận hành.",
			title: "Đang kiểm tra hệ thống",
			tone: "neutral" as const,
		};
	const staleServices = overview.services.filter(
		(service) => service.health === "stale",
	).length;
	if (overview.throughput24h.failed > 0 || staleServices > 0)
		return {
			description: `${staleServices} dịch vụ mất tín hiệu và ${overview.throughput24h.failed} lượt quét lỗi trong 24 giờ cần kiểm tra.`,
			title: "Hệ thống cần chú ý",
			tone: "danger" as const,
		};
	if (
		overview.services.length === 0 ||
		overview.services.every((service) => service.health === "inactive") ||
		overview.services.some((service) => service.health === "unknown")
	)
		return {
			description:
				"Một dịch vụ chưa gửi tín hiệu hoạt động. Kiểm tra mục Kết nối & bảo trì.",
			title: "Thiếu tín hiệu dịch vụ",
			tone: "warning" as const,
		};
	if (
		overview.queue.retrying > 0 ||
		(overview.oldestQueuedAgeSeconds ?? 0) > 60 * 60
	)
		return {
			description: "Có lượt quét đang thử lại hoặc chờ lâu hơn dự kiến.",
			title: "Xử lý chậm hơn dự kiến",
			tone: "warning" as const,
		};
	return {
		description: "Hàng đợi, scheduler và worker đang trong ngưỡng bình thường.",
		title: "Hệ thống hoạt động ổn định",
		tone: "success" as const,
	};
}
