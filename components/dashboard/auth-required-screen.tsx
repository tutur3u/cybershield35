"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PrimaryButton } from "@/components/dashboard/ui-primitives";

export function AuthRequiredScreen({
	configured,
	error,
}: {
	configured: boolean;
	error?: string;
}) {
	const router = useRouter();
	const [token, setToken] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState(error ?? "");

	async function verifyToken() {
		setSubmitting(true);
		setMessage("");

		try {
			const response = await fetch("/api/auth/verify-app-token", {
				body: JSON.stringify({ token }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok) {
				throw new Error(payload?.error ?? "Không thể xác thực Tuturuuu");
			}

			setToken("");
			router.refresh();
		} catch (requestError) {
			setMessage(
				requestError instanceof Error
					? requestError.message
					: "Không thể xác thực Tuturuuu",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6">
			<div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
				<section className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
					<div className="flex items-start gap-3">
						<span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
							<ShieldCheck size={22} />
						</span>
						<div className="min-w-0">
							<h1 className="text-[20px] font-bold leading-7">
								CyberShield 35
							</h1>
							<p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
								Yêu cầu phiên Tuturuuu để vào bảng điều khiển.
							</p>
						</div>
					</div>

					<div className="mt-6 space-y-4">
						<label className="block text-[12px] font-bold text-[var(--muted-strong)]">
							Short app token
							<div className="mt-2 flex gap-2">
								<input
									value={token}
									onChange={(event) => setToken(event.target.value)}
									placeholder="Dán token tại đây"
									type="password"
									disabled={!configured || submitting}
									className="h-11 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
								/>
								<span className="grid size-11 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)]">
									<KeyRound size={16} />
								</span>
							</div>
						</label>

						{message ? (
							<p className="rounded-md bg-[var(--danger-soft)] p-3 text-[12px] font-semibold text-[var(--danger-strong)]">
								{configured
									? message
									: "Cấu hình Tuturuuu chưa hoàn tất trên máy chủ."}
							</p>
						) : null}

						<PrimaryButton
							disabled={!configured || submitting || !token.trim()}
							onClick={verifyToken}
						>
							<ShieldCheck size={15} />
							{submitting ? "Đang xác thực" : "Xác thực Tuturuuu"}
						</PrimaryButton>
					</div>
				</section>
			</div>
		</main>
	);
}
