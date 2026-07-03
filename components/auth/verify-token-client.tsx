"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type VerificationState = "loading" | "success";

type VerificationResponse = {
	error?: string;
	scopeApprovalHref?: string;
	session?: {
		authenticated?: boolean;
		user?: {
			id?: string;
		};
	};
};

function sanitizeNextPath(
	rawValue: string | null | undefined,
	requestOrigin = "http://localhost",
	fallbackPath = "/",
) {
	if (!rawValue?.trim() || rawValue.startsWith("//")) return fallbackPath;

	try {
		const parsed = new URL(rawValue, requestOrigin);
		if (parsed.origin !== requestOrigin) return fallbackPath;
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return fallbackPath;
	}
}

export function VerifyTokenClient() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [state, setState] = useState<VerificationState>("loading");
	const nextPath = useMemo(
		() =>
			sanitizeNextPath(
				searchParams.get("nextUrl"),
				typeof window === "undefined" ? "http://localhost" : window.location.origin,
				"/",
			),
		[searchParams],
	);
	const invalidLinkHref = useMemo(
		() => loginHref(nextPath, "invalid-link"),
		[nextPath],
	);
	const scopeHref = useMemo(() => loginHref(nextPath, "scope"), [nextPath]);

	useEffect(() => {
		let cancelled = false;

		async function verifyToken() {
			const token = searchParams.get("token");

			if (!token) {
				router.replace(invalidLinkHref);
				return;
			}

			try {
				const response = await fetch("/api/auth/verify-app-token", {
					body: JSON.stringify({ nextUrl: nextPath, token }),
					headers: { "Content-Type": "application/json" },
					method: "POST",
				});
				const data = (await response
					.json()
					.catch(() => null)) as VerificationResponse | null;

				if (!response.ok || !data?.session?.authenticated || !data.session.user?.id) {
					router.replace(data?.scopeApprovalHref ? scopeHref : invalidLinkHref);
					return;
				}

				if (cancelled) return;
				setState("success");
				router.replace(nextPath);
				router.refresh();
			} catch {
				if (cancelled) return;
				router.replace(invalidLinkHref);
			}
		}

		void verifyToken();

		return () => {
			cancelled = true;
		};
	}, [invalidLinkHref, nextPath, router, scopeHref, searchParams]);

	return (
		<>
			<span className="grid size-11 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
				{state === "success" ? (
					<ShieldCheck size={22} />
				) : (
					<Loader2 size={22} className="animate-spin" />
				)}
			</span>
			<h1 className="mt-5 text-[22px] font-bold leading-7">
				{state === "success" ? "Đã kết nối" : "Đang kết nối phiên"}
			</h1>
			<p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
				Đang hoàn tất xác thực quản trị và chuyển về bảng điều khiển.
			</p>
		</>
	);
}

function loginHref(nextPath: string, reason: "invalid-link" | "scope") {
	const params = new URLSearchParams({ nextUrl: nextPath, reason });
	return `/login?${params.toString()}`;
}
