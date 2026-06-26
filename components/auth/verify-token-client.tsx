"use client";

import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type VerificationState = "failed" | "loading" | "success";

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
	const [error, setError] = useState<string | null>(null);
	const [scopeApprovalHref, setScopeApprovalHref] = useState<string | null>(null);
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
	const retryHref = useMemo(
		() => `/login?nextUrl=${encodeURIComponent(nextPath)}`,
		[nextPath],
	);

	useEffect(() => {
		let cancelled = false;

		async function verifyToken() {
			const token = searchParams.get("token");

			if (!token) {
				setError(
					"Phiên đăng nhập Tuturuuu không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
				);
				setState("failed");
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
					setScopeApprovalHref(data?.scopeApprovalHref ?? null);
					throw new Error(data?.error || "Không thể xác thực phiên Tuturuuu.");
				}

				if (cancelled) return;
				setState("success");
				router.replace(nextPath);
				router.refresh();
			} catch (verificationError) {
				if (cancelled) return;
				setError(
					verificationError instanceof Error
						? verificationError.message
						: "Không thể xác thực phiên Tuturuuu.",
				);
				setState("failed");
			}
		}

		void verifyToken();

		return () => {
			cancelled = true;
		};
	}, [nextPath, router, searchParams]);

	if (state === "failed") {
		return (
			<>
				<span className="grid size-11 place-items-center rounded-md bg-[var(--danger-soft)] text-[var(--danger-strong)]">
					<AlertTriangle size={22} />
				</span>
				<h1 className="mt-5 text-[22px] font-bold leading-7">
					Không thể đăng nhập
				</h1>
				<p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
					{error}
				</p>
				<Link
					href={retryHref}
					className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
				>
					Đăng nhập lại bằng Tuturuuu
				</Link>
				{scopeApprovalHref ? (
					<Link
						href={scopeApprovalHref}
						className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)]"
					>
						Duyệt quyền trong Tuturuuu
					</Link>
				) : null}
			</>
		);
	}

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
				{state === "success" ? "Đã kết nối" : "Đang kết nối Tuturuuu"}
			</h1>
			<p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
				Đang hoàn tất xác thực quản trị và chuyển về bảng điều khiển.
			</p>
		</>
	);
}
