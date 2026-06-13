"use client";

import Image from "next/image";

import { socialSources } from "@/components/dashboard/dashboard-data";

export function SocialLogoGrid({ compact = false }: { compact?: boolean }) {
	return (
		<div
			className={
				compact
					? "grid gap-2 sm:grid-cols-2"
					: "grid gap-3 sm:grid-cols-2"
			}
		>
			{socialSources.map((source) => (
				<div
					key={source.value}
					className={
						compact
							? "flex min-h-20 min-w-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
							: "flex min-h-28 min-w-0 flex-col justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
					}
				>
					<div className="flex min-w-0 items-center gap-3">
						<span className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-50">
							{source.iconSrc ? (
								<Image
									src={source.iconSrc}
									alt={`${source.label} logo`}
									width={22}
									height={22}
									unoptimized
								/>
							) : (
								<span
									className="size-3 rounded-full"
									style={{ backgroundColor: source.accent }}
								/>
							)}
						</span>
						<span className="min-w-0">
							<span className="block truncate text-[13px] font-bold text-[var(--foreground)]">
								{source.label}
							</span>
							{compact ? null : (
								<span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">
									{source.coverage}
								</span>
							)}
						</span>
					</div>
					{compact ? null : (
						<div className="grid w-full gap-2 text-[11px] font-semibold text-[var(--muted)] sm:grid-cols-2">
							<span className="rounded-md bg-[var(--success-soft)] px-2 py-1.5 text-center text-[var(--success-strong)]">
								Đang bật
							</span>
							<span className="rounded-md bg-[var(--surface-soft)] px-2 py-1.5 text-center">
								{source.value === "facebook" ? "Apify" : "Firecrawl"}
							</span>
						</div>
					)}
				</div>
			))}
		</div>
	);
}
