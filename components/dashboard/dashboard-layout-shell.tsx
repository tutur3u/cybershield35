"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { logout } from "@/components/dashboard/auth-client-actions";
import { DashboardAuthProvider } from "@/components/dashboard/dashboard-auth-context";
import { LoginRedirect } from "@/components/auth/login-redirect";
import { ScanProgressDock } from "@/components/dashboard/scan-progress-dock";
import { Sidebar, TopBar } from "@/components/dashboard/shell";
import { useThemePreference } from "@/components/dashboard/theme";
import type {
	AuthViewState,
	ProviderAvailabilityView,
} from "@/components/dashboard/types";

const loadProfileSettingsPanelDialog = () =>
	import("@/components/dashboard/shell-profile-dialog");
const loadOperationalSettingsDialog = () =>
	import("@/components/dashboard/shell-settings-dialog");

const ProfileSettingsPanelDialog = dynamic(
	() =>
		loadProfileSettingsPanelDialog().then(
			(module) => module.ProfileSettingsPanelDialog,
		),
	{
		loading: () => <DeferredDialogLoading label="Đang tải hồ sơ tài khoản" />,
		ssr: false,
	},
);

const LocalPasswordDialog = dynamic(
	() =>
		import("@/components/dashboard/local-password-dialog").then(
			(module) => module.LocalPasswordDialog,
		),
	{
		loading: () => <DeferredDialogLoading label="Đang tải đổi mật khẩu" />,
		ssr: false,
	},
);

const ProviderStatusDialog = dynamic(
	() =>
		loadOperationalSettingsDialog().then(
			(module) => module.OperationalSettingsDialog,
		),
	{
		loading: () => <DeferredDialogLoading label="Đang tải cài đặt vận hành" />,
		ssr: false,
	},
);

export function DashboardLayoutShell({
	children,
	initialAuth,
	initialProviderAvailability = null,
}: {
	children: ReactNode;
	initialAuth: AuthViewState;
	initialProviderAvailability?: ProviderAvailabilityView | null;
}) {
	const pathname = usePathname();
	const chatShell = pathname.startsWith("/chat");
	const [auth, setAuth] = useState<AuthViewState>(initialAuth);
	// Read through useSyncExternalStore, not seeded into useState. localStorage is
	// only readable on the client, so seeding it made the server render expanded
	// and the first client render collapsed. React resolved that mismatch by
	// reusing DOM nodes, and individual nav links kept the collapsed variant's
	// classes — gap-0 and px-0 — while the sidebar was drawn expanded.
	const sidebarCollapsed = useSyncExternalStore(
		subscribeSidebarCollapsed,
		readSidebarCollapsed,
		readServerSidebarCollapsed,
	);
	const [profileDialogOpen, setProfileDialogOpen] = useState(false);
	const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
	const passwordChangeRequired = Boolean(
		auth.session?.kind === "local" && auth.session.mustChangePassword,
	);
	const [schedulerAutoRetryToken] = useState(readSchedulerAutoRetryToken);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(() =>
		Boolean(schedulerAutoRetryToken),
	);
	const [, setNotice] = useState("");
	const { preference, resolvedTheme, setPreference } = useThemePreference();

	useEffect(() => {
		if (!schedulerAutoRetryToken || typeof window === "undefined") return;

		const url = new URL(window.location.href);
		if (url.searchParams.get("cronSetup") !== "retry") return;

		url.searchParams.delete("cronSetup");
		window.history.replaceState(
			null,
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
	}, [schedulerAutoRetryToken]);

	return (
		<DashboardAuthProvider initialAuth={auth}>
			{auth.authenticated ? (
				<main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
					<div
						className={`min-h-screen transition-[padding] duration-200 ${
							sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[248px]"
						}`}
					>
						<Sidebar
							key={chatShell ? "chat-sidebar" : "dashboard-sidebar"}
							collapsed={sidebarCollapsed}
							onToggle={() => writeSidebarCollapsed(!sidebarCollapsed)}
						/>
						<section
							className={
								chatShell
									? "h-[calc(100dvh-4rem)] min-w-0 overflow-hidden lg:h-screen"
									: "min-w-0 lg:h-screen lg:overflow-y-auto"
							}
						>
							<TopBar
								auth={auth}
								onChangePassword={() => setPasswordDialogOpen(true)}
								onLogout={() =>
									logout(
										setAuth,
										setNotice,
										auth.loginHref ?? currentLoginHref(),
									)
								}
								onOpenProfile={() => setProfileDialogOpen(true)}
								onOpenSettings={() => setSettingsDialogOpen(true)}
								onPreloadProfile={() => {
									void loadProfileSettingsPanelDialog();
								}}
								onPreloadSettings={() => {
									void loadOperationalSettingsDialog();
								}}
								onSelectTheme={setPreference}
								resolvedTheme={resolvedTheme}
								themePreference={preference}
							/>
							<div
								className={
									chatShell
										? "min-h-0 flex-1 overflow-hidden"
										: "flex-1 px-3 py-4 sm:px-5 lg:px-6 lg:py-6"
								}
							>
								{children}
							</div>
						</section>
					</div>
					{/* Outside the scrolling section so a run in flight stays visible
						wherever the operator navigates. */}
					<ScanProgressDock />
					{profileDialogOpen ? (
						<ProfileSettingsPanelDialog
							auth={auth}
							onClose={() => setProfileDialogOpen(false)}
							onProfileUpdated={(session) => {
								setAuth((current) => ({
									...current,
									authenticated: true,
									configured: true,
									session,
								}));
							}}
						/>
					) : null}
					{passwordDialogOpen || passwordChangeRequired ? (
						<LocalPasswordDialog
							onChanged={() => {
								setPasswordDialogOpen(false);
								setAuth((current) =>
									current.session
										? {
												...current,
												session: {
													...current.session,
													mustChangePassword: false,
												},
											}
										: current,
								);
								setNotice("Đã đổi mật khẩu.");
							}}
							onClose={() => setPasswordDialogOpen(false)}
							required={passwordChangeRequired}
						/>
					) : null}
					{settingsDialogOpen ? (
						<ProviderStatusDialog
							autoRetryToken={schedulerAutoRetryToken}
							initialProviderAvailability={initialProviderAvailability}
							onClose={() => setSettingsDialogOpen(false)}
						/>
					) : null}
				</main>
			) : (
				<LoginRedirect href={auth.loginHref ?? currentLoginHref("expired")} />
			)}
		</DashboardAuthProvider>
	);
}

function DeferredDialogLoading({ label }: { label: string }) {
	return (
		<div
			aria-live="polite"
			className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm"
			role="status"
		>
			<div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-[13px] font-semibold text-[var(--muted-strong)] shadow-2xl">
				{label}...
			</div>
		</div>
	);
}

function currentLoginHref(reason?: "expired") {
	if (typeof window === "undefined") return "/login";

	const nextUrl = `${window.location.pathname}${window.location.search}`;
	const params = new URLSearchParams({ nextUrl });
	if (reason) params.set("reason", reason);
	return `/login?${params.toString()}`;
}

function readSchedulerAutoRetryToken() {
	if (typeof window === "undefined") return undefined;

	const url = new URL(window.location.href);
	return url.searchParams.get("cronSetup") === "retry" ? Date.now() : undefined;
}

const SIDEBAR_COLLAPSED_KEY = "cybershield35:sidebar-collapsed:v1";
const SIDEBAR_COLLAPSED_EVENT = "cybershield35:sidebar-collapsed-changed";

function subscribeSidebarCollapsed(onStoreChange: () => void) {
	// `storage` covers other tabs; the custom event covers this one, since a tab
	// never hears its own storage writes.
	window.addEventListener("storage", onStoreChange);
	window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
	return () => {
		window.removeEventListener("storage", onStoreChange);
		window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
	};
}

function readSidebarCollapsed() {
	return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

/** The server cannot know the preference, so it always renders expanded. */
function readServerSidebarCollapsed() {
	return false;
}

function writeSidebarCollapsed(next: boolean) {
	window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
	window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
}
