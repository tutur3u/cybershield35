import {
	Activity,
	AlertTriangle,
	BarChart3,
	Database,
	FileBarChart,
	FileSearch,
	History,
	LayoutDashboard,
	Layers3,
	MessageCircle,
	MessageSquareText,
	Radar,
	UsersRound,
	type LucideIcon,
} from "lucide-react";

import type { ReportSpec } from "@/components/dashboard/types";

export type NavItem = {
	label: string;
	href: string;
	icon: LucideIcon;
};

export const navItems: NavItem[] = [
	{ label: "Tổng quan", href: "/", icon: LayoutDashboard },
	{ label: "Nguồn & Quét", href: "/sources", icon: Radar },
	{ label: "Phân tích", href: "/analysis", icon: BarChart3 },
	{ label: "Chủ đề", href: "/topics", icon: Layers3 },
	{ label: "Lập luận phản hồi", href: "/counter-arguments", icon: MessageSquareText },
	{ label: "Chat LLM", href: "/chat", icon: MessageCircle },
	{ label: "Thành viên", href: "/members", icon: UsersRound },
	{ label: "Kho bằng chứng", href: "/evidence", icon: Database },
	{ label: "Cảnh báo & Rủi ro", href: "/alerts", icon: AlertTriangle },
	{ label: "Báo cáo", href: "/reports", icon: FileBarChart },
	{ label: "Nhật ký hoạt động", href: "/audit", icon: History },
];

export const quickLinks = [
	{ label: "Quy trình 5 bước", href: "/guides/5-step-process" },
	{ label: "Hướng dẫn sử dụng", href: "/guides/user-guide" },
	{ label: "Chính sách & Quy định", href: "/guides/policies" },
];

export const sourceTabs = [
	{ id: "url", label: "URL / Mạng xã hội" },
	{ id: "file", label: "Tải tệp" },
	{ id: "text", label: "Văn bản" },
] as const;

export type SourceTab = (typeof sourceTabs)[number]["id"];

export const socialSources = [
	{
		label: "Facebook",
		value: "facebook",
		accent: "#1877f2",
		iconSrc: "/brand-icons/facebook.svg",
		coverage: "Bài viết, trang, nhóm và bình luận công khai",
	},
	{
		label: "Website tùy chỉnh",
		value: "website",
		accent: "#3b82f6",
		iconSrc: null,
		coverage: "Liên kết website, tệp và văn bản do người vận hành cung cấp",
	},
];

export const providerRows = [
	{
		key: "googleGenerativeAi",
		label: "Google AI",
		helper: "Phân tích Gemini và tạo bản nháp phản hồi",
		active: true,
	},
	{
		key: "apify",
		label: "Apify",
		helper: "Bài viết, bình luận và nhóm Facebook",
		active: true,
	},
	{
		key: "firecrawl",
		label: "Firecrawl",
		helper: "Quét web, tìm kiếm và phân tích trang",
		active: true,
	},
	{
		key: "browserUse",
		label: "Browser Use",
		helper: "Làm giàu dữ liệu từ trang động",
		active: true,
	},
] as const;

export const queueStats = [
	{ label: "Đang chờ", value: "12", tone: "neutral" },
	{ label: "Đang quét", value: "3", tone: "warning" },
	{ label: "Hoàn tất", value: "24", tone: "success" },
	{ label: "Lỗi", value: "2", tone: "danger" },
] as const;

export const sentimentSlices = [
	{ label: "Tích cực", value: 18, color: "#38a169" },
	{ label: "Trung lập", value: 32, color: "#94a3b8" },
	{ label: "Tiêu cực", value: 50, color: "#ef4444" },
];

export const stanceRows = [
	{ label: "Ủng hộ", value: 22, color: "#38a169" },
	{ label: "Trung lập", value: 28, color: "#94a3b8" },
	{ label: "Phản đối", value: 50, color: "#ef4444" },
];

export const riskRows = [
	{ label: "Cao", value: 12, color: "#ef4444" },
	{ label: "Trung bình", value: 28, color: "#f59e0b" },
	{ label: "Thấp", value: 64, color: "#38a169" },
];

export const alertRows = [
	{ label: "Thông tin sai lệch", count: 16 },
	{ label: "Xuyên tạc chính sách", count: 12 },
	{ label: "Kêu gọi hành động tiêu cực", count: 5 },
	{ label: "Ngôn từ kích động", count: 3 },
];

export const sourceModeIcons = {
	url: Activity,
	file: FileSearch,
	text: MessageSquareText,
};

export const composerOptions = {
	tones: ["Điềm tĩnh, khách quan", "Ngắn gọn, trực diện", "Giải thích thân thiện"],
	audiences: ["Công chúng chung", "Cán bộ truyền thông", "Nhóm chuyên môn"],
	languages: ["Tiếng Việt", "English"],
	lengths: ["Ngắn", "Trung bình", "Dài"],
};

export const reportSpecs: ReportSpec[] = [
	{
		kind: "executive",
		title: "Tóm tắt lãnh đạo",
		description: "Một trang về rủi ro, bằng chứng và khuyến nghị.",
		sections: [
			"Mức rủi ro và lập trường chủ đạo",
			"Cụm chủ đề cần ưu tiên",
			"Khuyến nghị điều phối nội bộ",
		],
	},
	{
		kind: "evidence",
		title: "Bộ bằng chứng",
		description: "Danh sách trích dẫn, nguồn và mức rủi ro.",
		sections: [
			"Trích dẫn đã chuẩn hóa",
			"Nguồn, tác giả công khai và tương tác",
			"Liên kết scan và rủi ro",
		],
	},
	{
		kind: "operations",
		title: "Nhật ký xử lý",
		description: "Dòng thời gian scan, provider và duyệt bản nháp.",
		sections: [
			"Provider đã chạy",
			"Trạng thái scan và audit",
			"Hoạt động duyệt bản nháp",
		],
	},
];
