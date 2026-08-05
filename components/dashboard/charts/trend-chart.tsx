"use client";

import { useState } from "react";

export type TrendSeries = { color: string; key: string; label: string };

export type TrendPoint = { day: string } & Record<string, number | string>;

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { bottom: 26, left: 34, right: 12, top: 12 };

/**
 * Change over time on a single shared axis — never two scales. Hovering exposes a
 * crosshair with every series value for that day.
 */
export function TrendChart({
	points,
	series,
	valueSuffix = "",
}: {
	points: TrendPoint[];
	series: TrendSeries[];
	valueSuffix?: string;
}) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const plotWidth = WIDTH - PADDING.left - PADDING.right;
	const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
	const maxValue = Math.max(
		1,
		...points.flatMap((point) =>
			series.map((item) => Number(point[item.key] ?? 0)),
		),
	);
	const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
	const xFor = (index: number) => PADDING.left + index * stepX;
	const yFor = (value: number) =>
		PADDING.top + plotHeight - (value / maxValue) * plotHeight;
	const ticks = [0, 0.5, 1].map((fraction) => Math.round(maxValue * fraction));
	const active = activeIndex === null ? null : points[activeIndex];

	return (
		<div className="relative min-w-0">
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className="h-56 w-full"
				role="img"
				aria-label="Diễn biến theo ngày"
				onMouseLeave={() => setActiveIndex(null)}
				onMouseMove={(event) => {
					const bounds = event.currentTarget.getBoundingClientRect();
					const ratio = (event.clientX - bounds.left) / bounds.width;
					const x = ratio * WIDTH - PADDING.left;
					const index = Math.round(x / (stepX || 1));
					setActiveIndex(Math.min(points.length - 1, Math.max(0, index)));
				}}
			>
				{ticks.map((tick) => (
					<g key={tick}>
						<line
							x1={PADDING.left}
							x2={WIDTH - PADDING.right}
							y1={yFor(tick)}
							y2={yFor(tick)}
							stroke="var(--chart-grid)"
							strokeWidth={1}
						/>
						<text
							x={PADDING.left - 6}
							y={yFor(tick) + 4}
							textAnchor="end"
							className="fill-[var(--chart-axis)] text-[10px] font-semibold"
						>
							{tick}
						</text>
					</g>
				))}

				{series.map((item) => (
					<polyline
						key={item.key}
						points={points
							.map(
								(point, index) =>
									`${xFor(index)},${yFor(Number(point[item.key] ?? 0))}`,
							)
							.join(" ")}
						fill="none"
						stroke={item.color}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
					/>
				))}

				{activeIndex !== null ? (
					<g>
						<line
							x1={xFor(activeIndex)}
							x2={xFor(activeIndex)}
							y1={PADDING.top}
							y2={PADDING.top + plotHeight}
							stroke="var(--chart-axis)"
							strokeDasharray="3 3"
							strokeWidth={1}
						/>
						{series.map((item) => (
							<circle
								key={item.key}
								cx={xFor(activeIndex)}
								cy={yFor(Number(active?.[item.key] ?? 0))}
								r={4.5}
								fill={item.color}
								stroke="var(--surface)"
								strokeWidth={2}
							/>
						))}
					</g>
				) : null}

				{points.length ? (
					<>
						<text
							x={PADDING.left}
							y={HEIGHT - 6}
							className="fill-[var(--chart-axis)] text-[10px] font-semibold"
						>
							{formatDay(points[0]!.day)}
						</text>
						<text
							x={WIDTH - PADDING.right}
							y={HEIGHT - 6}
							textAnchor="end"
							className="fill-[var(--chart-axis)] text-[10px] font-semibold"
						>
							{formatDay(points.at(-1)!.day)}
						</text>
					</>
				) : null}
			</svg>

			{active ? (
				<div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-2 shadow-[var(--shadow-soft)]">
					<p className="text-[11px] font-bold text-[var(--foreground)]">
						{formatDay(active.day)}
					</p>
					<ul className="mt-1 space-y-0.5">
						{series.map((item) => (
							<li
								key={item.key}
								className="flex items-center gap-2 text-[11px] font-semibold text-[var(--muted-strong)]"
							>
								<span
									aria-hidden
									className="size-2 rounded-sm"
									style={{ backgroundColor: item.color }}
								/>
								{item.label}: {Number(active[item.key] ?? 0).toLocaleString("vi-VN")}
								{valueSuffix}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function formatDay(day: string) {
	const parsed = new Date(`${day}T00:00:00+07:00`);
	if (Number.isNaN(parsed.getTime())) return day;
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(parsed);
}
