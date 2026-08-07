import {
	ListChecks,
	Maximize2,
	Minimize2,
	PenLine,
	ShieldQuestion,
	Sparkles,
	Type,
	type LucideIcon,
} from "lucide-react";

export type AiActionKey =
	| "draft"
	| "outline"
	| "rewrite"
	| "shorten"
	| "expand"
	| "description"
	| "title_description"
	| "claim_check";

export type AiActionGroup = "polish" | "structure" | "verify" | "write";

export type AiAction = {
	description: string;
	group: AiActionGroup;
	icon: LucideIcon;
	key: AiActionKey;
	/** Shown when the action would not help in the article's current shape. */
	requires?: "body" | "none";
	label: string;
};

export const AI_ACTION_GROUPS: Array<{ id: AiActionGroup; label: string }> = [
	{ id: "write", label: "Viết" },
	{ id: "structure", label: "Cấu trúc" },
	{ id: "polish", label: "Tinh chỉnh" },
	{ id: "verify", label: "Kiểm chứng" },
];

/**
 * Each action states what it changes, so an operator can predict the result
 * before spending a generation on it.
 */
export const AI_ACTIONS: AiAction[] = [
	{
		description: "Viết bài hoàn chỉnh từ bằng chứng đã gắn.",
		group: "write",
		icon: Sparkles,
		key: "draft",
		label: "Viết bản đầu",
		requires: "none",
	},
	{
		description: "Viết lại toàn bộ theo giọng điệu và mục tiêu đã chọn.",
		group: "write",
		icon: PenLine,
		key: "rewrite",
		label: "Viết lại",
		requires: "body",
	},
	{
		description: "Dựng bố cục các ý chính trước khi viết chi tiết.",
		group: "structure",
		icon: ListChecks,
		key: "outline",
		label: "Tạo dàn ý",
		requires: "none",
	},
	{
		description: "Bổ sung bối cảnh và lập luận cho các đoạn còn mỏng.",
		group: "structure",
		icon: Maximize2,
		key: "expand",
		label: "Mở rộng",
		requires: "body",
	},
	{
		description: "Cắt lặp ý và câu thừa, giữ nguyên dữ kiện.",
		group: "polish",
		icon: Minimize2,
		key: "shorten",
		label: "Rút gọn",
		requires: "body",
	},
	{
		description: "Viết lại tiêu đề và trích yếu cho đúng giới hạn hiển thị.",
		group: "polish",
		icon: Type,
		key: "title_description",
		label: "Tiêu đề & trích yếu",
		requires: "body",
	},
	{
		description: "Rà từng luận điểm xem có đủ căn cứ trong bằng chứng không.",
		group: "verify",
		icon: ShieldQuestion,
		key: "claim_check",
		label: "Kiểm tra luận điểm",
		requires: "body",
	},
];

export const AI_INTENTS = [
	{
		description: "Chỉ ra điểm chưa thuyết phục và lập luận đối chiếu.",
		label: "Phản bác quan điểm",
		value: "counter_argument",
	},
	{
		description: "Củng cố quan điểm bằng bằng chứng đã chọn.",
		label: "Ủng hộ quan điểm",
		value: "support",
	},
	{
		description: "Nêu dữ kiện, khoảng trống và các góc nhìn.",
		label: "Trình bày cân bằng",
		value: "balanced",
	},
] as const;

export const AI_TONE_PRESETS = [
	"Điềm tĩnh, khách quan",
	"Dứt khoát, rõ ràng",
	"Gần gũi, dễ hiểu",
	"Trang trọng, chuẩn mực",
];

export const AI_VOICE_PRESETS = [
	"Tự nhiên, gần gũi",
	"Ngắn gọn, đi thẳng vấn đề",
	"Kể chuyện, giàu hình ảnh",
	"Phân tích, nhiều dữ kiện",
];

export const AI_INSTRUCTION_HINTS = [
	"Mở đầu bằng dữ kiện cụ thể, tránh câu dẫn chung chung.",
	"Giữ nguyên mọi số liệu và tên riêng trong bằng chứng.",
	"Thêm một đoạn nêu điều chưa thể kết luận.",
	"Viết cho người đọc phổ thông, tránh thuật ngữ chuyên ngành.",
];

export function aiActionLabel(key: string) {
	return AI_ACTIONS.find((action) => action.key === key)?.label ?? key;
}
