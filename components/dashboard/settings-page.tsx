import Link from "next/link";
import {
	ArrowUpRight,
	MonitorCog,
	UsersRound,
	BookOpen,
	ShieldCheck,
} from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ZaloSettingsPanel } from "@/components/dashboard/zalo-settings-panel";
import { QueryProvider } from "@/components/providers/query-provider";

export async function SettingsPage() {
	return (
		<div className="space-y-5">
			<PageHeader
				icon={ShieldCheck}
				title="Cấu hình"
				description="Kết nối kênh xuất bản, quản lý quyền truy cập và kiểm tra trạng thái hệ thống."
			/>
			<div className="grid gap-4 md:grid-cols-3">
				{[
					{
						href: "/operations",
						title: "Vận hành & chi phí",
						description: "Kiểm tra lịch quét, kết nối và chi phí AI, Apify.",
						icon: MonitorCog,
					},
					{
						href: "/members",
						title: "Thành viên & quyền truy cập",
						description: "Quản lý thành viên và tài khoản được phép sử dụng.",
						icon: UsersRound,
					},
					{
						href: "/guides/user-guide",
						title: "Hướng dẫn sử dụng",
						description: "Các bước thiết lập và quy trình làm việc hằng ngày.",
						icon: BookOpen,
					},
				].map(({ href, title, description, icon: Icon }) => (
					<Link
						key={href}
						href={href}
						className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]"
					>
						<div className="flex items-center justify-between text-[var(--accent-strong)]">
							<Icon size={21} />
							<ArrowUpRight size={17} />
						</div>
						<h2 className="mt-4 text-sm font-semibold">{title}</h2>
						<p className="mt-2 text-sm leading-6 text-[var(--muted)]">
							{description}
						</p>
					</Link>
				))}
			</div>
			<QueryProvider>
				<Suspense
					fallback={
						<div className="h-48 animate-pulse rounded-lg bg-[var(--surface)]" />
					}
				>
					<ZaloSettingsPanel />
				</Suspense>
			</QueryProvider>
		</div>
	);
}
