"use client";

import { Table2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export type ChartSeries = { color: string; label: string };

/**
 * Shared chart chrome: title, legend, and a table view. Every chart ships the
 * table so identity never depends on color alone.
 */
export function ChartFrame({
	children,
	description,
	footer,
	series,
	table,
	title,
}: {
	children: ReactNode;
	description?: string;
	footer?: ReactNode;
	series?: ChartSeries[];
	table?: { headers: string[]; rows: Array<Array<number | string>> };
	title: string;
}) {
	const [showTable, setShowTable] = useState(false);

	return (
		<figure className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
			<figcaption className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="text-[13px] font-bold text-[var(--foreground)]">{title}</h3>
					{description ? (
						<p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
							{description}
						</p>
					) : null}
				</div>
				{table ? (
					<button
						type="button"
						aria-pressed={showTable}
						onClick={() => setShowTable((value) => !value)}
						className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
						title={showTable ? "Xem biểu đồ" : "Xem dạng bảng"}
					>
						{showTable ? <X size={14} /> : <Table2 size={14} />}
					</button>
				) : null}
			</figcaption>

			<div className="mt-3 min-w-0">
				{showTable && table ? (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[12px]">
							<thead>
								<tr className="border-b border-[var(--border)]">
									{table.headers.map((header) => (
										<th
											key={header}
											className="py-1.5 pr-3 font-bold text-[var(--muted-strong)]"
										>
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{table.rows.map((row) => (
									<tr key={String(row[0])} className="border-b border-[var(--divider)]">
										{row.map((cell, index) => (
											<td
												key={`${String(row[0])}-${index}`}
												className="py-1.5 pr-3 font-semibold text-[var(--foreground)]"
											>
												{typeof cell === "number"
													? cell.toLocaleString("vi-VN")
													: cell}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					children
				)}
			</div>

			{series && series.length > 1 ? (
				<ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
					{series.map((item) => (
						<li
							key={item.label}
							className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted-strong)]"
						>
							<span
								aria-hidden
								className="size-2.5 rounded-sm"
								style={{ backgroundColor: item.color }}
							/>
							{item.label}
						</li>
					))}
				</ul>
			) : null}
			{footer ? <div className="mt-3">{footer}</div> : null}
		</figure>
	);
}

export function ChartEmptyState({ message }: { message: string }) {
	return (
		<div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-[var(--border)] px-4 text-center text-[12px] font-semibold text-[var(--muted)]">
			{message}
		</div>
	);
}
