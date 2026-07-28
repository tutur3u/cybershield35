import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { redirect } from "next/navigation";
import Script from "next/script";
import { Suspense } from "react";

import { DashboardAppSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { Telemetry } from "@/components/providers/telemetry";
import { resolveDashboardAuthFromCurrentRequest } from "@/lib/auth/dashboard-auth";

import "./globals.css";

const themeBootScript = `
(function(){
	try {
		var preference = localStorage.getItem("cybershield35:theme") || "system";
		var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		var resolved = preference === "dark" || (preference === "system" && systemDark) ? "dark" : "light";
		document.documentElement.dataset.theme = resolved;
		document.documentElement.dataset.themePreference = preference;
	} catch (_) {
		document.documentElement.dataset.theme = "light";
		document.documentElement.dataset.themePreference = "system";
	}
})();
`;

const beVietnam = Be_Vietnam_Pro({
	subsets: ["latin", "vietnamese"],
	weight: ["400", "600", "700"],
	variable: "--font-be-vietnam",
	display: "swap",
});

export const metadata: Metadata = {
	title: {
		default: "CyberShield 35 | AI For Life",
		template: "%s | CyberShield 35",
	},
	description:
		"Bảng điều khiển phân tích thảo luận công khai, bằng chứng và lập luận phản hồi cho AI For Life.",
	applicationName: "CyberShield 35",
	authors: [{ name: "AI For Life", url: "https://ai.daklak.gov.vn" }],
	creator: "AI For Life",
	publisher: "Dak Lak AI",
	metadataBase: new URL("https://ai.daklak.gov.vn"),
	other: {
		"zalo-platform-site-verification":
			"KuA_2BQz2XGqc8OsrROIC36ZlIpTrMTsCp4p",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="vi"
			className={`${beVietnam.variable} h-full antialiased`}
			suppressHydrationWarning
		>
			<body>
				<Suspense fallback={<DashboardAppSkeleton />}>
					<AuthenticatedApp>{children}</AuthenticatedApp>
				</Suspense>
				<Telemetry />
				<Script
					id="cybershield35-theme-boot"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{ __html: themeBootScript }}
				/>
			</body>
		</html>
	);
}

async function AuthenticatedApp({ children }: { children: React.ReactNode }) {
	const auth = await resolveDashboardAuthFromCurrentRequest();

	if (!auth.authenticated && !auth.publicRoute) {
		redirect(auth.loginPath);
	}

	if (!auth.authenticated) return children;

	const { DashboardLayoutShell } = await import(
		"@/components/dashboard/dashboard-layout-shell"
	);

	return (
		<DashboardLayoutShell
			initialAuth={{
				authenticated: true,
				configured: true,
				session: auth.session,
			}}
		>
			{children}
		</DashboardLayoutShell>
	);
}
