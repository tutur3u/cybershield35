"use client";

import { HelpCircle, TriangleAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmRequest = {
	cancelLabel?: string;
	confirmLabel?: string;
	description: string;
	title: string;
	tone?: "danger" | "default";
};

type PendingRequest = ConfirmRequest & { resolve: (value: boolean) => void };

/**
 * A confirmation the product owns, rather than the browser's.
 *
 * `window.confirm` renders unstyled chrome outside the app's language and theme,
 * cannot be read by anything that inspects the page, and — worse for us — blocks
 * the main thread, so a click that fires one freezes rendering until it is
 * dismissed. It also cannot be exercised in a browser test.
 *
 * Returns a promise so call sites keep the shape they had:
 * `if (await confirm({...})) { ... }`.
 */
export function useConfirmDialog() {
	const [pending, setPending] = useState<PendingRequest | null>(null);
	// Held in a ref as well so an unmount can settle the promise instead of
	// leaving the caller awaiting something that will never resolve.
	const pendingRef = useRef<PendingRequest | null>(null);

	const confirm = useCallback((request: ConfirmRequest) => {
		return new Promise<boolean>((resolve) => {
			const next = { ...request, resolve };
			pendingRef.current = next;
			setPending(next);
		});
	}, []);

	const settle = useCallback((value: boolean) => {
		pendingRef.current?.resolve(value);
		pendingRef.current = null;
		setPending(null);
	}, []);

	const danger = pending?.tone === "danger";

	/*
	 * Laid out around the question rather than stacked above a toolbar. The
	 * previous version put the title and body flush against a tinted footer band
	 * with a hard rule through it, which read as two unrelated panels sharing a
	 * box. An icon carries the tone, the text gets room, and the confirming
	 * action sits where the eye lands last.
	 */
	const dialog = (
		<Dialog
			open={Boolean(pending)}
			onOpenChange={(open) => {
				// Dismissing by escape or backdrop is a "no", never a silent yes.
				if (!open) settle(false);
			}}
		>
			<DialogContent
				className="border border-[var(--border)] bg-[var(--surface-elevated)] p-0 text-[var(--foreground)] sm:max-w-md"
				showCloseButton={false}
			>
				<div className="flex gap-3.5 p-5">
					<span
						aria-hidden
						className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${
							danger
								? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
								: "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
						}`}
					>
						{danger ? <TriangleAlert size={17} /> : <HelpCircle size={17} />}
					</span>
					<DialogHeader className="min-w-0 gap-1.5 text-left">
						<DialogTitle className="text-[15px] leading-6 font-bold">
							{pending?.title}
						</DialogTitle>
						<DialogDescription className="text-[13px] leading-5 text-[var(--muted-strong)]">
							{pending?.description}
						</DialogDescription>
					</DialogHeader>
				</div>
				<div className="flex flex-col-reverse gap-2 px-5 pb-5 sm:flex-row sm:justify-end">
					<button
						className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] px-4 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
						onClick={() => settle(false)}
						type="button"
					>
						{pending?.cancelLabel ?? "Hủy"}
					</button>
					<button
						autoFocus
						className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-[12px] font-bold text-[var(--accent-on-fill)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)] ${
							danger
								? "bg-[var(--danger-strong)] hover:opacity-90 focus-visible:ring-[var(--danger)]/50"
								: "bg-[var(--accent-fill)] hover:bg-[var(--accent-fill-hover)] focus-visible:ring-[var(--accent)]/50"
						}`}
						onClick={() => settle(true)}
						type="button"
					>
						{pending?.confirmLabel ?? "Xác nhận"}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);

	return { confirm, dialog };
}
