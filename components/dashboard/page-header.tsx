import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
	actions,
	description,
	icon: Icon,
	title,
}: {
	actions?: ReactNode;
	description: string;
	icon: LucideIcon;
	title: string;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-start gap-3">
				<span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
					<Icon size={22} />
				</span>
				<div className="min-w-0">
					<h1 className="text-[20px] font-bold leading-7 text-[var(--foreground)]">
						{title}
					</h1>
					<p className="mt-1 max-w-3xl text-[13px] leading-5 text-[var(--muted)]">
						{description}
					</p>
				</div>
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
		</div>
	);
}
