"use client";

import { Clock3, FileClock, Undo2 } from "lucide-react";
import Link from "next/link";

import { DashboardTooltip } from "@/components/dashboard/ui-primitives";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

import { relativeTime, riskLabel, StatusChip } from "./shared";
import type { ArticleEvidenceRow, ArticleVersionRow } from "./types";

export function ArticleContextPanel({
	busy,
	evidence,
	onRestore,
	versions,
}: {
	busy: boolean;
	evidence: ArticleEvidenceRow[];
	onRestore: (versionId: string) => void;
	versions: ArticleVersionRow[];
}) {
	return (
		<Accordion
			type="multiple"
			defaultValue={["evidence", "versions"]}
			className="shadow-[var(--shadow-soft)]"
		>
			<AccordionItem value="evidence">
				<AccordionTrigger>
					<span className="flex min-w-0 items-center gap-2 text-[13px] font-bold">
						<FileClock size={15} className="text-[var(--brand)]" />
						Ngữ cảnh & bằng chứng
						<Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
							{evidence.length}
						</Badge>
					</span>
				</AccordionTrigger>
				<AccordionContent>
					{evidence.length ? (
						<div className="grid gap-2 md:grid-cols-2">
							{evidence.map((item) => (
								<Link
									key={item.id}
									href={`/evidence/${item.id}`}
									className="block rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 transition hover:border-[var(--brand)]"
								>
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-[12px] font-bold text-[var(--foreground)]">
											{item.sourceLabel ?? item.author ?? "Bằng chứng"}
										</p>
										<StatusChip
											label={riskLabel(item.riskLevel)}
											tone={
												item.riskLevel === "high"
													? "danger"
													: item.riskLevel === "medium"
														? "warning"
														: "success"
											}
										/>
									</div>
									<p className="mt-1.5 line-clamp-3 text-[12px] leading-5 text-[var(--muted)]">
										{item.summary}
									</p>
								</Link>
							))}
						</div>
					) : (
						<p className="text-[12px] leading-5 text-[var(--muted)]">
							Chưa gắn bằng chứng. Mở Dòng thời gian và chọn “Soạn bài viết” trên một bài
							để tạo bài viết đã gắn sẵn bằng chứng.
						</p>
					)}
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="versions">
				<AccordionTrigger>
					<span className="flex min-w-0 items-center gap-2 text-[13px] font-bold">
						<Clock3 size={15} className="text-[var(--brand)]" />
						Lịch sử phiên bản
						<Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
							{versions.length}
						</Badge>
					</span>
				</AccordionTrigger>
				<AccordionContent>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{versions.slice(0, 12).map((version) => (
							<div
								key={version.id}
								className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5"
							>
								<div className="min-w-0">
									<p className="text-[12px] font-bold text-[var(--foreground)]">
										Bản {version.version} ·{" "}
										{version.origin === "ai" ? "AI hỗ trợ" : "Thủ công"}
									</p>
									<p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
										{relativeTime(version.createdAt)}
										{version.actorDisplayName ? ` · ${version.actorDisplayName}` : ""}
									</p>
								</div>
								<DashboardTooltip
									content={`Khôi phục bản ${version.version} thành nội dung hiện tại.`}
								>
									<button
										type="button"
										onClick={() => onRestore(version.id)}
										disabled={busy}
										className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] transition hover:border-[var(--brand)] disabled:opacity-50"
										aria-label={`Khôi phục bản ${version.version}`}
									>
										<Undo2 size={14} />
									</button>
								</DashboardTooltip>
							</div>
						))}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
