export function DeferredDialogLoading({
	label = "Đang tải biểu mẫu",
}: {
	label?: string;
}) {
	return (
		<div
			aria-live="polite"
			className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm"
			role="status"
		>
			<div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-[13px] font-semibold text-[var(--muted-strong)] shadow-2xl">
				{label}...
			</div>
		</div>
	);
}
