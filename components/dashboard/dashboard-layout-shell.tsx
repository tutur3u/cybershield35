"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { logout } from "@/components/dashboard/client-actions";
import { DashboardAuthProvider } from "@/components/dashboard/dashboard-auth-context";
import { LoginRedirect } from "@/components/auth/login-redirect";
import { Dialog } from "@/components/dashboard/dialog-frame";
import { ManagedSchedulerPanel } from "@/components/dashboard/managed-scheduler-panel";
import { ProviderStatus } from "@/components/dashboard/page-widgets";
import { ProfileSettingsPanel } from "@/components/dashboard/profile-settings-panel";
import { Sidebar, TopBar } from "@/components/dashboard/shell";
import { useThemePreference } from "@/components/dashboard/theme";
import type {
	AuthViewState,
	ProviderAvailabilityView,
} from "@/components/dashboard/types";

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
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [profileDialogOpen, setProfileDialogOpen] = useState(false);
	const [schedulerAutoRetryToken] = useState(readSchedulerAutoRetryToken);
	const [settingsDialogOpen, setSettingsDialogOpen] = useState(() =>
		Boolean(schedulerAutoRetryToken)
	);
	const [providerAvailability, setProviderAvailability] =
		useState<ProviderAvailabilityView | null>(initialProviderAvailability);
	const [, setNotice] = useState("");
	const { preference, resolvedTheme, setPreference } = useThemePreference();

	useEffect(() => {
		if (!auth.authenticated) return;

		let alive = true;
		fetch("/api/health", { cache: "no-store" })
			.then((response) => response.json())
			.then((payload: { providers?: ProviderAvailabilityView }) => {
				if (!alive) return;
				setProviderAvailability(payload.providers ?? null);
			})
			.catch(() => setProviderAvailability(null));

		return () => {
			alive = false;
		};
	}, [auth.authenticated]);

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
										auth.loginHref ?? currentLoginHref("logged-out"),
									)
								}
								onOpenProfile={() => setProfileDialogOpen(true)}
								onOpenSettings={() => setSettingsDialogOpen(true)}
								onSelectTheme={setPreference}
								resolvedTheme={resolvedTheme}
								themePreference={preference}
							/>
							<div className="flex-1 px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
								{children}
							</div>
						</section>
					</div>
					<Dialog
						open={profileDialogOpen}
						onClose={() => setProfileDialogOpen(false)}
						title="Hồ sơ tài khoản"
						description="Tên hiển thị và ảnh đại diện cho phiên đang đăng nhập."
						size="wide"
					>
						<ProfileSettingsPanel
							auth={auth}
							embedded
							onProfileUpdated={(session) => {
								setAuth((current) => ({
									...current,
									authenticated: true,
									configured: true,
									session,
								}));
							}}
						/>
					</Dialog>
					<Dialog
						open={settingsDialogOpen}
						onClose={() => setSettingsDialogOpen(false)}
						title="Cài đặt vận hành"
						description="Trạng thái provider và tự động hóa lịch quét."
						size="wide"
					>
						<div className="space-y-4">
							<ManagedSchedulerPanel
								autoRetryToken={schedulerAutoRetryToken}
							/>
							<ProviderStatus availability={providerAvailability ?? undefined} />
						</div>
					</Dialog>
				</main>
			) : (
				<LoginRedirect href={auth.loginHref ?? currentLoginHref("expired")} />
			)}
		</DashboardAuthProvider>
	);
}

function currentLoginHref(reason = "expired") {
	if (typeof window === "undefined") return "/login";

	const nextUrl = `${window.location.pathname}${window.location.search}`;
	return `/login?nextUrl=${encodeURIComponent(nextUrl)}&reason=${encodeURIComponent(reason)}`;
}

function readSchedulerAutoRetryToken() {
	if (typeof window === "undefined") return undefined;

	const url = new URL(window.location.href);
	return url.searchParams.get("cronSetup") === "retry" ? Date.now() : undefined;
}
