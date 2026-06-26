"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@tuturuuu/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@tuturuuu/ui/avatar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@tuturuuu/ui/tooltip";
import "slot-text/style.css";
import { SlotText } from "slot-text/react";
import {
	Bell,
	Check,
	CheckCircle2,
	ChevronDown,
	CircleHelp,
	Laptop,
	LogOut,
	Moon,
	Palette,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	Sun,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { navItems, quickLinks } from "@/components/dashboard/dashboard-data";
import {
	themeLabel,
	type ResolvedTheme,
	type ThemePreference,
} from "@/components/dashboard/theme";
import type { AuthViewState } from "@/components/dashboard/types";

type OperationalNotification = {
	description: string;
	href: string;
	id: string;
	time: string;
	title: string;
	tone: string;
};

const notifications: OperationalNotification[] = [];
const dropdownItemFocusClass =
	"outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 data-[highlighted]:outline-none data-[highlighted]:ring-0";
const BRANDMARK_IDLE_COLLAPSE_MS = 3600;
const BRANDMARK_RECOLLAPSE_DELAY_MS = 1100;

export function Sidebar({
	collapsed,
	onToggle,
}: {
	collapsed: boolean;
	onToggle: () => void;
}) {
	const pathname = usePathname();

	return (
		<aside
			className={`z-30 border-b border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:left-0 lg:overflow-y-auto lg:border-b-0 lg:border-r ${
				collapsed ? "lg:w-[76px]" : "lg:w-[248px]"
			}`}
		>
			<div className="flex min-h-[72px] flex-col lg:h-full">
				<div
					className={`flex h-16 items-center gap-3 border-b border-[var(--border)] px-4 ${
						collapsed ? "lg:justify-center lg:px-2" : ""
					}`}
				>
					<BrandmarkLink
						key={collapsed ? "brand-collapsed" : "brand-expanded"}
						collapsed={collapsed}
					/>
					<button
						type="button"
						aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
						title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
						onClick={onToggle}
						className={`ml-auto hidden size-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] lg:grid ${
							collapsed ? "lg:ml-0" : ""
						}`}
					>
						{collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
					</button>
				</div>
				<nav className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible lg:py-4">
					<TooltipProvider delayDuration={120}>
						{navItems.map((item) => {
							const active =
								item.href === "/"
									? pathname === "/"
									: pathname.startsWith(item.href);

							return (
								<Tooltip key={item.label}>
									<TooltipTrigger asChild>
										<Link
											href={item.href}
											title={collapsed ? item.label : undefined}
											className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left text-[12px] font-semibold transition lg:h-11 lg:w-full lg:text-[13px] ${
												collapsed ? "lg:justify-center lg:px-0" : "lg:gap-3"
											} ${
												active
													? "bg-[var(--brand)] text-white shadow-sm"
													: "text-[var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
											}`}
										>
											<item.icon size={17} strokeWidth={2.1} />
											<span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>
												{item.label}
											</span>
										</Link>
									</TooltipTrigger>
									{collapsed ? (
										<TooltipContent
											side="right"
											sideOffset={10}
											className="hidden rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--foreground)] shadow-[0_12px_30px_rgb(0_0_0/0.22)] lg:block"
										>
											{item.label}
										</TooltipContent>
									) : null}
								</Tooltip>
							);
						})}
					</TooltipProvider>
				</nav>
				<div
					className={`mt-auto hidden p-3 lg:block ${collapsed ? "lg:hidden" : ""}`}
				>
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

function BrandmarkLink({
	collapsed,
}: {
	collapsed: boolean;
}) {
	const [compact, setCompact] = useState(false);
	const idleTimerRef = useRef<number | null>(null);
	const recollapseTimerRef = useRef<number | null>(null);
	const hoveringRef = useRef(false);

	useEffect(() => {
		clearBrandmarkTimer(idleTimerRef);
		clearBrandmarkTimer(recollapseTimerRef);

		if (!collapsed) {
			idleTimerRef.current = window.setTimeout(() => {
				if (!hoveringRef.current) setCompact(true);
			}, BRANDMARK_IDLE_COLLAPSE_MS);
		}

		return () => {
			clearBrandmarkTimer(idleTimerRef);
			clearBrandmarkTimer(recollapseTimerRef);
		};
	}, [collapsed]);

	function expandBrandmark() {
		hoveringRef.current = true;
		clearBrandmarkTimer(idleTimerRef);
		clearBrandmarkTimer(recollapseTimerRef);
		setCompact(false);
	}

	function scheduleBrandmarkCollapse() {
		hoveringRef.current = false;
		clearBrandmarkTimer(recollapseTimerRef);
		recollapseTimerRef.current = window.setTimeout(() => {
			if (!hoveringRef.current) setCompact(true);
		}, BRANDMARK_RECOLLAPSE_DELAY_MS);
	}

	const brandmarkText = collapsed || compact ? "CS35" : "CyberShield35";
	const brandmarkDirection = collapsed || compact ? "down" : "up";

	return (
		<Link
			href="/"
			aria-label="CyberShield35"
			onFocus={expandBrandmark}
			onBlur={scheduleBrandmarkCollapse}
			onPointerEnter={expandBrandmark}
			onPointerLeave={scheduleBrandmarkCollapse}
			className={`inline-flex h-10 min-w-0 items-center text-[18px] font-bold leading-[1.35] transition-colors duration-200 ${
				collapsed ? "hidden lg:hidden" : "inline-flex"
			} text-[var(--foreground)] hover:text-[var(--brand)] focus-visible:text-[var(--brand)]`}
		>
			<SlotText
				aria-hidden="true"
				className="min-h-[1.35em] leading-[1.35] [&_.char-slot]:leading-[1.45]"
				text={brandmarkText}
				options={{
					bounce: 0.32,
					direction: brandmarkDirection,
					duration: 260,
					exitOffset: 36,
					interrupt: true,
					skipUnchanged: false,
					stagger: 28,
				}}
			/>
		</Link>
	);
}

function clearBrandmarkTimer(timerRef: { current: number | null }) {
	if (timerRef.current === null) return;
	window.clearTimeout(timerRef.current);
	timerRef.current = null;
}

export function TopBar({
	auth,
	onLogout,
	onOpenProfile,
	onOpenSettings,
	onSelectTheme,
	resolvedTheme,
	themePreference,
}: {
	auth: AuthViewState;
	onLogout: () => Promise<void>;
	onOpenProfile: () => void;
	onOpenSettings: () => void;
	onSelectTheme: (preference: ThemePreference) => void;
	resolvedTheme: ResolvedTheme;
	themePreference: ThemePreference;
}) {
	const [accountOpen, setAccountOpen] = useState(false);
	const unreadCount = notifications.length;
	const identity = getSessionIdentity(auth);

	return (
		<header className="sticky top-0 z-20 flex min-h-16 items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
			<div className="flex shrink-0 items-center gap-2 text-[12px] font-semibold text-[var(--muted-strong)] sm:gap-3">
				<BrowserClock />
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="Mở thông báo"
							className="relative grid size-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
						>
							<Bell size={15} />
							{unreadCount ? (
								<span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] text-white">
									{unreadCount}
								</span>
							) : null}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-[min(360px,calc(100vw-2rem))] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_24px_70px_rgb(0_0_0/0.22)]"
					>
						<div className="border-b border-[var(--border)] px-4 py-3">
							<p className="text-[13px] font-bold text-[var(--foreground)]">
								Thông báo vận hành
							</p>
							{notifications.length ? (
								<p className="mt-0.5 text-[11px] text-[var(--muted)]">
									{notifications.length} mục cần kiểm tra
								</p>
							) : null}
						</div>
						{notifications.length ? (
							<div className="max-h-[340px] overflow-y-auto p-2">
								{notifications.map((notification) => (
									<Link
										key={notification.id}
										href={notification.href}
										className="flex gap-3 rounded-md p-3 transition hover:bg-[var(--surface-soft)]"
									>
										<span
											className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${notification.tone}`}
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
								))}
							</div>
						) : (
							<div className="p-4">
								<div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
									<span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
										<CheckCircle2 size={15} />
									</span>
									<div className="min-w-0">
										<p className="text-[12px] font-bold text-[var(--foreground)]">
											Không có thông báo mới
										</p>
										<p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
											Các cảnh báo vận hành sẽ xuất hiện tại đây.
										</p>
									</div>
								</div>
							</div>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
				<DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="Mở tài khoản"
							className="flex h-9 max-w-[240px] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--muted-strong)] outline-none ring-0 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
						>
							<AccountAvatar
								avatarUrl={identity.avatarUrl}
								name={identity.primary}
								size="sm"
							/>
							<span className="hidden min-w-0 truncate text-[12px] font-bold sm:block">
								{identity.primary}
							</span>
							<ChevronDown
								size={14}
								className={`shrink-0 transition-transform ${accountOpen ? "rotate-180" : ""}`}
							/>
						</button>
					</DropdownMenuTrigger>
					<AccountMenu
						auth={auth}
						onClose={() => setAccountOpen(false)}
						onLogout={onLogout}
						onOpenProfile={onOpenProfile}
						onOpenSettings={onOpenSettings}
						onSelectTheme={onSelectTheme}
						resolvedTheme={resolvedTheme}
						themePreference={themePreference}
					/>
				</DropdownMenu>
			</div>
		</header>
	);
}

function AccountMenu({
	auth,
	onClose,
	onLogout,
	onOpenProfile,
	onOpenSettings,
	onSelectTheme,
	resolvedTheme,
	themePreference,
}: {
	auth: AuthViewState;
	onClose: () => void;
	onLogout: () => Promise<void>;
	onOpenProfile: () => void;
	onOpenSettings: () => void;
	onSelectTheme: (preference: ThemePreference) => void;
	resolvedTheme: ResolvedTheme;
	themePreference: ThemePreference;
}) {
	const identity = getSessionIdentity(auth);

	return (
		<DropdownMenuContent
			align="end"
			className="w-[min(340px,calc(100vw-2rem))] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--foreground)] shadow-[0_24px_70px_rgb(0_0_0/0.22)]"
		>
			<DropdownMenuLabel className="flex items-start gap-3 rounded-md px-3 py-3">
				<AccountAvatar
					avatarUrl={identity.avatarUrl}
					name={identity.primary}
					size="md"
				/>
				<span className="min-w-0">
					<span className="block truncate text-[13px] font-bold text-[var(--foreground)]">
						{identity.primary}
					</span>
					{identity.secondary ? (
						<span className="mt-1 block truncate text-[11px] font-semibold text-[var(--muted)]">
							{identity.secondary}
						</span>
					) : null}
				</span>
			</DropdownMenuLabel>
			<DropdownMenuSeparator className="bg-[var(--border)]" />
			<DropdownMenuItem
				onSelect={() => {
					onOpenProfile();
					onClose();
				}}
				className={`mx-1 rounded-md px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] focus:bg-[var(--surface-soft)] focus:text-[var(--foreground)] ${dropdownItemFocusClass}`}
			>
				<UserRound size={15} />
				Hồ sơ tài khoản
			</DropdownMenuItem>
			<DropdownMenuItem
				onSelect={() => {
					onOpenSettings();
					onClose();
				}}
				className={`mx-1 rounded-md px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] focus:bg-[var(--surface-soft)] focus:text-[var(--foreground)] ${dropdownItemFocusClass}`}
			>
				<Settings size={15} />
				Cấu hình máy chủ
			</DropdownMenuItem>
			<DropdownMenuSub>
				<DropdownMenuSubTrigger
					className={`mx-1 rounded-md px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] focus:bg-[var(--surface-soft)] focus:text-[var(--foreground)] data-[state=open]:bg-[var(--surface-soft)] data-[state=open]:text-[var(--foreground)] ${dropdownItemFocusClass}`}
				>
					<Palette size={15} />
					<span>Giao diện</span>
					<span className="ml-auto mr-2 text-[11px] font-semibold text-[var(--muted)]">
						{themeLabel(themePreference)}
					</span>
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent className="min-w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--foreground)] shadow-[0_18px_50px_rgb(0_0_0/0.2)]">
					<DropdownMenuRadioGroup
						value={themePreference}
						onValueChange={(value) => onSelectTheme(value as ThemePreference)}
					>
						{themeOptions.map((option) => {
							const Icon = themeOptionIcon(option);
							const active = themePreference === option;

							return (
								<DropdownMenuRadioItem
									key={option}
									value={option}
									className={`rounded-md py-2 pr-2 pl-8 text-[12px] font-bold text-[var(--muted-strong)] focus:bg-[var(--surface-soft)] focus:text-[var(--foreground)] ${dropdownItemFocusClass}`}
								>
									<Icon size={15} />
									<span className="min-w-0 flex-1 truncate">
										{themeLabel(option)}
									</span>
									{option === "system" ? (
										<span className="ml-2 truncate text-[10px] font-semibold text-[var(--muted)]">
											{themeLabel(resolvedTheme)}
										</span>
									) : null}
									{active ? <Check size={14} className="ml-auto" /> : null}
								</DropdownMenuRadioItem>
							);
						})}
					</DropdownMenuRadioGroup>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
			<DropdownMenuSeparator className="bg-[var(--border)]" />
			<DropdownMenuItem
				variant="destructive"
				onSelect={() => {
					void onLogout().finally(onClose);
				}}
				className={`mx-1 rounded-md px-3 py-2 text-[12px] font-bold text-[var(--danger-strong)] focus:bg-[var(--danger-soft)] focus:text-[var(--danger-strong)] ${dropdownItemFocusClass}`}
			>
				<LogOut size={15} />
				Đăng xuất
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}

function AccountAvatar({
	avatarUrl,
	name,
	size,
}: {
	avatarUrl: string | null;
	name: string;
	size: "md" | "sm";
}) {
	const sizeClass = size === "md" ? "size-9 text-[12px]" : "size-5 text-[10px]";

	return (
		<Avatar
			className={`${sizeClass} border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]`}
		>
			{avatarUrl ? (
				<AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
			) : null}
			<AvatarFallback className="bg-[var(--success-soft)] text-[var(--brand)] text-[inherit] font-bold">
				{getInitials(name)}
			</AvatarFallback>
		</Avatar>
	);
}

const themeOptions: ThemePreference[] = ["system", "light", "dark"];

function getSessionIdentity(auth: AuthViewState) {
	const avatarUrl = cleanIdentityValue(auth.session?.user.avatarUrl);
	const displayName = cleanIdentityValue(auth.session?.user.displayName);
	const email = cleanIdentityValue(auth.session?.user.email);
	const primary = displayName ?? email ?? "Tài khoản";
	const secondary =
		displayName && email && displayName !== email ? email : null;

	return { avatarUrl, primary, secondary };
}

function cleanIdentityValue(value: string | null | undefined) {
	const cleaned = value?.trim();
	return cleaned || null;
}

function getInitials(value: string) {
	const parts = value
		.split(/[\s@._-]+/u)
		.map((part) => part.trim())
		.filter(Boolean);
	const initials = parts
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");

	return initials || "TT";
}

function themeOptionIcon(option: ThemePreference) {
	if (option === "system") return Laptop;
	return option === "dark" ? Moon : Sun;
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
		<span
			className="hidden whitespace-nowrap text-[var(--muted-strong)] sm:inline"
			suppressHydrationWarning
		>
			{timeLabel}, {dateLabel}
		</span>
	);
}
