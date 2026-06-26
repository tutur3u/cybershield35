"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@tuturuuu/ui/avatar";
import { ImageOff, Loader2, Save, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AdminSessionView, AuthViewState } from "@/components/dashboard/types";
import { FieldLabel, Panel, PanelHeader } from "@/components/dashboard/ui-primitives";

export function ProfileSettingsPanel({
	auth,
	onProfileUpdated,
}: {
	auth: AuthViewState;
	onProfileUpdated: (session: AdminSessionView) => void;
}) {
	const session = auth.session;
	const [displayName, setDisplayName] = useState(
		session?.user.displayName ?? "",
	);
	const [avatarUrl, setAvatarUrl] = useState(session?.user.avatarUrl ?? "");
	const [busyAction, setBusyAction] = useState<"remove-avatar" | "save" | null>(
		null,
	);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	useEffect(() => {
		setDisplayName(session?.user.displayName ?? "");
		setAvatarUrl(session?.user.avatarUrl ?? "");
	}, [session?.user.avatarUrl, session?.user.displayName]);

	const cleanedDisplayName = displayName.trim();
	const cleanedAvatarUrl = avatarUrl.trim();
	const currentDisplayName = session?.user.displayName ?? "";
	const currentAvatarUrl = session?.user.avatarUrl ?? "";
	const hasChanges =
		cleanedDisplayName !== currentDisplayName ||
		cleanedAvatarUrl !== currentAvatarUrl;
	const canSave =
		Boolean(session) && Boolean(cleanedDisplayName) && hasChanges && !busyAction;
	const previewName = cleanedDisplayName || currentDisplayName || "Tuturuuu";
	const initials = useMemo(() => getInitials(previewName), [previewName]);

	async function submitProfile(nextAvatarUrl: string | null = cleanedAvatarUrl) {
		if (!session || busyAction) return;

		setError("");
		setSuccess("");
		setBusyAction(nextAvatarUrl === null ? "remove-avatar" : "save");

		try {
			const response = await fetch("/api/auth/profile", {
				body: JSON.stringify({
					avatar_url: nextAvatarUrl,
					display_name: cleanedDisplayName,
				}),
				cache: "no-store",
				headers: { "Content-Type": "application/json" },
				method: "PATCH",
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || !payload?.session) {
				throw new Error(readProfileError(payload));
			}

			onProfileUpdated(payload.session);
			setDisplayName(payload.session.user.displayName ?? "");
			setAvatarUrl(payload.session.user.avatarUrl ?? "");
			setSuccess("Đã cập nhật hồ sơ Tuturuuu.");
		} catch (profileError) {
			setError(
				profileError instanceof Error
					? profileError.message
					: "Không thể cập nhật hồ sơ.",
			);
		} finally {
			setBusyAction(null);
		}
	}

	return (
		<Panel>
			<PanelHeader
				title="Hồ sơ Tuturuuu"
				description="Tên hiển thị và ảnh đại diện dùng cho phiên đăng nhập hiện tại."
			/>
			<div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
				<form
					className="min-w-0 space-y-4"
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						if (canSave) void submitProfile();
					}}
				>
					<div className="space-y-2">
						<FieldLabel>Tên hiển thị</FieldLabel>
						<input
							value={displayName}
							onChange={(event) => setDisplayName(event.target.value)}
							maxLength={100}
							className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
							placeholder="Tên hiển thị"
						/>
					</div>
					<div className="space-y-2">
						<FieldLabel>Avatar URL</FieldLabel>
						<input
							value={avatarUrl}
							onChange={(event) => setAvatarUrl(event.target.value)}
							className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
							placeholder="https://example.com/avatar.png"
							type="url"
						/>
					</div>
					{error ? (
						<p className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--danger-strong)]">
							{error}
						</p>
					) : null}
					{success ? (
						<p className="rounded-md border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--success-strong)]">
							{success}
						</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						<button
							type="submit"
							disabled={!canSave}
							className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition whitespace-nowrap hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{busyAction === "save" ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Save size={14} />
							)}
							Lưu
						</button>
						<button
							type="button"
							disabled={!session || !currentAvatarUrl || Boolean(busyAction)}
							onClick={() => void submitProfile(null)}
							className="inline-flex h-10 max-w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition whitespace-nowrap hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{busyAction === "remove-avatar" ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<ImageOff size={14} />
							)}
							Gỡ ảnh
						</button>
					</div>
				</form>
				<div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
					<Avatar className="mx-auto size-20 rounded-lg border border-[var(--border)] bg-[var(--success-soft)] text-[20px] font-bold text-[var(--brand)]">
						{cleanedAvatarUrl ? (
							<AvatarImage
								src={cleanedAvatarUrl}
								alt=""
								referrerPolicy="no-referrer"
							/>
						) : null}
						<AvatarFallback className="bg-[var(--success-soft)] text-[var(--brand)]">
							{cleanedAvatarUrl ? (
								initials
							) : (
								<UserRound size={28} aria-hidden="true" />
							)}
						</AvatarFallback>
					</Avatar>
					<div className="mt-3 min-w-0 text-center">
						<p className="truncate text-[14px] font-bold text-[var(--foreground)]">
							{previewName}
						</p>
						<p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
							{session?.user.email ?? initials}
						</p>
					</div>
				</div>
			</div>
		</Panel>
	);
}

function readProfileError(payload: unknown) {
	if (payload && typeof payload === "object") {
		const candidate = payload as { error?: unknown; message?: unknown };
		if (typeof candidate.message === "string") return candidate.message;
		if (typeof candidate.error === "string") return candidate.error;
	}

	return "Không thể cập nhật hồ sơ.";
}

function getInitials(value: string) {
	const initials = value
		.split(/[\s@._-]+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
	return initials || "TT";
}
