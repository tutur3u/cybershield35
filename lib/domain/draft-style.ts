export const DEFAULT_DRAFT_TONE = "Điềm tĩnh, khách quan";
export const DEFAULT_DRAFT_VOICE = "Tự nhiên, gần gũi";

export const DRAFT_TONES = [
	DEFAULT_DRAFT_TONE,
	"Ngắn gọn, trực diện",
	"Giải thích thân thiện",
	"Thuyết phục, tôn trọng",
] as const;

export const DRAFT_VOICES = [
	DEFAULT_DRAFT_VOICE,
	"Chuyên nghiệp, chuẩn mực",
	"Đối thoại, giàu tính thuyết phục",
	"Ấm áp, đồng cảm",
] as const;

export const NATURAL_VIETNAMESE_WRITING_GUIDANCE =
	"When the requested language is Vietnamese, write like an experienced native Vietnamese editor. Use idiomatic wording, fluent transitions, varied sentence rhythm, context-appropriate forms of address, and precise everyday vocabulary. Avoid literal translation, bureaucratic stiffness, repetitive sentence openings, excessive headings or bullet points, empty intensifiers, and formulaic AI phrases. The result must sound natural when read aloud while faithfully following the selected tone and voice.";
