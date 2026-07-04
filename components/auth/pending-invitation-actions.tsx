"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PendingInvitationPublicView } from "@/lib/auth/tuturuuu-session";

type ActionState = "idle" | "accepting" | "rejecting" | "success";

export function PendingInvitationActions({
	pendingInvitation,
}: {
	pendingInvitation: PendingInvitationPublicView;
}) {
	const router = useRouter();
	const [state, setState] = useState<ActionState>("idle");
	const [error, setError] = useState<string | null>(null);
	const isPending = state === "accepting" || state === "rejecting";
	const invitation = pendingInvitation.invitation;
	const workspaceLabel =
		invitation.workspaceName ??
		invitation.workspaceHandle ??
		invitation.workspaceId;

	async function decide(action: "accept" | "reject") {
		setError(null);
		setState(action === "accept" ? "accepting" : "rejecting");

		try {
			const response = await fetch("/api/auth/pending-invitation", {
				body: JSON.stringify({
					action,
					csrfToken: pendingInvitation.csrfToken,
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const body = (await response.json().catch(() => null)) as {
				error?: string;
				redirectTo?: string;
				status?: string;
			} | null;

			if (!response.ok) {
				throw new Error(body?.error ?? "Không thể xử lý lời mời.");
			}

			setState("success");
			router.replace(body?.redirectTo ?? "/");
			router.refresh();
		} catch (decisionError) {
			setState("idle");
			setError(
				decisionError instanceof Error
					? decisionError.message
					: "Không thể xử lý lời mời.",
			);
		}
	}

	return (
		<div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--success-strong)]">
					<CheckCircle2 size={18} />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-bold text-[var(--foreground)]">
						{workspaceLabel}
					</p>
					<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
						Vai trò: {roleLabel(invitation.role)} · Nguồn:{" "}
						{sourceLabel(invitation.source)}
					</p>
				</div>
			</div>

			{error ? (
				<div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3 text-[12px] leading-5 text-[var(--danger-strong)]">
					<XCircle size={15} className="mt-0.5 shrink-0" />
					<p>{error}</p>
				</div>
			) : null}

			<div className="mt-4 grid gap-2 sm:grid-cols-2">
				<button
					type="button"
					disabled={isPending || state === "success"}
					onClick={() => void decide("accept")}
					className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
				>
					{state === "accepting" ? (
						<Loader2 size={15} className="animate-spin" />
					) : null}
					{state === "success" ? "Đã chấp nhận" : "Chấp nhận lời mời"}
				</button>
				<button
					type="button"
					disabled={isPending || state === "success"}
					onClick={() => void decide("reject")}
					className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-[13px] font-bold text-[var(--foreground)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-65"
				>
					{state === "rejecting" ? (
						<Loader2 size={15} className="animate-spin" />
					) : null}
					Từ chối
				</button>
			</div>
		</div>
	);
}

function roleLabel(role: string | null | undefined) {
	if (role === "MEMBER") return "Thành viên";
	if (role === "GUEST") return "Khách";
	return "Chưa rõ";
}

function sourceLabel(source: string | null | undefined) {
	if (source === "direct") return "Mời trực tiếp";
	if (source === "email") return "Email";
	return "Chưa rõ";
}
