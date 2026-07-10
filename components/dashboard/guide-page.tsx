import {
	ArrowRight,
	CheckCircle2,
	FileText,
	Radar,
	ScrollText,
} from "lucide-react";
import Link from "next/link";
import { cacheLife } from "next/cache";

import { PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelHeader } from "@/components/dashboard/ui-primitives";

type GuideKind = "process" | "user" | "policies";

export async function GuidePage({ kind }: { kind: GuideKind }) {
	"use cache";
	cacheLife("max");

	const content = guideContent[kind];

	return (
		<div className="space-y-5">
			<PageHeader
				icon={content.icon}
				title={content.title}
				description={content.description}
				actions={
					<Link
						href={content.primaryHref}
						className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						{content.primaryAction} <ArrowRight size={14} />
					</Link>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<Panel>
					<PanelHeader
						title={content.panelTitle}
						description={content.panelDescription}
					/>
					<div className="divide-y divide-[var(--divider)] p-4">
						{content.steps.map((step, index) => (
							<div
								key={step.title}
								className="grid gap-3 py-4 sm:grid-cols-[42px_minmax(0,1fr)]"
							>
								<span className="grid size-8 place-items-center rounded-md bg-[var(--accent-soft)] text-[12px] font-bold text-[var(--accent-strong)]">
									{index + 1}
								</span>
								<div className="min-w-0">
									<h2 className="text-[14px] font-bold text-[var(--foreground)]">
										{step.title}
									</h2>
									<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
										{step.body}
									</p>
								</div>
							</div>
						))}
					</div>
				</Panel>
				<Panel>
					<PanelHeader title="Ghi nhớ vận hành" />
					<div className="space-y-3 p-4">
						{content.notes.map((note) => (
							<div
								key={note}
								className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
							>
								<CheckCircle2
									className="mt-0.5 shrink-0 text-[var(--brand)]"
									size={16}
								/>
								<p className="text-[12px] leading-5 text-[var(--muted-strong)]">
									{note}
								</p>
							</div>
						))}
					</div>
				</Panel>
			</div>
		</div>
	);
}

const guideContent = {
	process: {
		icon: Radar,
		title: "Quy trình 5 bước",
		description:
			"Luồng chuẩn để tiếp nhận nguồn, phân tích bằng chứng và soạn phản hồi có kiểm duyệt.",
		panelTitle: "Chuỗi xử lý khuyến nghị",
		panelDescription:
			"Áp dụng cho Facebook công khai, website, tệp và văn bản nhập tay.",
		primaryAction: "Tạo scan mới",
		primaryHref: "/sources",
		steps: [
			{
				title: "Tiếp nhận nguồn",
				body: "Chọn nguồn Facebook hoặc website tùy chỉnh, tải tệp, hoặc dán văn bản trong hộp thoại tạo scan.",
			},
			{
				title: "Tự động chọn adapter",
				body: "Hệ thống chọn adapter dựa trên nguồn và chỉ sử dụng key được cấu hình bằng biến môi trường server-side.",
			},
			{
				title: "Chuẩn hóa bằng chứng",
				body: "Các trích dẫn, nguồn, tác giả công khai và tín hiệu tương tác được lưu để phục vụ phân tích có thể truy vết.",
			},
			{
				title: "Phân tích LLM có cấu trúc",
				body: "Topic, lập trường, cảm xúc và cờ rủi ro được ràng buộc theo schema để người vận hành rà soát nhất quán.",
			},
			{
				title: "Soạn phản hồi cần duyệt",
				body: "Bản nháp lập luận chỉ dùng bằng chứng đã lưu, không tự động đăng tải và phải được duyệt thủ công.",
			},
		],
		notes: [
			"Không nhập khóa bí mật vào Postgres, audit log, metadata nguồn hoặc provider run.",
			"Luôn kiểm tra bằng chứng trước khi phê duyệt bản nháp phản hồi.",
			"Khi dữ liệu live chưa đủ, tạo scan mới hoặc cấu hình provider còn thiếu thay vì suy diễn kết quả.",
		],
	},
	user: {
		icon: FileText,
		title: "Hướng dẫn sử dụng",
		description: "Các thao tác chính cho người vận hành dashboard CyberShield 35.",
		panelTitle: "Thao tác thường dùng",
		panelDescription:
			"Giữ các form trong hộp thoại và sử dụng từng trang cho một nhiệm vụ rõ ràng.",
		primaryAction: "Mở cấu hình",
		primaryHref: "/settings",
		steps: [
			{
				title: "Phiên đăng nhập",
				body: "Admin cấu hình auth bằng biến môi trường server-side, redeploy ứng dụng, rồi người vận hành mở lại dashboard.",
			},
			{
				title: "Kiểm tra cấu hình server",
				body: "Trong Cấu hình, kiểm tra Google AI, Apify, Firecrawl và Browser Use đã có key server-side trước khi tạo scan.",
			},
			{
				title: "Tạo scan",
				body: "Từ Nguồn & Quét, mở Tạo scan mới và nhập Facebook, website, tệp hoặc văn bản theo đúng mục.",
			},
			{
				title: "Đọc phân tích",
				body: "Dùng trang Phân tích để xem tóm tắt, cụm chủ đề, cảm xúc, cảnh báo và bằng chứng liên quan.",
			},
			{
				title: "Duyệt phản hồi",
				body: "Mở Lập luận phản hồi để tạo hoặc duyệt bản nháp. Chỉ xuất khi nội dung đã được người vận hành phê duyệt.",
			},
		],
		notes: [
			"Không nhập hoặc lưu khóa provider trong trình duyệt.",
			"Nhật ký hoạt động ghi lại các thao tác vận hành quan trọng để truy vết sau mỗi phiên.",
			"Nếu API riêng tư trả 401, hãy kiểm tra phiên đăng nhập và cấu hình server trước khi thao tác.",
		],
	},
	policies: {
		icon: ScrollText,
		title: "Chính sách & Quy định",
		description:
			"Ranh giới vận hành cho phân tích nguồn công khai và phản hồi nội bộ.",
		panelTitle: "Quy định bắt buộc",
		panelDescription:
			"Thiết kế cho kiểm duyệt nội bộ, không phải công cụ tự động đăng tải.",
		primaryAction: "Xem nhật ký",
		primaryHref: "/audit",
		steps: [
			{
				title: "Nguồn hợp lệ",
				body: "Chỉ dùng Facebook công khai, website tùy chỉnh, tệp được phép xử lý và văn bản do người vận hành cung cấp.",
			},
			{
				title: "Bảo mật khóa",
				body: "Provider và LLM key chỉ được cấu hình bằng biến môi trường server-side; không nhập khóa vào trình duyệt.",
			},
			{
				title: "Bằng chứng trước lập luận",
				body: "Mỗi phản hồi phải dựa trên evidence item đã lưu; không thêm tuyên bố chưa có trích dẫn hoặc nguồn hỗ trợ.",
			},
			{
				title: "Không nhắm mục tiêu nhạy cảm",
				body: "Không tạo nội dung phân phối theo nhân khẩu học, thuộc tính nhạy cảm hoặc hành vi thao túng người dùng.",
			},
			{
				title: "Duyệt thủ công",
				body: "Mọi bản nháp phản hồi giữ trạng thái cần duyệt cho đến khi người vận hành phê duyệt hoặc từ chối.",
			},
		],
		notes: [
			"Không thêm auto-posting, scheduler đăng bài hoặc tích hợp xuất bản trực tiếp.",
			"Audit trail phải ghi metadata chế độ chạy, không ghi raw key hoặc token.",
			"Chỉ xử lý nội dung theo quyền truy cập hợp lệ và quy định của tổ chức triển khai.",
		],
	},
} as const;
