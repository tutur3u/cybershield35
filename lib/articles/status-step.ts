/**
 * The one place that decides what a CS35 article's status *is*.
 *
 * Kept free of React so the rules can be exercised directly — the order of the
 * checks is the product rule (approval gates everything to do with Zalo), and a
 * rule worth stating is worth testing without rendering anything.
 */

/** Named rather than imported, so this module stays free of component imports. */
export type ArticleStatusIcon =
	| "alert"
	| "approved"
	| "clock"
	| "hidden"
	| "loader"
	| "schedule"
	| "send";

export type ArticleStatusStep = {
	className: string;
	help: string;
	icon: ArticleStatusIcon;
	/** Position on the five-step track, 0-based. */
	index: number;
	label: string;
	next: string | null;
	tone: "danger" | "progress" | "success" | "warning";
};

export function articleStatusStep({
	reason,
	remote,
	reviewStatus,
	status,
}: {
	reason?: string | null;
	remote?: boolean;
	reviewStatus: string;
	status: string;
}): ArticleStatusStep {
	// Approval is the gate on everything to do with Zalo, so it is read first.
	// The queue can leave an article carrying a stale "syncing"/"failed" from a
	// request the rules now reject, and reporting that as "Đang đưa lên" on an
	// article nobody has approved describes work that is not happening.
	if (reviewStatus !== "approved") {
		if (reviewStatus === "rejected") {
			return {
				className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
				help: "Bài đã bị từ chối nên không được đưa lên Zalo OA.",
				icon: "alert",
				index: 1,
				label: "Đã từ chối",
				next: "Chỉnh sửa rồi gửi duyệt lại",
				tone: "danger" as const,
			};
		}
		// Still on the OA without approval — the one Zalo fact worth reporting
		// here, because it is something the operator has to act on.
		if (remote && (status === "published" || status === "hidden")) {
			return {
				className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
				help:
					status === "published"
						? "Bài vẫn đang hiển thị trên Zalo OA nhưng đã bị rút phê duyệt."
						: "Bản ẩn vẫn còn trên Zalo OA nhưng bài chưa được phê duyệt.",
				icon: "alert",
				index: 1,
				label: "Còn trên Zalo",
				next: "Gỡ khỏi Zalo OA hoặc phê duyệt lại",
				tone: "danger" as const,
			};
		}
		return {
			className: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
			help:
				reviewStatus === "draft"
					? "Bản nháp đang soạn, chưa gửi duyệt."
					: "Đang chờ người phụ trách rà soát và phê duyệt.",
			icon: "clock",
			index: reviewStatus === "draft" ? 0 : 1,
			label: reviewStatus === "draft" ? "Bản nháp" : "Chờ duyệt",
			next: "Phê duyệt trước khi đăng",
			tone: "warning" as const,
		};
	}

	if (status === "published") {
		return {
			className: "bg-[var(--success-soft)] text-[var(--success-strong)]",
			help: "Bài đang hiển thị công khai với người theo dõi Zalo OA.",
			icon: "send",
			index: 4,
			label: "Đang hiển thị",
			next: null,
			tone: "success" as const,
		};
	}
	if (status === "publishing" || status === "syncing") {
		return {
			className: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
			help:
				status === "publishing"
					? "Đang đưa bài lên hiển thị công khai trên Zalo OA."
					: "Đang đồng bộ bản ẩn lên Zalo OA.",
			icon: "loader",
			index: 3,
			label: status === "publishing" ? "Đang đăng" : "Đang đưa lên",
			next: "Chờ Zalo xác nhận",
			tone: "progress" as const,
		};
	}
	if (status === "scheduled") {
		return {
			className: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
			help: "Đã hẹn giờ. Bài sẽ tự hiển thị công khai vào thời điểm đã đặt.",
			icon: "schedule",
			index: 3,
			label: "Đã hẹn giờ",
			next: "Tự đăng theo lịch",
			tone: "progress" as const,
		};
	}
	if (status === "failed") {
		return {
			className: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
			help: reason?.trim() || "Lần đưa lên Zalo OA gần nhất thất bại.",
			icon: "alert",
			index: 2,
			label: "Đăng lỗi",
			next: "Mở bài để xem chi tiết và thử lại",
			tone: "danger" as const,
		};
	}
	if (status === "hidden") {
		return {
			className: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
			help: "Bản ẩn đã có trên Zalo OA, chỉ quản trị viên OA nhìn thấy.",
			icon: "hidden",
			index: 3,
			label: "Ẩn trên Zalo",
			next: "Bấm Đăng để hiển thị công khai",
			tone: "warning" as const,
		};
	}
	return {
		className: "bg-[var(--success-soft)] text-[var(--success-strong)]",
		help: "Bài đã được duyệt và sẵn sàng đưa lên Zalo OA.",
		icon: "approved",
		index: 2,
		label: "Đã duyệt",
		next: "Đăng lên Zalo OA",
		tone: "success" as const,
	};
}
