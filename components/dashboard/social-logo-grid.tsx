"use client";

import Image from "next/image";

import { socialSources } from "@/components/dashboard/dashboard-data";

export function SocialLogoGrid({ compact = false }: { compact?: boolean }) {
	return (
		<div
			className={
				compact
					? "grid grid-cols-2 gap-2 sm:grid-cols-3"
					: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
			}
		>
			{socialSources.map((source) => (
				<div
					key={source.value}
					className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-white p-3"
				>
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
						<span className="block truncate text-[13px] font-bold text-slate-800">
							{source.label}
						</span>
						{compact ? null : (
							<span className="block truncate text-[11px] text-slate-500">
								{source.coverage}
							</span>
						)}
					</span>
				</div>
			))}
		</div>
	);
}
