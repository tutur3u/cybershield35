"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<section
			role="alert"
			className="mx-auto my-10 max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--foreground)]"
		>
			<TriangleAlert
				className="mx-auto text-[var(--warning-strong)]"
				size={32}
			/>
			<h1 className="mt-5 text-xl font-semibold">Không thể tải trang này</h1>
			<p className="mt-3 text-sm leading-6 text-[var(--muted)]">
				Dữ liệu có thể tạm thời chưa truy cập được. Thử tải lại hoặc quay về
				tổng quan để tiếp tục.
			</p>
			<div className="mt-6 flex flex-wrap justify-center gap-3">
				<button
					type="button"
					onClick={reset}
					className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-white"
				>
					<RefreshCw size={16} />
					Thử lại
				</button>
				<Link
					href="/"
					className="inline-flex h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm"
				>
					Về tổng quan
				</Link>
			</div>
		</section>
	);
}
