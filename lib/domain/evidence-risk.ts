import type { FacebookPageClassification } from "@/lib/domain/facebook-page-policy";

export type EvidenceRiskLevel = "low" | "medium" | "high";

export function assessEvidenceRisk(input: {
	comments?: number;
	shares?: number;
	sourceClassification?: FacebookPageClassification;
	storedRisk?: EvidenceRiskLevel;
	text?: string | null;
}) {
	const comments = finiteCount(input.comments);
	const shares = finiteCount(input.shares);
	const text = input.text?.toLocaleLowerCase("vi") ?? "";
	const signals: string[] = [];
	let level: EvidenceRiskLevel = input.storedRisk ?? "low";

	const riskyTerms = [
		"sai sự thật",
		"không đúng sự thật",
		"bịa đặt",
		"xuyên tạc",
		"kêu gọi",
		"tẩy chay",
		"kích động",
		"chưa kiểm chứng",
	];
	const matchedTerms = riskyTerms.filter((term) => text.includes(term));
	if (matchedTerms.length) {
		level = "high";
		signals.push(`Có tín hiệu ngôn ngữ cần kiểm chứng: ${matchedTerms.slice(0, 3).join(", ")}.`);
	}
	if (comments > 100 || shares > 30) {
		level = "high";
		signals.push(
			`Mức lan truyền cao (${comments.toLocaleString("vi-VN")} bình luận, ${shares.toLocaleString("vi-VN")} lượt chia sẻ).`,
		);
	} else if (level !== "high" && (comments > 20 || shares > 5)) {
		level = "medium";
		signals.push(
			`Mức lan truyền cần theo dõi (${comments.toLocaleString("vi-VN")} bình luận, ${shares.toLocaleString("vi-VN")} lượt chia sẻ).`,
		);
	}
	if (input.sourceClassification === "at_risk" && level === "low") {
		level = "medium";
		signals.push(
			"Trang nguồn đã được người vận hành đánh dấu có rủi ro, nên mức ưu tiên được nâng tối thiểu lên trung bình.",
		);
	} else if (input.sourceClassification === "at_risk") {
		signals.push("Trang nguồn đã được người vận hành đánh dấu có rủi ro.");
	} else if (input.sourceClassification === "trusted") {
		signals.push(
			"Trang nguồn được đánh dấu đáng tin cậy; phân loại này không tự động làm giảm tín hiệu rủi ro trong nội dung.",
		);
	}
	if (!signals.length) {
		signals.push(
			"Chưa thấy từ khóa rủi ro hoặc mức lan truyền vượt ngưỡng trong dữ liệu hiện có.",
		);
	}

	return {
		level,
		reasons: signals,
	};
}

function finiteCount(value?: number) {
	return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 0;
}
