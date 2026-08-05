"use client";

import { useState } from "react";

export type DonutSlice = { color: string; label: string; value: number };

/**
 * Part-to-whole for a small, named set. The centre carries the headline total so
 * the reader gets the magnitude without decoding arc lengths.
 */
export function DonutChart({
	centerLabel,
	slices,
}: {
	centerLabel: string;
	slices: DonutSlice[];
}) {
	const [active, setActive] = useState<string | null>(null);
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const size = 180;
	const radius = 70;
	const strokeWidth = 22;
	const circumference = 2 * Math.PI * radius;
	let offset = 0;

	return (
		<div className="flex flex-wrap items-center gap-5">
			<div className="relative shrink-0">
				<svg
					viewBox={`0 0 ${size} ${size}`}
					className="h-44 w-44"
					role="img"
					aria-label={`Phân bố ${centerLabel}`}
				>
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="var(--chart-grid)"
						strokeWidth={strokeWidth}
					/>
					{total > 0
						? slices.map((slice) => {
								const fraction = slice.value / total;
								// A 2px surface gap keeps adjacent segments from bleeding together.
								const dash = Math.max(0, fraction * circumference - 2);
								const element = (
									<circle
										key={slice.label}
										cx={size / 2}
										cy={size / 2}
										r={radius}
										fill="none"
										stroke={slice.color}
										strokeWidth={active === slice.label ? strokeWidth + 4 : strokeWidth}
										strokeDasharray={`${dash} ${circumference - dash}`}
										strokeDashoffset={-offset}
										transform={`rotate(-90 ${size / 2} ${size / 2})`}
										onMouseEnter={() => setActive(slice.label)}
										onMouseLeave={() => setActive(null)}
										className="transition-[stroke-width]"
									/>
								);
								offset += fraction * circumference;
								return element;
							})
						: null}
					<text
						x={size / 2}
						y={size / 2 - 4}
						textAnchor="middle"
						className="fill-[var(--foreground)] text-[26px] font-bold"
					>
						{total.toLocaleString("vi-VN")}
					</text>
					<text
						x={size / 2}
						y={size / 2 + 16}
						textAnchor="middle"
						className="fill-[var(--muted)] text-[11px] font-semibold"
					>
						{centerLabel}
					</text>
				</svg>
			</div>
			<ul className="min-w-0 flex-1 space-y-2">
				{slices.map((slice) => {
					const share = total ? Math.round((slice.value / total) * 100) : 0;
					return (
						<li
							key={slice.label}
							onMouseEnter={() => setActive(slice.label)}
							onMouseLeave={() => setActive(null)}
							className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 transition ${
								active === slice.label ? "bg-[var(--surface-soft)]" : ""
							}`}
						>
							<span className="inline-flex min-w-0 items-center gap-2 text-[12px] font-bold text-[var(--foreground)]">
								<span
									aria-hidden
									className="size-2.5 shrink-0 rounded-sm"
									style={{ backgroundColor: slice.color }}
								/>
								<span className="truncate">{slice.label}</span>
							</span>
							<span className="shrink-0 text-[12px] font-semibold text-[var(--muted-strong)]">
								{slice.value.toLocaleString("vi-VN")} · {share}%
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
