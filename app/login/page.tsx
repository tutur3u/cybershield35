import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthRequiredScreen } from "@/components/dashboard/auth-required-screen";
import { buildTuturuuuCentralizedLoginUrl } from "@/lib/auth/login-link";
import { requestUrlFromHeaders } from "@/lib/auth/request-url";
import { safePostLoginPath } from "@/lib/auth/routes";
import {
	allowLocalAuthBypass,
	getTuturuuuAuthDiagnostics,
	readAdminSession,
	sessionCanRefresh,
} from "@/lib/auth/tuturuuu-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Đăng nhập",
	description: "Đăng nhập bằng Tuturuuu để mở CyberShield 35.",
};

type LoginPageProps = {
	searchParams: Promise<{ nextUrl?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const headerStore = await headers();
	const requestHeaders = new Headers();

	for (const [key, value] of headerStore.entries()) {
		requestHeaders.set(key, value);
	}

	const requestUrl = new URL(requestUrlFromHeaders(requestHeaders));
	const { nextUrl } = await searchParams;
	const nextPath = safePostLoginPath(
		Array.isArray(nextUrl) ? nextUrl[0] : nextUrl,
		requestUrl.origin,
	);
	const request = new Request(requestUrl, { headers: requestHeaders });
	const session = await readAdminSession(request);

	if (allowLocalAuthBypass(request) || (session && sessionCanRefresh(session))) {
		redirect(nextPath);
	}

	const authDiagnostics = getTuturuuuAuthDiagnostics();
	const loginHref = authDiagnostics.configured
		? buildTuturuuuCentralizedLoginUrl({
				appBaseUrl: requestUrl.origin,
				nextUrl: nextPath,
			})
		: undefined;

	return (
		<AuthRequiredScreen
			authDiagnostics={authDiagnostics}
			configured={authDiagnostics.configured}
			error="Authentication required"
			loginHref={loginHref}
		/>
	);
}
