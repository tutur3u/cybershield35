export const DEFAULT_DRAFT_TONE = "Điềm tĩnh, khách quan";
export const DEFAULT_DRAFT_VOICE = "Tự nhiên, gần gũi";

export const DRAFT_TONE_OPTIONS = [
	{
		description: "Cân bằng, chính xác và không lên giọng.",
		label: DEFAULT_DRAFT_TONE,
	},
	{
		description: "Đi thẳng vào luận điểm, lược bỏ câu dẫn dài.",
		label: "Ngắn gọn, trực diện",
	},
	{
		description: "Giải thích dễ hiểu, ưu tiên ngôn ngữ đời thường.",
		label: "Giải thích thân thiện",
	},
	{
		description: "Lập luận chắc chắn nhưng vẫn tôn trọng người đọc.",
		label: "Thuyết phục, tôn trọng",
	},
] as const;

export const DRAFT_VOICE_OPTIONS = [
	{
		description: "Trôi chảy như người Việt viết, không khuôn mẫu.",
		label: DEFAULT_DRAFT_VOICE,
	},
	{
		description: "Chỉn chu, rõ nghĩa và phù hợp thông tin chính thức.",
		label: "Chuyên nghiệp, chuẩn mực",
	},
	{
		description: "Gợi cảm giác trao đổi hai chiều, dẫn dắt tự nhiên.",
		label: "Đối thoại, giàu tính thuyết phục",
	},
	{
		description: "Nhẹ nhàng, thấu hiểu và tránh phán xét.",
		label: "Ấm áp, đồng cảm",
	},
] as const;

export const DRAFT_TONES = DRAFT_TONE_OPTIONS.map((option) => option.label);
export const DRAFT_VOICES = DRAFT_VOICE_OPTIONS.map((option) => option.label);

export const NATURAL_VIETNAMESE_WRITING_GUIDANCE =
	"When the requested language is Vietnamese, write like an experienced native Vietnamese editor. Use idiomatic wording, fluent transitions, varied sentence rhythm, context-appropriate forms of address, and precise everyday vocabulary. Avoid literal translation, bureaucratic stiffness, repetitive sentence openings, excessive headings or bullet points, empty intensifiers, and formulaic AI phrases. Never open with meta commentary such as 'Dưới đây là', 'Dựa trên các bằng chứng được cung cấp', or 'Trong bối cảnh hiện nay'. The result must sound natural when read aloud while faithfully following the selected tone and voice.";

export const DEFAULT_DRAFT_WRITING_BRIEF = {
	flow: [
		"Open directly with the central point instead of announcing the response.",
		"Connect evidence and explanation in coherent paragraphs with natural transitions.",
		"End with the clearest grounded takeaway; do not add a generic call to action.",
	],
	format:
		"Use two to four short paragraphs by default. Avoid headings, numbered lists, bullet lists, slogans, and formal salutations unless the operator asks for them.",
	naturalness:
		"Prefer concrete, familiar Vietnamese over Sino-Vietnamese abstraction, officialese, or word-for-word translation. Remove any sentence that merely repeats the previous one.",
} as const;
