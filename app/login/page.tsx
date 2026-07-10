import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthRequiredScreen } from "@/components/dashboard/auth-required-screen";
import { buildTuturuuuCentralizedLoginUrl } from "@/lib/auth/login-link";
import { requestUrlFromHeaders } from "@/lib/auth/request-url";
import { safeLoginReason, safePostLoginPath } from "@/lib/auth/routes";
import { buildTuturuuuScopeApprovalUrl } from "@/lib/auth/scope-approval";
import {
	allowLocalAuthBypass,
	getTuturuuuAuthDiagnostics,
	pendingInvitationPublicView,
	readAdminSession,
	readPendingInvitation,
	sessionCanRefresh,
	sessionNeedsScopeRefresh,
} from "@/lib/auth/tuturuuu-session";

export const instant = true;

export const metadata: Metadata = {
	title: "Đăng nhập",
	description: "Đăng nhập bằng Tuturuuu để mở CyberShield 35.",
};

type LoginPageProps = {
	searchParams: Promise<{
		nextUrl?: string | string[];
		reason?: string | string[];
	}>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
	return (
		<Suspense fallback={<LoginFallback />}>
			<LoginContent searchParams={searchParams} />
		</Suspense>
	);
}

async function LoginContent({ searchParams }: LoginPageProps) {
	const headerStore = await headers();
	const requestHeaders = new Headers();

	for (const [key, value] of headerStore.entries()) {
		requestHeaders.set(key, value);
	}

	const requestUrl = new URL(requestUrlFromHeaders(requestHeaders));
	const { nextUrl, reason } = await searchParams;
	const nextPath = safePostLoginPath(
		Array.isArray(nextUrl) ? nextUrl[0] : nextUrl,
		requestUrl.origin,
	);
	const requestedReason = safeLoginReason(
		Array.isArray(reason) ? reason[0] : reason,
	);
	const request = new Request(requestUrl, { headers: requestHeaders });
	const session = await readAdminSession(request);
	const needsScopeApproval = Boolean(session && sessionNeedsScopeRefresh(session));
	const loginReason = needsScopeApproval ? "scope" : requestedReason;
	const pendingInvitation =
		loginReason === "invitation"
			? pendingInvitationPublicView(await readPendingInvitation(request))
			: null;

	if (
		allowLocalAuthBypass(request) ||
		(session && sessionCanRefresh(session) && !needsScopeApproval)
	) {
		redirect(nextPath);
	}

	const authDiagnostics = getTuturuuuAuthDiagnostics();
	const loginHref = authDiagnostics.configured
		? buildTuturuuuCentralizedLoginUrl({
				appBaseUrl: requestUrl.origin,
				nextUrl: nextPath,
			})
		: undefined;
	const scopeApprovalHref =
		loginReason === "scope" && authDiagnostics.configured
			? buildTuturuuuScopeApprovalUrl({
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
			pendingInvitation={pendingInvitation}
			pendingInvitationExpired={
				loginReason === "invitation" && !pendingInvitation
			}
			reason={loginReason}
			scopeApprovalHref={scopeApprovalHref}
		/>
	);
}

function LoginFallback() {
	return (
		<main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-8 text-[var(--foreground)]">
			<section className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
				<div className="animate-pulse">
					<div className="size-11 rounded-md bg-[var(--surface-soft)]" />
					<div className="mt-5 h-7 w-48 rounded-md bg-[var(--surface-soft)]" />
					<div className="mt-3 h-4 w-full rounded-md bg-[var(--surface-soft)]" />
					<div className="mt-2 h-4 w-4/5 rounded-md bg-[var(--surface-soft)]" />
					<div className="mt-6 h-11 w-full rounded-md bg-[var(--surface-soft)]" />
				</div>
			</section>
		</main>
	);
}
