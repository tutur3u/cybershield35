"use client";

import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useState } from "react";

export function LocalPasswordLoginForm({ nextUrl }: { nextUrl: string }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [revealPassword, setRevealPassword] = useState(false);
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending) return;

		setError("");
		setPending(true);
		try {
			const response = await fetch("/api/auth/local/login", {
				body: JSON.stringify({ nextUrl, password, username }),
				headers: { "Content-Type": "application/json" },
				method: "POST",
			});
			const body = (await response.json().catch(() => null)) as {
				error?: string;
				redirectTo?: string;
			} | null;

			if (!response.ok) {
				setError(body?.error || "Không thể đăng nhập. Thử lại sau.");
				setPending(false);
				return;
			}

			// The session cookie arrives on the response, so a full navigation is
			// what makes the authenticated layout render with it.
			window.location.assign(body?.redirectTo || nextUrl || "/");
		} catch {
			setError("Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.");
			setPending(false);
		}
	}

	return (
		<form className="mt-4 space-y-3" onSubmit={submit}>
			<div className="space-y-1.5">
				<label
					className="block text-[12px] font-bold text-[var(--muted-strong)]"
					htmlFor="local-login-username"
				>
					Tên đăng nhập
				</label>
				<input
					autoCapitalize="none"
					autoComplete="username"
					autoCorrect="off"
					className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-[13px] font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
					disabled={pending}
					id="local-login-username"
					name="username"
					onChange={(event) => setUsername(event.target.value)}
					placeholder="vd: canbo.truyenthong"
					required
					spellCheck={false}
					value={username}
				/>
			</div>

			<div className="space-y-1.5">
				<label
					className="block text-[12px] font-bold text-[var(--muted-strong)]"
					htmlFor="local-login-password"
				>
					Mật khẩu
				</label>
				<div className="relative">
					<input
						autoComplete="current-password"
						className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 pr-11 text-[13px] font-semibold text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
						disabled={pending}
						id="local-login-password"
						name="password"
						onChange={(event) => setPassword(event.target.value)}
						required
						type={revealPassword ? "text" : "password"}
						value={password}
					/>
					<button
						aria-label={revealPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
						className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--muted)] transition hover:text-[var(--foreground)]"
						onClick={() => setRevealPassword((current) => !current)}
						type="button"
					>
						{revealPassword ? <EyeOff size={16} /> : <Eye size={16} />}
					</button>
				</div>
			</div>

			{error ? (
				<p
					aria-live="polite"
					className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-[12px] font-bold text-[var(--danger-strong)]"
				>
					{error}
				</p>
			) : null}

			<button
				aria-busy={pending}
				className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 text-[13px] font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
				disabled={pending || !username.trim() || !password}
				type="submit"
			>
				{pending ? (
					<Loader2 className="animate-spin" size={16} />
				) : (
					<LogIn size={16} />
				)}
				{pending ? "Đang đăng nhập..." : "Đăng nhập bằng mật khẩu"}
			</button>
		</form>
	);
}
