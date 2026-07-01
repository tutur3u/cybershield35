import type {
	AnalysisView,
	DashboardScan,
	DraftShape,
	EvidenceView,
	TopicCluster,
} from "@/components/dashboard/types";
import type { RiskLevel } from "@/lib/db/schema";

export type DashboardInsight = {
	body: string;
	href?: string;
	label: string;
	tone: "danger" | "neutral" | "success" | "warning";
	value: string;
};

export type TopicInsight = TopicCluster & {
	attentionLabel: string;
	evidence: EvidenceView;
	href: string;
	key: string;
	recommendation: string;
};

export function buildDashboardInsights({
	analysis,
	draft,
	evidence,
	scans,
	topics,
}: {
	analysis: AnalysisView;
	draft: DraftShape | null;
	evidence: EvidenceView;
	scans: DashboardScan[];
	topics: TopicCluster[];
}): DashboardInsight[] {
	const failed = scans.filter((scan) => scan.status === "failed").length;
	const active = scans.filter(
		(scan) => scan.status === "queued" || scan.status === "running",
	).length;
	const highRiskEvidence = evidence.filter(
		(item) => item.riskLevel === "high",
	).length;
	const highRiskTopics = topics.filter((topic) => topic.riskLevel === "high").length;
	const increasingTopics = topics.filter(
		(topic) => topic.trend.toLowerCase() === "increasing",
	).length;
	const draftReady =
		draft?.status === "approved"
			? "Đã duyệt"
			: draft
				? "Cần duyệt"
				: "Chưa có";

	const nextAction = nextActionInsight({
		active,
		draft,
		failed,
		highRiskTopics,
		scans,
	});

	return [
		nextAction,
		{
			body:
				highRiskEvidence > 0
					? "Ưu tiên kiểm tra các trích dẫn rủi ro cao trước khi soạn phản hồi."
					: "Chưa thấy cụm bằng chứng rủi ro cao trong scan đang chọn.",
			href: "/evidence",
			label: "Sức mạnh bằng chứng",
			tone: highRiskEvidence > 0 ? "warning" : "success",
			value: `${evidence.length.toLocaleString("vi-VN")} mục`,
		},
		{
			body:
				increasingTopics > 0
					? "Có chủ đề đang tăng, nên xem nội dung mẫu và lập trường trước."
					: "Các chủ đề hiện ổn định theo phân tích gần nhất.",
			href: "/topics",
			label: "Áp lực chủ đề",
			tone: highRiskTopics > 0 ? "danger" : increasingTopics > 0 ? "warning" : "neutral",
			value: `${topics.length.toLocaleString("vi-VN")} cụm`,
		},
		{
			body:
				draft?.status === "approved"
					? "Có bản nháp đã qua duyệt thủ công để dùng nội bộ."
					: "Tạo hoặc duyệt bản nháp sau khi đã chọn đủ bằng chứng.",
			href: "/counter-arguments",
			label: "Sẵn sàng phản hồi",
			tone: draft?.status === "approved" ? "success" : "neutral",
			value: draftReady,
		},
		{
			body: riskCopy(analysis.riskLevel),
			href: "/alerts",
			label: "Mức chú ý",
			tone: toneForRisk(analysis.riskLevel),
			value: riskLabel(analysis.riskLevel),
		},
	];
}

export function buildTopicInsights({
	evidence,
	topics,
}: {
	evidence: EvidenceView;
	topics: TopicCluster[];
}): TopicInsight[] {
	return topics.map((topic) => {
		const relatedEvidence = evidence.filter((item) =>
			evidenceMatchesTopic(item, topic.name),
		);
		const fallbackEvidence = relatedEvidence.length
			? relatedEvidence
			: evidence
					.filter((item) => item.riskLevel === topic.riskLevel)
					.slice(0, Math.max(1, Math.min(3, topic.count)));

		return {
			...topic,
			attentionLabel: attentionLabel(topic),
			evidence: fallbackEvidence,
			href: `/topics?topic=${encodeURIComponent(topic.name)}`,
			key: slugify(topic.name),
			recommendation: topicRecommendation(topic),
		};
	});
}

export function summarizeScanFreshness(scans: DashboardScan[]) {
	const lastCompleted = scans.find((scan) => scan.status === "completed");
	if (!lastCompleted) {
		return {
			label: "Chưa có scan hoàn tất",
			tone: "warning" as const,
		};
	}

	const completedAt = new Date(lastCompleted.createdAt);
	const ageHours = Math.max(0, Date.now() - completedAt.getTime()) / 3_600_000;
	if (ageHours > 24) {
		return {
			label: "Dữ liệu đã cũ hơn 24 giờ",
			tone: "warning" as const,
		};
	}

	return {
		label: "Dữ liệu mới",
		tone: "success" as const,
	};
}

function nextActionInsight({
	active,
	draft,
	failed,
	highRiskTopics,
	scans,
}: {
	active: number;
	draft: DraftShape | null;
	failed: number;
	highRiskTopics: number;
	scans: DashboardScan[];
}): DashboardInsight {
	if (failed > 0) {
		return {
			body: "Có scan lỗi. Kiểm tra nguồn hoặc chạy lại scan trước khi dùng kết quả.",
			href: "/sources",
			label: "Việc cần làm",
			tone: "danger",
			value: "Xử lý lỗi",
		};
	}

	if (!scans.length) {
		return {
			body: "Thêm nguồn công khai hoặc văn bản để bắt đầu phân tích.",
			href: "/sources",
			label: "Việc cần làm",
			tone: "neutral",
			value: "Tạo scan",
		};
	}

	if (active > 0) {
		return {
			body: "Đang có scan trong hàng đợi. Theo dõi tiến độ trước khi kết luận.",
			href: "/sources",
			label: "Việc cần làm",
			tone: "warning",
			value: "Theo dõi",
		};
	}

	if (highRiskTopics > 0) {
		return {
			body: "Xem cụm chủ đề rủi ro cao và mở bằng chứng liên quan.",
			href: "/topics",
			label: "Việc cần làm",
			tone: "danger",
			value: "Đọc chủ đề",
		};
	}

	if (!draft) {
		return {
			body: "Kết quả đã sẵn sàng để tạo bản nháp phản hồi có trích dẫn.",
			href: "/counter-arguments",
			label: "Việc cần làm",
			tone: "success",
			value: "Soạn phản hồi",
		};
	}

	return {
		body: "Không có cảnh báo vận hành nổi bật trong scan đang chọn.",
		label: "Việc cần làm",
		tone: "success",
		value: "Ổn định",
	};
}

function evidenceMatchesTopic(item: EvidenceView[number], topicName: string) {
	const haystack = `${item.quote ?? ""} ${item.summary ?? ""} ${item.sourceLabel ?? ""}`;
	return haystack.toLocaleLowerCase("vi-VN").includes(
		topicName.toLocaleLowerCase("vi-VN"),
	);
}

function attentionLabel(topic: TopicCluster) {
	if (topic.riskLevel === "high") return "Cần đọc trước";
	if (topic.trend.toLowerCase() === "increasing") return "Đang tăng";
	return "Theo dõi";
}

function topicRecommendation(topic: TopicCluster) {
	if (topic.riskLevel === "high") {
		return "Mở bằng chứng mẫu, xác nhận nguồn, rồi chuẩn bị phản hồi có kiểm duyệt.";
	}
	if (topic.trend.toLowerCase() === "increasing") {
		return "Theo dõi thêm một lượt scan trước khi kết luận xu hướng.";
	}
	return "Giữ trong danh sách theo dõi và dùng làm bối cảnh báo cáo.";
}

function riskCopy(risk: RiskLevel) {
	if (risk === "high") return "Cần xem cảnh báo và bằng chứng trước khi xuất báo cáo.";
	if (risk === "medium") return "Có tín hiệu cần theo dõi, nên đọc các cụm chủ đề chính.";
	return "Rủi ro thấp theo dữ liệu hiện tại.";
}

function riskLabel(risk: RiskLevel) {
	if (risk === "high") return "Cao";
	if (risk === "medium") return "Trung bình";
	return "Thấp";
}

function toneForRisk(risk: RiskLevel): DashboardInsight["tone"] {
	if (risk === "high") return "danger";
	if (risk === "medium") return "warning";
	return "success";
}

function slugify(value: string) {
	return value
		.toLocaleLowerCase("vi-VN")
		.replace(/[^a-z0-9\p{L}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}
