import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyTokenClient } from "@/components/auth/verify-token-client";

export const instant = true;

export const metadata: Metadata = {
	title: "Đăng nhập",
	description: "Hoàn tất xác thực cho CyberShield 35.",
};

function VerifyTokenFallback() {
	return (
		<>
			<span className="grid size-11 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
				...
			</span>
			<h1 className="mt-5 text-[22px] font-bold leading-7">
				Đang hoàn tất kết nối
			</h1>
			<p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">
				Bạn sẽ được chuyển về bảng điều khiển ngay khi kết nối sẵn sàng.
			</p>
		</>
	);
}

export default function VerifyTokenPage() {
	return (
		<main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-8 text-[var(--foreground)]">
			<section className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
				<Suspense fallback={<VerifyTokenFallback />}>
					<VerifyTokenClient />
				</Suspense>
			</section>
		</main>
	);
}
