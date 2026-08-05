/**
 * Mirrors the editor's real layout — header, stepper, tab bar, form sections and
 * the preview rail — so the page does not visibly jump when content arrives.
 */
export function ArticleEditorSkeleton() {
	return (
		<div className="space-y-4" aria-busy="true" aria-live="polite">
			<span className="sr-only">Đang mở bài viết…</span>

			<header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
				<div className="flex flex-wrap items-center gap-3 px-3 py-3">
					<Block className="size-10 rounded-lg" />
					<div className="min-w-[12rem] flex-1 space-y-2">
						<Block className="h-4 w-2/3 max-w-sm" />
						<Block className="h-3 w-40" />
					</div>
					<div className="flex gap-2">
						<Block className="h-10 w-20 rounded-lg" />
						<Block className="h-10 w-28 rounded-lg" />
						<Block className="h-10 w-40 rounded-lg" />
					</div>
				</div>
				<div className="flex gap-2 border-t border-[var(--border)] px-3 py-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<Block className="h-7 w-32 rounded-md" key={index} />
					))}
				</div>
			</header>

			<div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]">
				<div className="min-w-0 space-y-4">
					<div className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
						{Array.from({ length: 3 }).map((_, index) => (
							<Block className="h-9 flex-1 rounded-md" key={index} />
						))}
					</div>

					<SkeletonSection>
						<Block className="h-3 w-24" />
						<Block className="h-12 w-full rounded-lg" />
						<div className="grid gap-4 sm:grid-cols-2">
							<Block className="h-11 w-full rounded-lg" />
							<Block className="h-11 w-full rounded-lg" />
						</div>
						<Block className="h-3 w-24" />
						<Block className="h-20 w-full rounded-lg" />
						<Block className="aspect-[16/9] w-full rounded-lg" />
					</SkeletonSection>

					<SkeletonSection>
						<Block className="h-3 w-20" />
						<Block className="h-40 w-full rounded-xl" />
						<Block className="h-40 w-full rounded-xl" />
					</SkeletonSection>
				</div>

				<aside className="min-w-0 space-y-4">
					<SkeletonSection>
						<Block className="aspect-[16/9] w-full rounded-lg" />
						<Block className="h-4 w-3/4" />
						<Block className="h-3 w-full" />
						<Block className="h-3 w-5/6" />
					</SkeletonSection>
					<SkeletonSection>
						<Block className="h-3 w-32" />
						<Block className="h-24 w-full rounded-lg" />
						<Block className="h-10 w-full rounded-lg" />
					</SkeletonSection>
				</aside>
			</div>
		</div>
	);
}

function SkeletonSection({ children }: { children: React.ReactNode }) {
	return (
		<section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
			<div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
				<Block className="size-4 rounded" />
				<Block className="h-3.5 w-40" />
			</div>
			<div className="space-y-3 p-4">{children}</div>
		</section>
	);
}

function Block({ className = "" }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={`block animate-pulse rounded bg-[var(--neutral-soft)] ${className}`}
		/>
	);
}
