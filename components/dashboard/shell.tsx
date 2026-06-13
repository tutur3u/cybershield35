"use client";

import { Bell, CircleHelp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems, quickLinks, topBarItems } from "@/components/dashboard/dashboard-data";

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="border-b border-[var(--border)] bg-white lg:border-b-0 lg:border-r">
			<div className="flex min-h-[72px] flex-col lg:h-full">
				<div className="flex h-16 items-center gap-3 border-b border-[var(--border)] px-4">
					<div className="grid size-9 place-items-center rounded-md border border-green-200 bg-green-50 text-[var(--brand)]">
						<ShieldCheck size={22} strokeWidth={2.4} />
					</div>
					<div className="min-w-0">
						<p className="truncate text-[18px] font-bold text-slate-950">
							CyberShield 35
						</p>
						<p className="truncate text-[11px] font-semibold text-slate-500">
							Admin Control
						</p>
					</div>
				</div>
				<nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible lg:py-4">
					{navItems.map((item) => {
						const active =
							item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

						return (
							<Link
								key={item.label}
								href={item.href}
								className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left text-[12px] font-semibold transition lg:h-11 lg:w-full lg:gap-3 lg:text-[13px] ${
									active
										? "bg-[var(--brand)] text-white shadow-sm"
										: "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
								}`}
							>
								<item.icon size={17} strokeWidth={2.1} />
								<span className="truncate">{item.label}</span>
							</Link>
						);
					})}
				</nav>
				<div className="mt-auto hidden p-3 lg:block">
					<div className="rounded-lg border border-[var(--border)] bg-slate-50 p-3">
						<p className="text-[13px] font-bold text-slate-800">Hướng dẫn nhanh</p>
						<div className="mt-3 space-y-2">
							{quickLinks.map((link) => (
								<div
									key={link}
									className="flex items-center gap-2 text-[11px] text-slate-600"
								>
									<CircleHelp size={13} />
									<span className="truncate">{link}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</aside>
	);
}

export function TopBar({ notice }: { notice: string }) {
	return (
		<header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-4 py-3">
			<div className="flex min-w-0 flex-wrap items-center gap-3">
				{topBarItems.map((item, index) => (
					<div
						key={item.label}
						className="flex items-center gap-2 text-[12px] font-semibold text-slate-700"
					>
						<item.icon
							size={15}
							className={index === 0 ? "text-[var(--brand)]" : "text-slate-500"}
						/>
						<span className="truncate">{item.label}</span>
					</div>
				))}
			</div>
			<div className="flex min-w-0 flex-wrap items-center gap-3 text-[12px] font-semibold text-slate-700">
				<span>10:24 AM</span>
				<span>23/05/2025</span>
				<button
					type="button"
					className="relative grid size-8 place-items-center rounded-md border border-[var(--border)]"
				>
					<Bell size={15} />
					<span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] text-white">
						3
					</span>
				</button>
				<span className="max-w-[320px] truncate text-slate-500">{notice}</span>
			</div>
		</header>
	);
}
