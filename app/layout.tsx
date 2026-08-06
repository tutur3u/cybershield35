import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { redirect } from "next/navigation";
import Script from "next/script";
import { Suspense } from "react";

import { DashboardAppSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { Telemetry } from "@/components/providers/telemetry";
import { resolveDashboardAuthFromCurrentRequest } from "@/lib/auth/dashboard-auth";
import { aiStudioWorkspaceUrl } from "@/lib/tuturuuu/ai-studio-links";

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

const SITE_URL = "https://cybershield35.ttr.gg";
const SITE_DESCRIPTION =
	"Giám sát thông tin công khai và phản hồi truyền thông: quét nguồn theo lịch, phân tích rủi ro bằng AI, soạn và xuất bản bài viết lên Zalo OA.";

/**
 * `metadataBase` decides the host every relative metadata URL resolves against
 * — the Open Graph image included. It pointed at a host the product no longer
 * runs on, so a link shared to Zalo or Facebook asked the wrong origin for its
 * preview image and got nothing back.
 */
export const metadata: Metadata = {
	title: {
		default: "CyberShield 35 | Giám sát thông tin công khai",
		template: "%s | CyberShield 35",
	},
	description: SITE_DESCRIPTION,
	applicationName: "CyberShield 35",
	authors: [
		{ name: "Công an phường Ea Kao", url: "https://zalo.me/2629920369363080604" },
		{ name: "Tuturuuu", url: "https://tuturuuu.com" },
	],
	creator: "Tuturuuu",
	publisher: "Công an phường Ea Kao",
	metadataBase: new URL(SITE_URL),
	// Part of an entry to the Đắk Lắk "AI For Life" competition. Recorded here
	// as well as in the sidebar so it survives a page being shared on its own.
	category: "Sản phẩm dự thi AI For Life (ai.daklak.gov.vn)",
	openGraph: {
		description: SITE_DESCRIPTION,
		locale: "vi_VN",
		siteName: "CyberShield 35",
		title: "CyberShield 35 | Giám sát thông tin công khai",
		type: "website",
		url: SITE_URL,
	},
	twitter: {
		card: "summary_large_image",
		description: SITE_DESCRIPTION,
		title: "CyberShield 35 | Giám sát thông tin công khai",
	},
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
			aiUsageHref={aiStudioWorkspaceUrl("runs")}
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
