import type {
	AnalysisRow,
	CounterArgumentDraftRow,
	EvidenceItemRow,
	ProviderName,
	RiskLevel,
	SourceType,
} from "@/lib/db/schema";

export type DashboardScan = {
	id: string;
	status: "queued" | "running" | "completed" | "failed" | "retrying";
	sourceType: SourceType;
	provider: ProviderName;
	title: string;
	sourceLabel: string;
	riskLevel: RiskLevel;
	progress: number;
	createdAt: string;
};

export const demoScans: DashboardScan[] = [
	{
		id: "demo-scan-1",
		status: "running",
		sourceType: "facebook_post",
		provider: "apify_facebook_comments",
		title: "Bài viết: thông tin sai lệch về chính sách",
		sourceLabel: "Facebook",
		riskLevel: "high",
		progress: 45,
		createdAt: "2026-06-13T09:12:00.000Z",
	},
	{
		id: "demo-scan-2",
		status: "queued",
		sourceType: "url",
		provider: "firecrawl",
		title: "https://example-news.vn/y-kien/du-thao-luat",
		sourceLabel: "Website",
		riskLevel: "medium",
		progress: 0,
		createdAt: "2026-06-13T09:05:00.000Z",
	},
	{
		id: "demo-scan-3",
		status: "completed",
		sourceType: "url",
		provider: "firecrawl",
		title: "https://example-news.vn/bai-viet/12345",
		sourceLabel: "Website",
		riskLevel: "medium",
		progress: 100,
		createdAt: "2026-06-13T08:58:00.000Z",
	},
	{
		id: "demo-scan-4",
		status: "completed",
		sourceType: "file",
		provider: "firecrawl_parse",
		title: "Tai_lieu_phan_tich_chinh_sach.pdf",
		sourceLabel: "Tệp",
		riskLevel: "low",
		progress: 100,
		createdAt: "2026-06-13T08:45:00.000Z",
	},
	{
		id: "demo-scan-5",
		status: "failed",
		sourceType: "text",
		provider: "local_text",
		title: "Văn bản nhập thủ công",
		sourceLabel: "Văn bản",
		riskLevel: "medium",
		progress: 0,
		createdAt: "2026-06-13T08:30:00.000Z",
	},
];

export const demoEvidence = [
	{
		id: "ev-1",
		quote: "Thông tin này là không chính xác và chưa được kiểm chứng.",
		summary: "Bình luận phản đối nội dung nguồn và yêu cầu kiểm chứng.",
		sourceUrl: "https://facebook.com/example/posts/1",
		sourceLabel: "facebook.com",
		author: "Nguồn công khai",
		stance: "phản đối",
		sentiment: "tiêu cực",
		riskLevel: "high" as const,
		engagement: { comments: 245, shares: 37, reactions: 1200 },
	},
	{
		id: "ev-2",
		quote: "Không có căn cứ pháp lý cho quy định này.",
		summary: "Nội dung nêu nghi vấn về cơ sở pháp lý của chính sách.",
		sourceUrl: "https://facebook.com/example/posts/1?comment_id=2",
		sourceLabel: "facebook.com",
		author: "Nguồn công khai",
		stance: "phản đối",
		sentiment: "tiêu cực",
		riskLevel: "medium" as const,
		engagement: { comments: 91, shares: 12, reactions: 430 },
	},
	{
		id: "ev-3",
		quote: "Gây ảnh hưởng nghiêm trọng đến người dân nếu áp dụng vội vàng.",
		summary: "Bình luận cảnh báo tác động xã hội và cần thêm giải thích.",
		sourceUrl: "https://facebook.com/example/posts/1?comment_id=3",
		sourceLabel: "facebook.com",
		author: "Nguồn công khai",
		stance: "lo ngại",
		sentiment: "tiêu cực",
		riskLevel: "high" as const,
		engagement: { comments: 131, shares: 24, reactions: 780 },
	},
] satisfies Array<Partial<EvidenceItemRow> & { id: string }>;

export const demoAnalysis = {
	id: "analysis-demo",
	scanJobId: "demo-scan-1",
	riskLevel: "high",
	summary:
		"Nội dung lan truyền thông tin chưa được kiểm chứng về chính sách mới, có khả năng gây hiểu lầm và hoang mang dư luận.",
	stanceSummary: "Lập trường chủ đạo: Phản đối tiêu cực.",
	topicClusters: [
		{ name: "Chính sách đất đai mới", count: 1248, trend: "+35%", riskLevel: "high" },
		{ name: "Dự thảo luật an ninh mạng", count: 856, trend: "+18%", riskLevel: "medium" },
		{ name: "Quy định dữ liệu cá nhân", count: 642, trend: "-12%", riskLevel: "low" },
	],
	claims: [
		{
			claim: "Chính sách mới thiếu căn cứ pháp lý",
			stance: "opposed",
			confidence: 0.74,
			evidenceIds: ["ev-2"],
		},
	],
	riskFlags: [
		{ label: "Thông tin sai lệch", count: 16, severity: "high" },
		{ label: "Xuyên tạc chính sách", count: 12, severity: "medium" },
		{ label: "Kêu gọi hành động tiêu cực", count: 5, severity: "medium" },
		{ label: "Ngôn từ kích động", count: 3, severity: "low" },
	],
	sentiment: { positive: 18, neutral: 32, negative: 50, total: 1248 },
	createdAt: new Date("2026-06-13T09:15:00.000Z"),
} satisfies Partial<AnalysisRow> & { id: string };

export const demoDraft = {
	id: "draft-demo",
	scanJobId: "demo-scan-1",
	status: "needs_review",
	tone: "Điềm tĩnh, khách quan",
	audience: "Công chúng chung",
	language: "vi",
	length: "medium",
	body:
		"Thông tin đang được chia sẻ cần được đối chiếu với văn bản chính thức. Các bằng chứng hiện có cho thấy một số kết luận trong bài viết chưa có căn cứ đầy đủ. Cơ quan phụ trách nên công bố nguồn tham chiếu, giải thích phạm vi áp dụng và tiếp nhận phản hồi để người dân hiểu đúng chính sách.",
	citations: [
		{ evidenceId: "ev-1", label: "Trích dẫn 1" },
		{ evidenceId: "ev-2", label: "Trích dẫn 2" },
	],
	safetyNotes: [
		"Chỉ sử dụng bằng chứng đã lưu trong hệ thống.",
		"Không tự động đăng tải nội dung phản hồi.",
	],
	createdAt: new Date("2026-06-13T09:18:00.000Z"),
	updatedAt: new Date("2026-06-13T09:18:00.000Z"),
} satisfies Partial<CounterArgumentDraftRow> & { id: string };

export function buildDemoProviderEvidence(sourceLabel = "Nguồn công khai") {
	return demoEvidence.map((item, index) => ({
		...item,
		id: undefined,
		metadata: { fixture: true },
		publishedAt: null,
		sourceLabel,
		summary: `${item.summary} Mẫu bằng chứng ${index + 1}.`,
	}));
}
