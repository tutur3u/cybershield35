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

// Shared by public article and response drafting, not internal analysis/chat.
export const PUBLIC_POST_WRITING_GUIDANCE = [
	"Giọng bài đăng tiếng Việt: viết như một người đang nói rõ điều mình quan tâm với cộng đồng, bình tĩnh, gần gũi và tôn trọng. Dùng từ quen thuộc, câu vừa phải và chủ thể rõ ràng. Có thể bày tỏ quan điểm có căn cứ mà không lên lớp người đọc.",
	"Mở thẳng vào con người, sự việc hoặc điều cần nói. Tiêu đề và trích yếu phải đọc tự nhiên khi đứng riêng. Trích yếu ưu tiên một ý chính và một câu giải thích ngắn; không cố nhét cả lập luận, cảnh báo và lời khuyên vào hai câu. Không biến câu chữ thành bài tập logic: tránh lặp cấu trúc X và Y chưa có nghĩa là Y vì X, hai chuyện khác nhau, khoảng cách giữa hai điều, hay chơi chữ với vì, đúng, sai.",
	"Riêng trích yếu: nói điều có ý nghĩa với người dân, không mô tả cách phân tích của người viết. Tránh những câu như Khi các vụ việc bị đặt câu hỏi, việc tách bạch là cách nhìn nhận công bằng, hay câu chuyện cần được bàn từ. Chúng vừa trừu tượng vừa khó đọc. Viết trực tiếp như Người dân cần được..., Những phản ánh về... cần được... khi nội dung thực sự phù hợp; đây là gợi ý diễn đạt, không phải mẫu bắt buộc cho mọi bài.",
	"Mẫu giọng đã được biên tập chấp nhận: ‘Niềm tin tôn giáo không phải là lý do để phán xét một người. Những phản ánh về việc người dân bị ngăn cản sinh hoạt tín ngưỡng cần được lắng nghe và giải đáp thỏa đáng.’ Học cách nói rõ ý, mềm mỏng và quan tâm đến con người; không sao chép câu mẫu, chủ đề hoặc kết luận của nó sang bài khác.",
	"Với tin văn hóa, sự kiện hoặc dịch vụ, tập trung kể việc đã xảy ra và điều người đọc quan tâm. Ví dụ về nhịp câu: ‘Thư viện mở thêm sáng thứ Bảy. Bạn đọc có thêm thời gian đến đọc sách vào cuối tuần.’ Đây chỉ là mẫu cách viết, không phải dữ kiện để thêm vào bài.",
	"Khi sửa bài, giữ những câu tự nhiên và dữ kiện đúng; sửa đúng phần được yêu cầu, không viết lại cả bài thành một giọng khuôn mẫu. Bài dài phải có thêm chi tiết hoặc ý mới, không kéo dài bằng việc lặp lại một nguyên tắc. Tôn trọng yêu cầu độ dài cụ thể.",
	"Quy nguồn ngắn gọn ngay cạnh lời phản ánh hoặc thông tin chưa được xác minh. Giữ mức độ chắc chắn đúng với nguồn; không lược bỏ quy nguồn để câu nghe dứt khoát hơn. Việc cần xác minh dành cho người biên tập đặt trong reviewNotes hoặc safetyNotes, không đưa câu hồ sơ hiện có chưa đủ, cần được bàn từ việc của từng người hay lời nhắc đọc đủ thông tin trước khi kết luận vào bài.",
	"Đọc lại cả tiêu đề, trích yếu và thân bài như lời viết cho người thật. Bỏ câu chỉ giảng cách đọc tin, nhắc quy trình kiểm chứng hoặc tổng kết đạo lý. Kết ở điều có ý nghĩa với câu chuyện, không thêm khẩu hiệu hay một đoạn nhắc lại tất cả nguyên tắc.",
].join(" ");

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

export const AUTOMATIC_DRAFT_WRITING_BRIEF = {
	...DEFAULT_DRAFT_WRITING_BRIEF,
	automation: [
		"Write as finished Vietnamese prose for a human reviewer, not as a report about the generation process.",
		"Never mention automation, source classification, evidence IDs, prompts, policies, or that evidence was supplied.",
		"Vary the opening and transitions based on the actual content so repeated automatic drafts do not sound templated.",
	],
} as const;

export type DraftGenerationMode = "automatic" | "operator";

export function draftWritingBriefForMode(mode: DraftGenerationMode) {
	return mode === "automatic"
		? AUTOMATIC_DRAFT_WRITING_BRIEF
		: DEFAULT_DRAFT_WRITING_BRIEF;
}

export function resolveDraftGenerationStyle(input: {
	language: string;
	mode: DraftGenerationMode;
	voice?: string;
}) {
	if (input.mode === "automatic") {
		return {
			language: "vi",
			voice: DEFAULT_DRAFT_VOICE,
		} as const;
	}

	return {
		language: input.language,
		voice: input.voice ?? DEFAULT_DRAFT_VOICE,
	};
}
