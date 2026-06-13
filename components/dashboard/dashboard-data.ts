import {
	Activity,
	AlertTriangle,
	BarChart3,
	Database,
	FileBarChart,
	FileSearch,
	History,
	LayoutDashboard,
	LockKeyhole,
	MessageSquareText,
	Radar,
	Settings,
	ShieldCheck,
	UsersRound,
	type LucideIcon,
} from "lucide-react";

export type NavItem = {
	label: string;
	href: string;
	icon: LucideIcon;
};

export const navItems: NavItem[] = [
	{ label: "Tổng quan", href: "/", icon: LayoutDashboard },
	{ label: "Nguồn & Quét", href: "/sources", icon: Radar },
	{ label: "Phân tích", href: "/analysis", icon: BarChart3 },
	{ label: "Lập luận phản hồi", href: "/counter-arguments", icon: MessageSquareText },
	{ label: "Kho bằng chứng", href: "/evidence", icon: Database },
	{ label: "Cảnh báo & Rủi ro", href: "/alerts", icon: AlertTriangle },
	{ label: "Báo cáo", href: "/reports", icon: FileBarChart },
	{ label: "Cấu hình", href: "/settings", icon: Settings },
	{ label: "Nhật ký hoạt động", href: "/audit", icon: History },
];

export const quickLinks = [
	"Quy trình 5 bước",
	"Hướng dẫn sử dụng",
	"Chính sách & Quy định",
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
		coverage: "Posts, pages, groups, comments",
	},
	{
		label: "YouTube",
		value: "youtube",
		accent: "#ef4444",
		iconSrc: "/brand-icons/youtube.svg",
		coverage: "Videos, descriptions, comment context",
	},
	{
		label: "TikTok",
		value: "tiktok",
		accent: "#111827",
		iconSrc: "/brand-icons/tiktok.svg",
		coverage: "Public video links and captions",
	},
	{
		label: "X",
		value: "x",
		accent: "#0f172a",
		iconSrc: "/brand-icons/x.svg",
		coverage: "Posts, threads, public conversation",
	},
	{
		label: "Instagram",
		value: "instagram",
		accent: "#e4405f",
		iconSrc: "/brand-icons/instagram.svg",
		coverage: "Public posts and comments when available",
	},
	{
		label: "Khác",
		value: "other",
		accent: "#64748b",
		iconSrc: null,
		coverage: "Website, file, and pasted text sources",
	},
];

export const providerRows = [
	{ label: "Apify", helper: "Facebook posts, comments, groups", active: true },
	{ label: "Firecrawl", helper: "Web scrape, search, parse", active: true },
	{ label: "Browser Use", helper: "Dynamic page enrichment", active: true },
];

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

export const topBarItems = [
	{ label: "Hệ thống hoạt động", icon: ShieldCheck },
	{ label: "AI For Life - ai.daklak.gov.vn", icon: LockKeyhole },
	{ label: "Analyst Team", icon: UsersRound },
];

export const composerOptions = {
	tones: ["Điềm tĩnh, khách quan", "Ngắn gọn, trực diện", "Giải thích thân thiện"],
	audiences: ["Công chúng chung", "Cán bộ truyền thông", "Nhóm chuyên môn"],
	languages: ["Tiếng Việt", "English"],
	lengths: ["Ngắn", "Trung bình", "Dài"],
};
