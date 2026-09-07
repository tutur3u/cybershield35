"use client";

import { ChevronRight, CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import { IntentPrefetchLink } from "./intent-prefetch-link";

const areas = [
	{ prefix: "/usage", label: "Mức sử dụng", group: "Quản trị", href: "/usage" },
	{
		prefix: "/sources",
		label: "Nguồn & Quét",
		group: "Thu thập",
		href: "/sources",
	},
	{ prefix: "/scans", label: "Lượt quét", group: "Thu thập", href: "/sources" },
	{
		prefix: "/evidence",
		label: "Dòng thời gian",
		group: "Theo dõi",
		href: "/evidence",
	},
	{
		prefix: "/intelligence",
		label: "Phân tích",
		group: "Theo dõi",
		href: "/intelligence",
	},
	{
		prefix: "/articles",
		label: "Bài viết",
		group: "Biên tập",
		href: "/articles",
	},
	{
		prefix: "/drafts",
		label: "Bản nháp",
		group: "Biên tập",
		href: "/articles",
	},
	{
		prefix: "/operations",
		label: "Vận hành",
		group: "Quản trị",
		href: "/operations",
	},
	{
		prefix: "/settings",
		label: "Cấu hình",
		group: "Quản trị",
		href: "/settings",
	},
	{
		prefix: "/members",
		label: "Thành viên",
		group: "Quản trị",
		href: "/members",
	},
	{ prefix: "/audit", label: "Nhật ký", group: "Quản trị", href: "/audit" },
	{
		prefix: "/guides",
		label: "Hướng dẫn",
		group: "Trợ giúp",
		href: "/guides/user-guide",
	},
];

export function WorkspaceContext() {
	const pathname = usePathname();
	const area = areas.find(
		(item) =>
			pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
	);
	if (pathname.startsWith("/chat")) return null;
	const detail =
		area &&
		pathname.slice(area.prefix.length).length > 1 &&
		area.prefix !== "/guides";
	return (
		<div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
			<nav
				aria-label="Vị trí hiện tại"
				className="flex min-w-0 flex-wrap items-center gap-2"
			>
				<IntentPrefetchLink
					href="/"
					className="hidden font-semibold hover:text-[var(--foreground)] sm:inline"
				>
					CyberShield 35
				</IntentPrefetchLink>
				<ChevronRight
					size={12}
					aria-hidden="true"
					className="hidden sm:block"
				/>
				<span className={area ? "hidden sm:inline" : ""}>
					{area?.group ?? "Không gian làm việc"}
				</span>
				{area ? (
					<>
						<ChevronRight
							size={12}
							aria-hidden="true"
							className="hidden sm:block"
						/>
						{detail ? (
							<IntentPrefetchLink
								href={area.href}
								className="hover:text-[var(--accent-strong)]"
							>
								{area.label}
							</IntentPrefetchLink>
						) : (
							<span
								aria-current="page"
								className="font-medium text-[var(--foreground)]"
							>
								{area.label}
							</span>
						)}
					</>
				) : null}
				{detail ? (
					<>
						<ChevronRight size={12} aria-hidden="true" />
						<span aria-current="page">Chi tiết</span>
					</>
				) : null}
			</nav>
			<IntentPrefetchLink
				href="/guides/user-guide"
				className="inline-flex min-h-9 items-center gap-1.5 hover:text-[var(--accent-strong)]"
			>
				<CircleHelp size={14} />
				Hướng dẫn
			</IntentPrefetchLink>
		</div>
	);
}
