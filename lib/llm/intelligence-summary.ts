import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import type { IntelligenceAnalyticsView } from "@/components/dashboard/types";
import type { IntelligenceEvidenceSample } from "@/lib/dashboard/intelligence-analytics";
import { getRiskModelRuntime } from "@/lib/llm/generation";

/**
 * A written read of the window, from the aggregates and nothing else.
 *
 * The page already showed every number a person needs; what it did not do was
 * say which of them mattered. Six charts is a lot to hold at once, and the thing
 * a duty officer wants — "what changed, and what should I look at first" — was
 * left as an exercise.
 *
 * The model gets the aggregates *and* a bounded sample of what was actually
 * posted, each row carrying the classification already stored for it. Numbers
 * alone can say criticism rose eighteen per cent but never what the criticism is
 * about, which is the first thing anyone asks. Both halves are real rows from
 * the database, so this is a reading of the data rather than a guess about it.
 *
 * Every bullet has to name the figure or the theme it rests on, so a reader can
 * check it against the charts without leaving the page.
 */

const summarySchema = z.object({
	/** One sentence a person could read aloud in a morning briefing. */
	headline: z.string().min(10).max(200),
	/** What deserves attention first, and why — grounded in a named figure. */
	focus: z.string().min(10).max(300),
	trends: z
		.array(
			z.object({
				/** The figure this rests on, e.g. "Kinh tế & Tài chính: 872 bài". */
				evidence: z.string().min(3).max(120),
				direction: z.enum(["up", "down", "steady"]),
				title: z.string().min(3).max(80),
				detail: z.string().min(10).max(240),
			}),
		)
		.min(2)
		.max(5),
	/**
	 * The specific things being discussed, clustered from the sample.
	 *
	 * Distinct from `trends`, which are movements. This is the standing list a
	 * reader scans to answer "what is going on right now" — "tội phạm mạng liên
	 quan cờ bạc trực tuyến", not "Tội phạm & Thực thi pháp luật". The taxonomy
	 * and the hashtags each get half way there: one is too coarse to name a
	 * subject, the other too fragmentary to describe one.
	 */
	topics: z
		.array(
			z.object({
				/** How many posts in the sample belong to this cluster. */
				count: z.number().int().min(1),
				/** Where it sits: negative, neutral or positive in tone. */
				sentiment: z.enum(["negative", "neutral", "positive"]),
				/** The concrete subject, in a phrase. */
				subject: z.string().min(4).max(90),
				/** What is being said about it. */
				summary: z.string().min(10).max(220),
			}),
		)
		.min(2)
		.max(6),
});

export type IntelligenceSummary = z.infer<typeof summarySchema> & {
	generatedAt: string;
};

const SYSTEM_PROMPT = `Bạn là chuyên viên phân tích thông tin, viết bằng tiếng Việt tự nhiên, ngắn gọn, không sáo rỗng.

Bạn nhận hai loại dữ liệu: số liệu tổng hợp của kỳ, và một mẫu bài viết thực tế đã được phân loại sẵn (sắc thái, lập trường, mức rủi ro, chủ đề). Vì vậy:
- Chỉ mô tả chủ đề, sắc thái và lập trường ĐÚNG như những gì có trong mẫu và số liệu được cung cấp. Không suy rộng ra ngoài phạm vi đó.
- Nêu VIỆC CỤ THỂ đang được bàn, không nêu tên nhóm phân loại. Ví dụ nên viết "tranh luận quanh việc thu hồi đất ở một dự án hạ tầng" chứ không viết "chủ đề Giao thông & Hạ tầng tăng". Tên nhóm phân loại là cách sắp xếp hồ sơ, không phải điều người dân đang nói.
- Nếu nhiều bài cùng nói về một sự việc, hãy gộp lại và mô tả sự việc đó.
- Trường "count" phải là số bài THỰC SỰ đếm được trong mẫu cho nhóm đó, không ước lượng.
- Không trích nguyên văn bài viết. Hãy khái quát thành chủ đề chung.
- Không quy kết ý định, danh tính hay động cơ của cá nhân, tổ chức nào.
- Mỗi nhận định phải gắn với một con số hoặc một chủ đề có thật trong dữ liệu, ghi rõ ở trường "evidence".
- Nếu dữ liệu không đủ để kết luận, hãy nói thẳng là chưa đủ dữ liệu thay vì phỏng đoán.
- Không đề xuất đăng bài tự động. Mọi khuyến nghị đều là việc để người xem xét.

Viết cho người trực ban đọc trong 30 giây: cái gì đã thay đổi, và nên xem gì trước.`;

/**
 * Reduces the view to the numbers worth reasoning about.
 *
 * Deliberately not the whole object: the daily trend is ninety points of noise
 * for this purpose, and handing a model more than it needs is how it starts
 * finding patterns in the padding.
 */
function toPromptFacts(analytics: IntelligenceAnalyticsView) {
	const { previousPeriod, riskByLevel, total } = analytics;
	return {
		khoangThoiGian: analytics.timeRange,
		tongSoBai: total,
		mucRuiRo: riskByLevel,
		soSanhKyTruoc: previousPeriod
			? {
					tongKyTruoc: previousPeriod.total,
					ruiRoCaoKyTruoc: previousPeriod.high,
				}
			: null,
		sacThai: analytics.sentiment,
		lapTruong: analytics.stance,
		tuongTacTheoMucRuiRo: analytics.reach,
		ngayCaoDiem: analytics.peakDay,
		nguyenNhanRuiRo: analytics.riskCategories.map((row) => ({
			nhan: row.label,
			so: row.count,
		})),
		chuDe: analytics.topics.map((row) => ({
			ruiRoCao: row.high,
			ten: row.name,
			tong: row.total,
		})),
		chuDeBienDong: analytics.momentum.map((row) => ({
			kyNay: row.current,
			kyTruoc: row.previous,
			ten: row.name,
		})),
		nguon: analytics.sources.map((row) => ({
			ruiRoCao: row.highRiskCount,
			ten: row.label,
			tong: row.total,
		})),
		// The authors' own words for what they were posting about, which is what
		// a reader means by "trending" — the taxonomy above is a filing system.
		theDangDungNhieu: analytics.hashtags.map((row) => ({
			soBai: row.total,
			the: `#${row.tag}`,
			tuongTac: row.engagement,
		})),
	};
}

/**
 * Returns null rather than throwing.
 *
 * The summary is the one part of this page that depends on a third party being
 * up. Every chart beside it is already rendered from the database, so a provider
 * outage should cost the reader a paragraph, not the page.
 */
export async function summarizeIntelligence(
	analytics: IntelligenceAnalyticsView,
	samples: IntelligenceEvidenceSample[] = [],
): Promise<IntelligenceSummary | null> {
	const runtime = getRiskModelRuntime();
	if (!runtime) return null;
	// Nothing to summarise, and a model asked to find trends in an empty window
	// will invent some.
	if (analytics.total === 0) return null;

	try {
		const { output } = await generateText({
			model: runtime.model,
			output: Output.object({ schema: summarySchema }),
			prompt: JSON.stringify({
				soLieu: toPromptFacts(analytics),
				// Trimmed again here, not only in SQL: the sample is drawn by reach,
				// so the tail is short posts nobody engaged with.
				mauBaiViet: samples.slice(0, 28).map((item) => ({
					chuDe: item.topics,
					lapTruong: item.stance,
					noiDung: item.quote,
					nguon: item.source,
					ruiRo: item.riskLevel,
					sacThai: item.sentiment,
					tuongTac: item.engagement,
				})),
				yeuCau:
					"Hai việc. (1) 'topics': gom mẫu bài viết thành 2-6 NHÓM NỘI DUNG CỤ THỂ đang được bàn, mỗi nhóm ghi rõ sự việc là gì, đang nói gì về nó, có bao nhiêu bài trong mẫu và sắc thái chung. Ví dụ đúng: 'Tội phạm mạng liên quan cờ bạc trực tuyến', 'Tranh chấp đền bù thu hồi đất tại một dự án hạ tầng'. Ví dụ SAI vì quá chung: 'Chính trị', 'An ninh trật tự'. (2) 'trends': 2-5 thay đổi đáng chú ý so với kỳ trước, mỗi thay đổi gắn với một con số cụ thể.",
			}),
			system: SYSTEM_PROMPT,
			temperature: 0.2,
		});
		return { ...output, generatedAt: new Date().toISOString() };
	} catch {
		return null;
	}
}
