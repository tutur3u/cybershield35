"use client";

import { Bell, CircleHelp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { navItems, quickLinks, topBarItems } from "@/components/dashboard/dashboard-data";
import {
	ThemeToggleButton,
	type ResolvedTheme,
	type ThemePreference,
} from "@/components/dashboard/theme";

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="z-30 border-b border-[var(--border)] bg-[var(--surface)] lg:fixed lg:inset-y-0 lg:left-0 lg:w-[248px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
			<div className="flex min-h-[72px] flex-col lg:h-full">
				<div className="flex h-16 items-center gap-3 border-b border-[var(--border)] px-4">
					<div className="grid size-9 place-items-center rounded-md border border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--brand)]">
						<ShieldCheck size={22} strokeWidth={2.4} />
					</div>
					<div className="min-w-0">
						<p className="truncate text-[18px] font-bold text-[var(--foreground)]">
							CyberShield 35
						</p>
						<p className="truncate text-[11px] font-semibold text-[var(--muted)]">
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
										: "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
								}`}
							>
								<item.icon size={17} strokeWidth={2.1} />
								<span className="truncate">{item.label}</span>
							</Link>
						);
					})}
				</nav>
				<div className="mt-auto hidden p-3 lg:block">
					<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
						<p className="text-[13px] font-bold text-[var(--foreground)]">
							Hướng dẫn nhanh
						</p>
						<div className="mt-3 space-y-2">
							{quickLinks.map((link) => (
								<div
									key={link}
									className="flex items-center gap-2 text-[11px] text-[var(--muted-strong)]"
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

export function TopBar({
	onCycleTheme,
	resolvedTheme,
	themePreference,
}: {
	onCycleTheme: () => void;
	resolvedTheme: ResolvedTheme;
	themePreference: ThemePreference;
}) {
	return (
		<header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
			<div className="flex min-w-0 items-center gap-3">
				{topBarItems.map((item, index) => (
					<div
						key={item.label}
						className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-[var(--muted-strong)]"
					>
						<item.icon
							className={`shrink-0 ${index === 0 ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}
							size={15}
						/>
						<span className="truncate">{item.label}</span>
					</div>
				))}
			</div>
			<div className="flex shrink-0 items-center gap-2 text-[12px] font-semibold text-[var(--muted-strong)] sm:gap-3">
				<BrowserClock />
				<ThemeToggleButton
					onCycle={onCycleTheme}
					preference={themePreference}
					resolvedTheme={resolvedTheme}
				/>
				<button
					type="button"
					className="relative grid size-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)]"
				>
					<Bell size={15} />
					<span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] text-white">
						3
					</span>
				</button>
			</div>
		</header>
	);
}

let clockSnapshot = 0;

function subscribeClock(onStoreChange: () => void) {
	const tick = () => {
		clockSnapshot = Date.now();
		onStoreChange();
	};
	tick();
	const interval = window.setInterval(tick, 30_000);

	return () => window.clearInterval(interval);
}

function getClockSnapshot() {
	return clockSnapshot;
}

function getServerClockSnapshot() {
	return 0;
}

function BrowserClock() {
	const timestamp = useSyncExternalStore(
		subscribeClock,
		getClockSnapshot,
		getServerClockSnapshot,
	);

	if (!timestamp) {
		return (
			<span
				className="hidden whitespace-nowrap text-[var(--muted)] sm:inline"
				suppressHydrationWarning
			>
				--:--, --/--/----
			</span>
		);
	}

	const date = new Date(timestamp);
	const timeLabel = new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	}).format(date);
	const dateLabel = new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);

	return (
		<span className="hidden whitespace-nowrap text-[var(--muted-strong)] sm:inline" suppressHydrationWarning>
			{timeLabel}, {dateLabel}
		</span>
	);
}
