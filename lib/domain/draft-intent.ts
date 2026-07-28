export const DRAFT_KIND_LABELS = {
	comment: "Phân tích trung lập",
	counter_argument: "Phản bác quan điểm",
	internal_brief: "Ghi chú nội bộ",
	response: "Ủng hộ quan điểm",
} as const;

export type DraftKind = keyof typeof DRAFT_KIND_LABELS;

export function draftIntentGuidance(kind: DraftKind = "counter_argument") {
	if (kind === "response") {
		return {
			goal:
				"Ủng hộ những luận điểm có căn cứ trong bài gốc và giải thích rõ vì sao chúng đáng được đồng tình.",
			requirements: [
				"Nêu đúng luận điểm được ủng hộ ngay ở phần mở đầu.",
				"Dùng bằng chứng để củng cố từng ý, không chỉ diễn đạt lại bài gốc.",
				"Không tâng bốc nguồn và không biến sự đồng tình thành một tuyên bố mới.",
			],
		};
	}
	if (kind === "counter_argument") {
		return {
			goal:
				"Phản bác luận điểm trung tâm của bài gốc bằng lập luận và bằng chứng cụ thể.",
			requirements: [
				"Nêu rõ luận điểm nào đang bị phản bác và điểm sai, thiếu hoặc gây hiểu lầm nằm ở đâu.",
				"Phản biện từng ý quan trọng bằng bằng chứng được cung cấp; không được chỉ tóm tắt hay viết lại bài gốc.",
				"Phân biệt điều đã xác minh với điều còn thiếu căn cứ. Nếu bằng chứng chưa đủ, phải nói rõ giới hạn đó.",
				"Kết lại bằng cách diễn giải chính xác hơn để người đọc hiểu vấn đề, không dùng khẩu hiệu hay công kích cá nhân.",
			],
		};
	}
	if (kind === "comment") {
		return {
			goal: "Phân tích trung lập các luận điểm và giới hạn của bằng chứng.",
			requirements: [
				"Tách rõ dữ kiện, nhận định và điều chưa thể xác minh.",
				"Không mặc định ủng hộ hoặc phản bác khi bằng chứng chưa đủ.",
			],
		};
	}
	return {
		goal: "Ghi lại ngắn gọn các dữ kiện và điểm cần người vận hành kiểm tra.",
		requirements: [
			"Chỉ dùng cho nội bộ, ưu tiên tính chính xác và khả năng rà soát.",
			"Không viết như nội dung sẵn sàng đăng công khai.",
		],
	};
}

