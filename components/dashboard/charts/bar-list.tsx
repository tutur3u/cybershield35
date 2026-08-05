"use client";

import Link from "next/link";

export type BarSegment = { color: string; label: string; value: number };

export type BarListRow = {
	href?: string;
	label: string;
	meta?: string;
	segments: BarSegment[];
};

/**
 * Ranked magnitude with an optional composition per row. Horizontal bars keep long
 * Vietnamese labels readable without rotation, and each row is directly labeled.
 */
export function BarList({ rows }: { rows: BarListRow[] }) {
	const max = Math.max(
		1,
		...rows.map((row) => row.segments.reduce((sum, part) => sum + part.value, 0)),
	);

	return (
		<ul className="space-y-2.5">
			{rows.map((row) => {
				const total = row.segments.reduce((sum, part) => sum + part.value, 0);
				const width = (total / max) * 100;
				const content = (
					<>
						<span className="flex min-w-0 items-baseline justify-between gap-3">
							<span className="truncate text-[12px] font-bold text-[var(--foreground)]">
								{row.label}
							</span>
							<span className="shrink-0 text-[12px] font-semibold text-[var(--muted-strong)]">
								{total.toLocaleString("vi-VN")}
								{row.meta ? ` · ${row.meta}` : ""}
							</span>
						</span>
						<span
							className="mt-1.5 flex h-2.5 gap-0.5 overflow-hidden rounded"
							style={{ width: `${Math.max(width, 4)}%` }}
						>
							{row.segments
								.filter((segment) => segment.value > 0)
								.map((segment) => (
									<span
										key={segment.label}
										title={`${segment.label}: ${segment.value.toLocaleString("vi-VN")}`}
										className="h-full first:rounded-l last:rounded-r"
										style={{
											backgroundColor: segment.color,
											flexGrow: segment.value,
										}}
									/>
								))}
						</span>
					</>
				);

				return (
					<li key={row.label} className="min-w-0">
						{row.href ? (
							<Link
								href={row.href}
								className="block rounded-md px-1 py-0.5 transition hover:bg-[var(--surface-soft)]"
							>
								{content}
							</Link>
						) : (
							<span className="block px-1 py-0.5">{content}</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}
