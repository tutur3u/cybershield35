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
		<div className="workspace-page-header">
			<div className="flex min-w-0 items-start gap-3">
				<span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--brand-strong)]">
					<Icon size={22} aria-hidden="true" />
				</span>
				<div className="min-w-0">
					<h1 className="text-2xl font-semibold leading-8 tracking-tight text-[var(--foreground)]">
						{title}
					</h1>
					<p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
						{description}
					</p>
				</div>
			</div>
			{actions ? (
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			) : null}
		</div>
	);
}
