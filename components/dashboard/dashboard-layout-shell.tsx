"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { logout } from "@/components/dashboard/auth-client-actions";
import { DashboardAuthProvider } from "@/components/dashboard/dashboard-auth-context";
import { LoginRedirect } from "@/components/auth/login-redirect";
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
	const [auth, setAuth] = useState<AuthViewState>(initialAuth);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
	const [profileDialogOpen, setProfileDialogOpen] = useState(false);
	const [schedulerAutoRetryToken] = useState(readSchedulerAutoRetryToken);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(() =>
		Boolean(schedulerAutoRetryToken)
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
			`${url.pathname}${url.search}${url.hash}`
		);
	}, [schedulerAutoRetryToken]);

	useEffect(() => {
		window.localStorage.setItem(
			"cybershield35:sidebar-collapsed:v1",
			sidebarCollapsed ? "1" : "0",
		);
	}, [sidebarCollapsed]);

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
							collapsed={sidebarCollapsed}
							onToggle={() => setSidebarCollapsed((current) => !current)}
						/>
						<section className="min-w-0 lg:h-screen lg:overflow-y-auto">
							<TopBar
								auth={auth}
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
							<div className="flex-1 px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
								{children}
							</div>
						</section>
					</div>
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

function readSidebarCollapsed() {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem("cybershield35:sidebar-collapsed:v1") === "1";
}
