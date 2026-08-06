import { generateText, Output } from "ai";
import { z } from "zod";

import {
	EVIDENCE_RISK_CATEGORY_LABELS,
	type EvidenceRiskCategory,
	type EvidenceRiskLevel,
} from "@/lib/domain/evidence-risk";
import { getRiskModelRuntime } from "@/lib/llm/generation";

const CATEGORY_VALUES = Object.keys(
	EVIDENCE_RISK_CATEGORY_LABELS,
) as [EvidenceRiskCategory, ...EvidenceRiskCategory[]];

/**
 * The stored vocabulary for these two fields.
 *
 * Both columns are free text, which is how every row ended up "neutral" and
 * "unknown": the providers write a default and nothing ever revised it. Pinning
 * the values here is what lets a filter offer them and mean it.
 */
export const EVIDENCE_SENTIMENTS = ["negative", "neutral", "positive"] as const;
export const EVIDENCE_STANCES = [
	"critical",
	"neutral",
	"supportive",
	"unknown",
] as const;

export const evidenceRiskClassificationSchema = z.object({
	items: z.array(
		z.object({
			categories: z.array(z.enum(CATEGORY_VALUES)).max(4),
			confidence: z.number().min(0).max(1),
			id: z.string().trim().min(1),
			rationale: z.string().trim().min(1).max(400),
			riskLevel: z.enum(["low", "medium", "high"]),
			sentiment: z.enum(EVIDENCE_SENTIMENTS),
			stance: z.enum(EVIDENCE_STANCES),
		}),
	),
});

export type EvidenceSentiment = (typeof EVIDENCE_SENTIMENTS)[number];
export type EvidenceStance = (typeof EVIDENCE_STANCES)[number];

export type EvidenceRiskClassification = {
	categories: EvidenceRiskCategory[];
	confidence: number;
	level: EvidenceRiskLevel;
	rationale: string;
	sentiment: EvidenceSentiment;
	stance: EvidenceStance;
};

export type EvidenceRiskInput = {
	author?: string | null;
	comments?: number;
	id: string;
	reactions?: number;
	shares?: number;
	sourceLabel?: string | null;
	text: string;
};

const BATCH_SIZE = 12;
const MAX_TEXT_LENGTH = 2_400;

export function isRiskClassificationAvailable() {
	return Boolean(getRiskModelRuntime());
}

/**
 * Scores Vietnamese social content with the configured LLM. Callers are expected
 * to fall back to `assessEvidenceRisk` for any id the model does not return, so a
 * provider outage degrades to the deterministic rubric instead of failing a scan.
 */
export async function classifyEvidenceRisk(
	items: EvidenceRiskInput[],
): Promise<Map<string, EvidenceRiskClassification>> {
	const result = new Map<string, EvidenceRiskClassification>();
	if (!items.length) return result;
	const runtime = getRiskModelRuntime();
	if (!runtime) return result;

	const batches: EvidenceRiskInput[][] = [];
	for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
		batches.push(items.slice(offset, offset + BATCH_SIZE));
	}

	const settled = await Promise.allSettled(
		batches.map((batch) => classifyBatch(runtime.model, batch)),
	);
	for (const outcome of settled) {
		if (outcome.status !== "fulfilled") continue;
		for (const [id, classification] of outcome.value) {
			result.set(id, classification);
		}
	}
	return result;
}

async function classifyBatch(
	model: NonNullable<ReturnType<typeof getRiskModelRuntime>>["model"],
	batch: EvidenceRiskInput[],
) {
	const known = new Set(batch.map((item) => item.id));
	const { output } = await generateText({
		model,
		output: Output.object({ schema: evidenceRiskClassificationSchema }),
		prompt: JSON.stringify({
			items: batch.map((item) => ({
				author: item.author ?? null,
				engagement: {
					comments: item.comments ?? 0,
					reactions: item.reactions ?? 0,
					shares: item.shares ?? 0,
				},
				id: item.id,
				source: item.sourceLabel ?? null,
				text: item.text.slice(0, MAX_TEXT_LENGTH),
			})),
			task: "Chấm mức rủi ro, sắc thái và lập trường cho từng bài viết theo đúng rubric. Trả về đủ mọi id đã nhận.",
		}),
		system: RISK_SYSTEM_PROMPT,
		temperature: 0,
	});

	const mapped = new Map<string, EvidenceRiskClassification>();
	for (const item of output.items) {
		if (!known.has(item.id)) continue;
		mapped.set(item.id, {
			categories: item.categories.length ? item.categories : ["unclassified"],
			confidence: item.confidence,
			level: item.riskLevel,
			rationale: item.rationale,
			sentiment: item.sentiment,
			stance: item.stance,
		});
	}
	return mapped;
}

const RISK_SYSTEM_PROMPT = `Bạn là chuyên gia phân loại rủi ro thông tin công cộng tại Việt Nam. Với mỗi bài viết, hãy xác định mức rủi ro cần ưu tiên rà soát. Đây là mức độ ưu tiên xử lý, không phải kết luận đúng/sai và không phải đánh giá đạo đức của tác giả.

Đọc kỹ nội dung, kể cả khi người viết cố tình viết lệch chuẩn để né bộ lọc (chèn dấu chấm, ký tự lạ, viết tắt, xen ký tự giữa các chữ). Hãy khôi phục nghĩa thật của từ trước khi chấm điểm.

Mức "high" khi bài viết có ít nhất một trong các đặc điểm:
- Chính trị nhạy cảm: bàn về Đảng, Nhà nước, thể chế, lãnh tụ, ý thức hệ, lịch sử chiến tranh hoặc cách mạng theo hướng tranh cãi, quy kết, hạ thấp hoặc kích động; diễn ngôn về đế quốc, ngoại bang, chủ quyền, biển đảo; kêu gọi thay đổi chế độ; cáo buộc chống phá hoặc phản động.
- An ninh, trật tự: an ninh quốc gia, an ninh trật tự, công an, quân đội, quốc phòng, biên phòng, biểu tình, tụ tập đông người, gây rối, khủng bố, vũ khí.
- Pháp lý và cưỡng chế: bắt giữ, khởi tố, xét xử, kỷ luật cán bộ, tham nhũng, cưỡng chế, đình chỉ, thu hồi giấy phép, kiện tụng.
- Xung đột và thương vong: chiến tranh, quân sự, bạo lực, thương vong, tấn công mạng, lừa đảo chiếm đoạt tài sản.
- Thông tin sai lệch: xuyên tạc, bịa đặt, kích động, dẫn dắt dư luận, tin chưa kiểm chứng có sức lan tỏa.
- Ngôn từ công kích, thô tục nhắm vào cơ quan, tổ chức, lãnh đạo hoặc một nhóm người.

Mức "medium" khi bài viết nói về chính sách, cơ quan nhà nước, lãnh đạo, quy hoạch, điều tra hoặc vấn đề công cộng theo hướng đưa tin trung tính, chưa có sự kiện nghiêm trọng; hoặc nội dung tiêu cực về dân sinh đang thu hút chú ý lớn nhưng chưa chạm các nhóm "high".

Mức "low" cho thông tin thường nhật: giáo dục tích cực, học bổng, miễn giảm học phí, khen thưởng, lễ khai giảng hay tốt nghiệp, khuyến mãi, bảng giá, lịch nghỉ, tuyển dụng, thời tiết, thể thao, hoạt động cộng đồng, thiện nguyện.

Nguyên tắc bắt buộc:
- Chấm theo bản chất nội dung. Uy tín của trang nguồn và lượng tương tác không tự động nâng hoặc hạ mức rủi ro; tương tác chỉ là tín hiệu phụ khi nội dung đã ở ranh giới.
- Nội dung chính trị hoặc an ninh luôn tối thiểu là "high" ngay cả khi giọng văn bình thản.
- categories chọn từ danh sách cho phép và phải nhất quán với riskLevel.
- rationale viết bằng tiếng Việt tự nhiên, một đến hai câu, nêu đúng dấu hiệu quan sát được trong văn bản, không suy diễn về danh tính hay động cơ cá nhân.
- confidence phản ánh mức chắc chắn thực tế; hạ thấp khi văn bản quá ngắn hoặc mơ hồ.
- Trả về đúng một mục cho mỗi id nhận được, không thêm id mới.

Ngoài mức rủi ro, hãy chấm thêm hai trường độc lập:

sentiment — sắc thái cảm xúc của chính văn bản:
- "negative": giọng bức xúc, chê trách, lo ngại, mỉa mai, tố cáo, than phiền.
- "positive": giọng khen ngợi, biết ơn, cổ vũ, chia vui, thông báo tin tốt.
- "neutral": đưa tin, mô tả, thông báo hành chính, hỏi đáp không kèm cảm xúc rõ rệt.

stance — lập trường của người viết đối với cơ quan nhà nước, chính quyền hoặc chính sách được nhắc tới:
- "critical": phản đối, chỉ trích, quy kết, đòi hỏi trách nhiệm.
- "supportive": ủng hộ, đồng tình, bênh vực, lan tỏa thông điệp chính thống.
- "neutral": có nhắc tới nhưng không nghiêng về phía nào.
- "unknown": bài viết không nói về cơ quan nhà nước, chính quyền hay chính sách nào.

Hai trường này độc lập với nhau và với riskLevel: một bài đưa tin trung tính về vụ bắt giữ vẫn có thể là rủi ro cao, sắc thái trung tính và lập trường unknown. Đừng suy ra trường này từ trường kia.`;
