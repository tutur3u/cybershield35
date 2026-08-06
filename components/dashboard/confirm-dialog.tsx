"use client";

import { useCallback, useRef, useState } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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

	const dialog = (
		<Dialog
			open={Boolean(pending)}
			onOpenChange={(open) => {
				// Dismissing by escape or backdrop is a "no", never a silent yes.
				if (!open) settle(false);
			}}
		>
			<DialogContent className="border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{pending?.title}</DialogTitle>
					<DialogDescription className="text-[var(--muted-strong)]">
						{pending?.description}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="gap-2">
					<button
						className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
						onClick={() => settle(false)}
						type="button"
					>
						{pending?.cancelLabel ?? "Hủy"}
					</button>
					<button
						autoFocus
						className={`inline-flex h-10 items-center justify-center rounded-md px-3 text-[12px] font-bold text-white transition ${
							pending?.tone === "danger"
								? "bg-[var(--danger-strong)] hover:opacity-90"
								: "bg-[var(--accent)] hover:bg-[var(--accent-fill-hover)]"
						}`}
						onClick={() => settle(true)}
						type="button"
					>
						{pending?.confirmLabel ?? "Xác nhận"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);

	return { confirm, dialog };
}
