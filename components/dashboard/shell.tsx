"use client";

import { Bell, CheckCircle2, CircleHelp, ExternalLink, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

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
								<Link
									key={link.href}
									href={link.href}
									className={`flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] transition ${
										pathname === link.href
											? "text-[var(--brand)]"
											: "text-[var(--muted-strong)] hover:text-[var(--foreground)]"
									}`}
								>
									<CircleHelp size={13} />
									<span className="truncate">{link.label}</span>
								</Link>
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
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [readIds, setReadIds] = useState<string[]>([]);
	const unreadCount = notifications.filter(
		(notification) => !readIds.includes(notification.id),
	).length;

	function markRead(id: string) {
		setReadIds((current) => (current.includes(id) ? current : [...current, id]));
	}

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
				<div className="relative">
					<button
						type="button"
						aria-expanded={notificationsOpen}
						aria-haspopup="menu"
						aria-label="Mở thông báo"
						onClick={() => setNotificationsOpen((open) => !open)}
						className="relative grid size-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					>
						<Bell size={15} />
						{unreadCount ? (
							<span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] text-white">
								{unreadCount}
							</span>
						) : null}
					</button>
					{notificationsOpen ? (
						<div
							role="menu"
							className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgb(0_0_0/0.22)]"
						>
							<div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
								<div className="min-w-0">
									<p className="text-[13px] font-bold text-[var(--foreground)]">
										Thông báo vận hành
									</p>
									<p className="mt-0.5 text-[11px] text-[var(--muted)]">
										{unreadCount} mục cần kiểm tra
									</p>
								</div>
								<button
									type="button"
									aria-label="Đóng thông báo"
									onClick={() => setNotificationsOpen(false)}
									className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
								>
									<X size={14} />
								</button>
							</div>
							<div className="max-h-[340px] overflow-y-auto p-2">
								{notifications.map((notification) => {
									const read = readIds.includes(notification.id);

									return (
										<Link
											key={notification.id}
											href={notification.href}
											role="menuitem"
											onClick={() => markRead(notification.id)}
											className="flex gap-3 rounded-md p-3 transition hover:bg-[var(--surface-soft)]"
										>
											<span
												className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${
													read
														? "bg-[var(--neutral-soft)] text-[var(--muted)]"
														: notification.tone
												}`}
											>
												<CheckCircle2 size={14} />
											</span>
											<span className="min-w-0">
												<span className="flex items-center justify-between gap-3">
													<span className="truncate text-[12px] font-bold text-[var(--foreground)]">
														{notification.title}
													</span>
													<span className="shrink-0 text-[10px] font-semibold text-[var(--muted)]">
														{notification.time}
													</span>
												</span>
												<span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">
													{notification.description}
												</span>
											</span>
										</Link>
									);
								})}
							</div>
							<div className="border-t border-[var(--border)] p-2">
								<Link
									href="/audit"
									onClick={() => setNotificationsOpen(false)}
									className="flex h-9 items-center justify-center gap-2 rounded-md text-[12px] font-bold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
								>
									Xem nhật ký hoạt động <ExternalLink size={13} />
								</Link>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</header>
	);
}

const notifications = [
	{
		id: "scan-running",
		title: "Scan Facebook đang chạy",
		description: "Bài viết chính sách đang được Apify thu thập bình luận công khai.",
		href: "/sources",
		time: "2 phút",
		tone: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
	},
	{
		id: "draft-review",
		title: "Bản nháp cần duyệt",
		description: "Một lập luận phản hồi đã sẵn sàng để kiểm tra bằng chứng.",
		href: "/counter-arguments",
		time: "8 phút",
		tone: "bg-[var(--warning-soft)] text-[var(--warning-strong)]",
	},
	{
		id: "risk-alert",
		title: "Cảnh báo rủi ro cao",
		description: "Cụm chủ đề sai lệch có mức ưu tiên cao trong hàng đợi phân tích.",
		href: "/alerts",
		time: "14 phút",
		tone: "bg-[var(--danger-soft)] text-[var(--danger-strong)]",
	},
] as const;

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
