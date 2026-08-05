"use client";

import { useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";

export function LocalPasswordDialog({
	onClose,
	onChanged,
	required = false,
}: {
	onChanged: () => void;
	onClose: () => void;
	required?: boolean;
}) {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (saving) return;

		if (newPassword !== confirmPassword) {
			setError("Mật khẩu xác nhận không khớp.");
			return;
		}

		setError("");
		setSaving(true);
		try {
			const response = await fetch("/api/auth/local/password", {
				body: JSON.stringify({ currentPassword, newPassword }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const payload = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;
			if (!response.ok) {
				setError(payload?.error || "Không thể đổi mật khẩu.");
				setSaving(false);
				return;
			}
			onChanged();
		} catch {
			setError("Không thể kết nối máy chủ. Thử lại sau.");
			setSaving(false);
		}
	}

	return (
		<Dialog
			open
			// A forced change has no dismissal path; closing it would leave the
			// operator inside the dashboard with a password an admin already handed
			// out in plaintext.
			onClose={required ? () => undefined : onClose}
			title="Đổi mật khẩu"
			description={
				required
					? "Đây là lần đăng nhập đầu tiên với mật khẩu do quản trị viên cấp. Hãy đặt mật khẩu riêng để tiếp tục."
					: "Đặt mật khẩu mới cho tài khoản đăng nhập bằng mật khẩu."
			}
		>
			<form className="space-y-3" onSubmit={submit}>
				<PasswordField
					autoComplete="current-password"
					disabled={saving}
					id="local-current-password"
					label="Mật khẩu hiện tại"
					onChange={setCurrentPassword}
					value={currentPassword}
				/>
				<PasswordField
					autoComplete="new-password"
					disabled={saving}
					id="local-new-password"
					label="Mật khẩu mới"
					onChange={setNewPassword}
					value={newPassword}
				/>
				<PasswordField
					autoComplete="new-password"
					disabled={saving}
					id="local-confirm-password"
					label="Xác nhận mật khẩu mới"
					onChange={setConfirmPassword}
					value={confirmPassword}
				/>

				<p className="text-[11px] leading-4 text-[var(--muted)]">
					Ít nhất 12 ký tự, gồm chữ hoa, chữ thường và số. Mọi thiết bị khác sẽ
					bị đăng xuất.
				</p>

				{error ? (
					<p
						aria-live="polite"
						className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-bold text-[var(--danger-strong)]"
					>
						{error}
					</p>
				) : null}

				<div className="flex justify-end gap-2">
					{required ? null : (
						<button
							type="button"
							onClick={onClose}
							className="h-10 rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
						>
							Hủy
						</button>
					)}
					<button
						type="submit"
						disabled={saving || !currentPassword || !newPassword}
						className="h-10 rounded-md bg-[var(--accent)] px-3 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{saving ? "Đang lưu..." : "Đổi mật khẩu"}
					</button>
				</div>
			</form>
		</Dialog>
	);
}

function PasswordField({
	autoComplete,
	disabled,
	id,
	label,
	onChange,
	value,
}: {
	autoComplete: string;
	disabled: boolean;
	id: string;
	label: string;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<label className="block" htmlFor={id}>
			<span className="mb-1.5 block text-[12px] font-bold text-[var(--muted-strong)]">
				{label}
			</span>
			<input
				autoComplete={autoComplete}
				className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
				disabled={disabled}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				required
				type="password"
				value={value}
			/>
		</label>
	);
}
