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
	ArrowLeft,
	Bell,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CircleHelp,
	KeyRound,
	Laptop,
	LayoutGrid,
	LogOut,
	MessageCircle,
	MonitorCog,
	Moon,
	Menu,
	Palette,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	Sun,
	UserRound,
	X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
	navSections,
	overviewNavItem,
	quickLinks,
	type NavItem,
} from "@/components/dashboard/dashboard-data";
import { IntentPrefetchLink } from "@/components/dashboard/intent-prefetch-link";
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
export const GITHUB_REPOSITORY_URL = "https://github.com/tutur3u/cybershield35";
const dropdownItemFocusClass =
	"outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 data-[highlighted]:outline-none data-[highlighted]:ring-0";

export function Sidebar({
	collapsed,
	onToggle,
}: {
	collapsed: boolean;
	onToggle: () => void;
}) {
	const pathname = usePathname();
	const chatRoute = pathname.startsWith("/chat");
	const [mobileOpen, setMobileOpen] = useState(false);
	const [chatMenuOpen, setChatMenuOpen] = useState(chatRoute);
	const activeSection = navSections.find((section) =>
		section.items.some((item) => isNavActive(pathname, item.href)),
	)?.id;
	// The stored preference lives in localStorage, which is an external store, so
	// it is read through the hook built for one. Seeding useState from it instead
	// made the server ({}) and the first client render disagree; React patched the
	// mismatch by reusing DOM nodes, and individual nav links ended up wearing the
	// collapsed variant's classes while the sidebar was expanded.
	const expandedSections = useSyncExternalStore(
		subscribeSidebarSections,
		readSidebarSections,
		readServerSidebarSections,
	);
	const [manuallyCollapsedActivePath, setManuallyCollapsedActivePath] =
		useState<string | null>(null);

	useEffect(() => {
		const openChatNavigation = () => {
			setChatMenuOpen(true);
			setMobileOpen(true);
		};
		const closeNavigation = () => setMobileOpen(false);
		window.addEventListener(
			"cybershield35:open-chat-navigation",
			openChatNavigation,
		);
		window.addEventListener("cybershield35:close-navigation", closeNavigation);
		return () => {
			window.removeEventListener(
				"cybershield35:open-chat-navigation",
				openChatNavigation,
			);
			window.removeEventListener(
				"cybershield35:close-navigation",
				closeNavigation,
			);
		};
	}, []);

	useEffect(() => {
		if (!mobileOpen) return;
		const previousOverflow = document.body.style.overflow;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMobileOpen(false);
		};
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", closeOnEscape);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", closeOnEscape);
		};
	}, [mobileOpen]);

	return (
		<>
			{mobileOpen ? (
				<button
					type="button"
					aria-label="Đóng điều hướng"
					onClick={() => setMobileOpen(false)}
					className="fixed inset-0 z-40 cursor-default bg-slate-950/55 backdrop-blur-[1px] lg:hidden"
				/>
			) : null}
			<aside
				aria-label="Thanh điều hướng"
				className={`z-50 border-[var(--border)] bg-[var(--surface)] transition-[width,box-shadow] duration-200 lg:fixed lg:inset-y-0 lg:left-0 lg:overflow-y-auto lg:border-y-0 lg:border-l-0 lg:border-r ${
					mobileOpen
						? "fixed inset-y-0 left-0 w-[min(320px,calc(100vw-2rem))] border-r shadow-[20px_0_60px_rgb(0_0_0/0.28)]"
						: "relative border-x-0 border-t-0 border-b"
				} ${collapsed ? "lg:w-[76px]" : "lg:w-[248px]"}`}
			>
				<div
					className={`flex flex-col ${mobileOpen ? "h-full" : "min-h-[64px]"} lg:h-full`}
				>
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
							aria-expanded={mobileOpen}
							aria-label={mobileOpen ? "Đóng điều hướng" : "Mở điều hướng"}
							onClick={() => setMobileOpen((current) => !current)}
							className="ml-auto grid size-9 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] lg:hidden"
						>
							{mobileOpen ? <X size={17} /> : <Menu size={17} />}
						</button>
						<button
							type="button"
							aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
							title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
							onClick={onToggle}
							className={`ml-auto hidden size-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] lg:grid ${
								collapsed ? "lg:ml-0" : ""
							}`}
						>
							{collapsed ? (
								<PanelLeftOpen size={15} />
							) : (
								<PanelLeftClose size={15} />
							)}
						</button>
					</div>
					<nav
						aria-label={
							chatRoute && chatMenuOpen ? "Điều hướng Chat" : "Điều hướng chính"
						}
						className={`${mobileOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col overflow-y-auto lg:flex`}
					>
						{chatRoute && chatMenuOpen ? (
							<>
								<div
									className={`min-h-0 flex-1 flex-col ${collapsed ? "flex lg:hidden" : "flex"}`}
								>
									<IntentPrefetchLink
										href="/"
										onClick={() => setMobileOpen(false)}
										className="mx-3 mt-3 flex h-9 shrink-0 items-center gap-2 rounded-md px-2 text-[11px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
									>
										<ArrowLeft size={14} /> Tất cả chức năng
									</IntentPrefetchLink>
									<div id="chat-sidebar-portal" className="min-h-0 flex-1" />
								</div>
								<div
									className={`${collapsed ? "hidden lg:flex" : "hidden"} flex-1 flex-col items-center gap-2 px-3 py-3`}
								>
									<IntentPrefetchLink
										aria-label="Chat"
										className="grid size-10 place-items-center rounded-md bg-[var(--surface-soft)] text-[var(--brand-strong)]"
										href="/chat"
										title="Chat"
									>
										<MessageCircle size={16} />
									</IntentPrefetchLink>
									<IntentPrefetchLink
										href="/"
										aria-label="Tất cả chức năng"
										title="Tất cả chức năng"
										className="grid size-10 place-items-center rounded-md text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
									>
										<LayoutGrid size={16} />
									</IntentPrefetchLink>
								</div>
							</>
						) : (
							<div className="space-y-1 px-3 py-3">
								{chatRoute ? (
									<button
										type="button"
										onClick={() => setChatMenuOpen(true)}
										aria-label={collapsed ? "Trở lại Chat" : undefined}
										title={collapsed ? "Trở lại Chat" : undefined}
										className={`mb-2 flex h-9 w-full items-center gap-2 rounded-md bg-[var(--success-soft)] px-3 text-[11px] font-bold text-[var(--brand-strong)] ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
									>
										<MessageCircle size={16} />
										<span className={collapsed ? "lg:hidden" : ""}>
											Trở lại Chat
										</span>
									</button>
								) : null}
								<SidebarNavLink
									collapsed={collapsed}
									item={overviewNavItem}
									onNavigate={() => setMobileOpen(false)}
									pathname={pathname}
								/>
								{navSections.map((section, sectionIndex) => {
									const routeRevealsSection =
										section.id === activeSection &&
										manuallyCollapsedActivePath !== pathname;
									const expanded =
										collapsed ||
										routeRevealsSection ||
										expandedSections[section.id] !== false;
									return (
										<div
											key={section.id}
											className={
												sectionIndex === 0
													? "pt-1"
													: "border-t border-[var(--divider)] pt-1"
											}
										>
											<button
												type="button"
												aria-expanded={expanded}
												aria-controls={`sidebar-section-${section.id}`}
												onClick={() => {
													const nextExpanded = !expanded;
													writeSidebarSections({
														...expandedSections,
														[section.id]: nextExpanded,
													});
													setManuallyCollapsedActivePath(
														!nextExpanded && section.id === activeSection
															? pathname
															: null,
													);
												}}
												className={`group flex h-8 w-full min-w-0 items-center justify-between rounded-md px-3 text-left text-[11px] font-bold leading-none tracking-[0.01em] text-[color:var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[color:var(--muted-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${collapsed ? "lg:hidden" : ""}`}
											>
												<span className="min-w-0 truncate whitespace-nowrap">
													{section.label}
												</span>
												<ChevronRight
													aria-hidden
													size={11}
													strokeWidth={2}
													className={`shrink-0 opacity-70 transition-transform group-hover:opacity-100 ${expanded ? "rotate-90" : ""}`}
												/>
											</button>
											{expanded ? (
												<div
													id={`sidebar-section-${section.id}`}
													className="space-y-0.5"
												>
													{section.items.map((item) => (
														<SidebarNavLink
															collapsed={collapsed}
															item={item}
															key={item.href}
															onNavigate={() => setMobileOpen(false)}
															pathname={pathname}
														/>
													))}
												</div>
											) : null}
										</div>
									);
								})}
							</div>
						)}
					</nav>
					<div
						className={`mt-auto border-t border-[var(--divider)] p-3 ${chatRoute && chatMenuOpen ? "hidden" : collapsed ? "hidden lg:hidden" : "hidden lg:block"}`}
					>
						<div>
							<p className="px-3 text-[11px] font-bold tracking-[0.01em] text-[color:var(--muted)]">
								Trợ giúp
							</p>
							<div className="mt-1 space-y-0.5">
								{quickLinks.map((link) => (
									<IntentPrefetchLink
										key={link.href}
										href={link.href}
										className={`flex h-8 items-center gap-2 rounded-md px-2 text-[11px] font-medium transition ${
											pathname === link.href
												? "bg-[var(--success-soft)] text-[color:var(--brand-strong)]"
												: "text-[color:var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[color:var(--foreground)]"
										}`}
									>
										<CircleHelp aria-hidden size={13} />
										<span className="truncate">{link.label}</span>
									</IntentPrefetchLink>
								))}
							</div>
						</div>
					</div>
				</div>
			</aside>
		</>
	);
}

function SidebarNavLink({
	collapsed,
	item,
	onNavigate,
	pathname,
}: {
	collapsed: boolean;
	item: NavItem;
	onNavigate: () => void;
	pathname: string;
}) {
	const active = isNavActive(pathname, item.href);
	return (
		<IntentPrefetchLink
			aria-current={active ? "page" : undefined}
			aria-label={collapsed ? item.label : undefined}
			className={`relative flex h-10 w-full min-w-0 items-center gap-2.5 rounded-md px-3 text-left text-[12.5px] font-semibold outline-none transition before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-transparent before:transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/45 ${
				collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : "justify-start"
			} ${
				active
					? "bg-[var(--accent-soft)] text-[color:var(--accent-strong)] before:bg-[var(--accent)]"
					: "text-[color:var(--muted-strong)] hover:bg-[var(--surface-soft)] hover:text-[color:var(--foreground)]"
			}`}
			href={item.href}
			onClick={onNavigate}
			title={collapsed ? item.label : undefined}
		>
			<item.icon aria-hidden className="shrink-0" size={17} strokeWidth={2} />
			<span className={`min-w-0 flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>
				{item.label}
			</span>
		</IntentPrefetchLink>
	);
}

function isNavActive(pathname: string, href: string) {
	return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const SIDEBAR_SECTIONS_KEY = "cybershield35:sidebar-sections:v1";
const SIDEBAR_SECTIONS_EVENT = "cybershield35:sidebar-sections-changed";
const EMPTY_SIDEBAR_SECTIONS: Record<string, boolean> = {};

// useSyncExternalStore calls the snapshot on every render and bails out only on
// referential equality, so the parsed object is cached against the raw string it
// came from. Returning a fresh object each time would loop forever.
let sidebarSectionsRaw: string | null = null;
let sidebarSectionsValue: Record<string, boolean> = EMPTY_SIDEBAR_SECTIONS;

function subscribeSidebarSections(onStoreChange: () => void) {
	// `storage` covers other tabs; the custom event covers this one, since a tab
	// never hears its own storage writes.
	window.addEventListener("storage", onStoreChange);
	window.addEventListener(SIDEBAR_SECTIONS_EVENT, onStoreChange);
	return () => {
		window.removeEventListener("storage", onStoreChange);
		window.removeEventListener(SIDEBAR_SECTIONS_EVENT, onStoreChange);
	};
}

function readSidebarSections(): Record<string, boolean> {
	const raw = window.localStorage.getItem(SIDEBAR_SECTIONS_KEY);
	if (raw === sidebarSectionsRaw) return sidebarSectionsValue;
	sidebarSectionsRaw = raw;
	try {
		sidebarSectionsValue = raw
			? (JSON.parse(raw) as Record<string, boolean>)
			: EMPTY_SIDEBAR_SECTIONS;
	} catch {
		sidebarSectionsValue = EMPTY_SIDEBAR_SECTIONS;
	}
	return sidebarSectionsValue;
}

/** The server has no preference, so every section renders at its default. */
function readServerSidebarSections(): Record<string, boolean> {
	return EMPTY_SIDEBAR_SECTIONS;
}

function writeSidebarSections(next: Record<string, boolean>) {
	window.localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(next));
	window.dispatchEvent(new Event(SIDEBAR_SECTIONS_EVENT));
}

function BrandmarkLink({ collapsed }: { collapsed: boolean }) {
	return (
		<IntentPrefetchLink
			href="/"
			aria-label="CyberShield35"
			className={`inline-flex h-10 min-w-0 items-center text-[18px] font-bold leading-[1.35] transition-colors duration-200 ${
				collapsed ? "inline-flex lg:hidden" : "inline-flex"
			} text-[var(--foreground)] hover:text-[var(--brand)] focus-visible:text-[var(--brand)]`}
		>
			<span>CyberShield35</span>
		</IntentPrefetchLink>
	);
}

export function TopBar({
	auth,
	onChangePassword,
	onLogout,
	onOpenProfile,
	onOpenSettings,
	onPreloadProfile,
	onPreloadSettings,
	onSelectTheme,
	resolvedTheme,
	themePreference,
}: {
	auth: AuthViewState;
	onChangePassword: () => void;
	onLogout: () => Promise<void>;
	onOpenProfile: () => void;
	onOpenSettings: () => void;
	onPreloadProfile: () => void;
	onPreloadSettings: () => void;
	onSelectTheme: (preference: ThemePreference) => void;
	resolvedTheme: ResolvedTheme;
	themePreference: ThemePreference;
}) {
	const [accountOpen, setAccountOpen] = useState(false);
	const pathname = usePathname();
	const chatRoute = pathname.startsWith("/chat");
	const unreadCount = notifications.length;
	const identity = getSessionIdentity(auth);

	return (
		<header className="sticky top-0 z-20 flex min-h-16 items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:px-4">
			{chatRoute ? (
				<div id="chat-topbar-portal" className="min-w-0 flex-1" />
			) : null}
			<div className="flex shrink-0 items-center gap-2 text-[12px] font-semibold text-[var(--muted-strong)] sm:gap-3">
				{chatRoute ? null : <BrowserClock />}
				<a
					aria-label="Mở mã nguồn trên GitHub"
					className="grid size-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					href={GITHUB_REPOSITORY_URL}
					rel="noreferrer noopener"
					target="_blank"
					title="Mã nguồn trên GitHub"
				>
					<GithubMark />
				</a>
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
									<IntentPrefetchLink
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
									</IntentPrefetchLink>
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
						onChangePassword={onChangePassword}
						onClose={() => setAccountOpen(false)}
						onLogout={onLogout}
						onOpenProfile={onOpenProfile}
						onOpenSettings={onOpenSettings}
						onPreloadProfile={onPreloadProfile}
						onPreloadSettings={onPreloadSettings}
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
	onChangePassword,
	onClose,
	onLogout,
	onOpenProfile,
	onOpenSettings,
	onPreloadProfile,
	onPreloadSettings,
	onSelectTheme,
	resolvedTheme,
	themePreference,
}: {
	auth: AuthViewState;
	onChangePassword: () => void;
	onClose: () => void;
	onLogout: () => Promise<void>;
	onOpenProfile: () => void;
	onOpenSettings: () => void;
	onPreloadProfile: () => void;
	onPreloadSettings: () => void;
	onSelectTheme: (preference: ThemePreference) => void;
	resolvedTheme: ResolvedTheme;
	themePreference: ThemePreference;
}) {
	const identity = getSessionIdentity(auth);
	// Password accounts have no platform profile to edit, so they get password
	// management in that slot instead of a menu item that can only fail.
	const passwordAccount = auth.session?.kind === "local";

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
			{passwordAccount ? (
				<DropdownMenuItem
					onSelect={() => {
						onChangePassword();
						onClose();
					}}
					className={`mx-1 rounded-md px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] focus:bg-[var(--surface-soft)] focus:text-[var(--foreground)] ${dropdownItemFocusClass}`}
				>
					<KeyRound size={15} />
					Đổi mật khẩu
				</DropdownMenuItem>
			) : (
				<DropdownMenuItem
					onFocus={onPreloadProfile}
					onPointerEnter={onPreloadProfile}
					onSelect={() => {
						onOpenProfile();
						onClose();
					}}
					className={`mx-1 rounded-md px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] focus:bg-[var(--surface-soft)] focus:text-[var(--foreground)] ${dropdownItemFocusClass}`}
				>
					<UserRound size={15} />
					Hồ sơ tài khoản
				</DropdownMenuItem>
			)}
			<DropdownMenuItem
				asChild
				className={`mx-1 rounded-md px-3 py-2 text-[12px] font-bold text-[var(--muted-strong)] focus:bg-[var(--surface-soft)] focus:text-[var(--foreground)] ${dropdownItemFocusClass}`}
			>
				<IntentPrefetchLink href="/operations" onClick={onClose}>
					<MonitorCog size={15} />
					Vận hành hệ thống
				</IntentPrefetchLink>
			</DropdownMenuItem>
			<DropdownMenuItem
				onFocus={onPreloadSettings}
				onPointerEnter={onPreloadSettings}
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

/** Inline because lucide-react dropped brand marks; this keeps it themeable. */
function GithubMark() {
	return (
		<svg
			aria-hidden="true"
			fill="currentColor"
			focusable="false"
			height={16}
			role="img"
			viewBox="0 0 16 16"
			width={16}
		>
			<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
		</svg>
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
