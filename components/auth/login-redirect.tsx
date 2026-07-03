"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect } from "react";

export function LoginRedirect({ href }: { href: string }) {
	useEffect(() => {
		window.location.replace(href);
	}, [href]);

	return (
		<main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-8 text-[var(--foreground)]">
			<section className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
				<span className="grid size-11 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
					<ShieldCheck size={22} />
				</span>
				<h1 className="mt-5 text-[20px] font-bold leading-7">
					Đang chuyển đến đăng nhập
				</h1>
				<p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
					Phiên cần xác thực lại. CS35 sẽ mở trang đăng nhập trung tâm.
				</p>
				<div className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold text-[var(--muted-strong)]">
					<Loader2 size={14} className="animate-spin" />
					Đang chuyển hướng
				</div>
			</section>
		</main>
	);
}
