"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Dialog({
	children,
	description,
	onClose,
	open,
	size = "normal",
	title,
}: {
	children: ReactNode;
	description?: string;
	onClose: () => void;
	open: boolean;
	size?: "full" | "normal" | "wide";
	title: string;
}) {
	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm"
			onClick={onClose}
			role="presentation"
		>
			<section
				aria-modal="true"
				role="dialog"
				aria-labelledby="dashboard-dialog-title"
				className={`max-h-[92vh] w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl ${
					size === "full"
						? "max-w-6xl"
						: size === "wide"
							? "max-w-3xl"
							: "max-w-lg"
				}`}
				onClick={(event) => event.stopPropagation()}
			>
				<header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
					<div className="min-w-0">
						<h2
							id="dashboard-dialog-title"
							className="text-[16px] font-bold text-[var(--foreground)]"
						>
							{title}
						</h2>
						{description ? (
							<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
								{description}
							</p>
						) : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)]"
						aria-label="Đóng"
					>
						<X size={15} />
					</button>
				</header>
				<div className="p-5">{children}</div>
			</section>
		</div>
	);
}
