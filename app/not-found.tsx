import Link from "next/link";
import { FileSearch } from "lucide-react";

export default function NotFound() {
	return (
		<section className="mx-auto my-10 max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--foreground)]">
			<FileSearch size={32} className="mx-auto text-[var(--muted)]" />
			<p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
				404 · CyberShield 35
			</p>
			<h1 className="mt-2 text-xl font-semibold">Không tìm thấy nội dung</h1>
			<p className="mt-3 text-sm leading-6 text-[var(--muted)]">
				Liên kết có thể đã thay đổi hoặc nội dung không còn khả dụng.
			</p>
			<Link
				href="/"
				className="mt-6 inline-flex h-11 items-center rounded-lg bg-[var(--accent-fill)] px-4 text-sm font-semibold text-white"
			>
				Về tổng quan
			</Link>
		</section>
	);
}
