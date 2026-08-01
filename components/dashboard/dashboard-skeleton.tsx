const navSkeletonRows = Array.from({ length: 8 }, (_, index) => index);
const metricSkeletonRows = Array.from({ length: 4 }, (_, index) => index);
const listSkeletonRows = Array.from({ length: 5 }, (_, index) => index);

export function DashboardAppSkeleton() {
	return (
		<main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
			<div className="min-h-screen lg:pl-[248px]">
				<aside className="z-30 border-b border-[var(--border)] bg-[var(--surface)] lg:fixed lg:inset-y-0 lg:left-0 lg:w-[248px] lg:border-r lg:border-b-0">
					<div className="flex h-16 items-center border-b border-[var(--border)] px-4">
						<div className="h-6 w-36 rounded-md bg-[var(--surface-soft)]" />
					</div>
					<nav className="space-y-2 px-3 py-4">
						{navSkeletonRows.map((row) => (
							<div
								key={row}
								className="h-10 rounded-md bg-[var(--surface-soft)]"
							/>
						))}
					</nav>
				</aside>
				<section className="min-w-0">
					<div className="sticky top-0 z-20 flex min-h-16 items-center justify-end gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
						<div className="h-7 w-40 rounded-md bg-[var(--surface-soft)]" />
						<div className="size-9 rounded-md bg-[var(--surface-soft)]" />
						<div className="h-9 w-44 rounded-md bg-[var(--surface-soft)]" />
					</div>
					<div className="animate-pulse px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
						<DashboardPageSkeleton />
					</div>
				</section>
			</div>
		</main>
	);
}

export function DashboardPageSkeleton({
	description,
	title,
}: {
	description?: string;
	title?: string;
} = {}) {
	return (
		<div
			aria-busy="true"
			aria-label="Đang tải bảng điều khiển"
			className="animate-pulse space-y-5"
		>
			<div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-start gap-3">
					<div className="size-11 shrink-0 rounded-md bg-[var(--surface-soft)]" />
					<div className="min-w-0 space-y-2">
						{title ? (
							<h1 className="text-[20px] font-bold leading-7 text-[var(--foreground)]">
								{title}
							</h1>
						) : (
							<div className="h-6 w-48 max-w-full rounded-md bg-[var(--surface-soft)]" />
						)}
						{description ? (
							<p className="max-w-3xl text-[12px] leading-5 text-[var(--muted)]">
								{description}
							</p>
						) : (
							<div className="h-4 w-[min(520px,72vw)] rounded-md bg-[var(--surface-soft)]" />
						)}
					</div>
				</div>
				<div className="flex gap-2">
					<div className="h-10 w-28 rounded-md bg-[var(--surface-soft)]" />
					<div className="h-10 w-28 rounded-md bg-[var(--surface-soft)]" />
				</div>
			</div>
			<div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{metricSkeletonRows.map((row) => (
					<div
						key={row}
						className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]"
					>
						<div className="h-8 w-16 rounded-md bg-[var(--surface-soft)]" />
						<div className="mt-3 h-4 w-24 rounded-md bg-[var(--surface-soft)]" />
					</div>
				))}
			</div>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<SkeletonPanel />
				<SkeletonPanel />
				<SkeletonPanel className="xl:col-span-2" />
			</div>
		</div>
	);
}

export function AnalysisPageSkeleton() {
	return (
		<div
			aria-busy="true"
			aria-label="Đang chuẩn bị dữ liệu phân tích gần nhất"
			className="animate-pulse space-y-5"
		>
			<div className="flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-start gap-3">
					<div className="size-11 shrink-0 rounded-md bg-[var(--accent-soft)]" />
					<div className="min-w-0">
						<h1 className="text-[20px] font-bold leading-7 text-[var(--foreground)]">
							Phân tích thảo luận
						</h1>
						<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
							Đang chuẩn bị chủ đề, lập trường và các bằng chứng mới nhất…
						</p>
					</div>
				</div>
				<div className="h-10 w-32 rounded-md bg-[var(--surface-soft)]" />
			</div>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<div className="space-y-5">
					<SkeletonPanel lines={7} />
					<SkeletonPanel lines={4} />
				</div>
				<div className="space-y-5">
					<section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
						<div className="h-5 w-40 rounded-md bg-[var(--surface-soft)]" />
						<div className="mt-5 grid gap-5 sm:grid-cols-[132px_1fr] sm:items-center">
							<div className="mx-auto size-28 rounded-full border-[18px] border-[var(--surface-soft)]" />
							<div className="space-y-4">
								{metricSkeletonRows.slice(0, 3).map((row) => (
									<div key={row} className="h-4 rounded-md bg-[var(--surface-soft)]" />
								))}
							</div>
						</div>
					</section>
					<SkeletonPanel lines={3} />
				</div>
				<SkeletonPanel className="xl:col-span-2" lines={4} />
			</div>
		</div>
	);
}

function SkeletonPanel({
	className = "",
	lines = listSkeletonRows.length,
}: {
	className?: string;
	lines?: number;
}) {
	return (
		<section
			className={`min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] ${className}`}
		>
			<div className="border-b border-[var(--border)] px-4 py-3">
				<div className="h-5 w-36 rounded-md bg-[var(--surface-soft)]" />
				<div className="mt-2 h-4 w-64 max-w-full rounded-md bg-[var(--surface-soft)]" />
			</div>
			<div className="divide-y divide-[var(--divider)]">
				{listSkeletonRows.slice(0, lines).map((row) => (
					<div key={row} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_96px_96px]">
						<div className="min-w-0 space-y-2">
							<div className="h-4 w-56 max-w-full rounded-md bg-[var(--surface-soft)]" />
							<div className="h-3 w-40 max-w-full rounded-md bg-[var(--surface-soft)]" />
						</div>
						<div className="h-6 w-20 rounded-md bg-[var(--surface-soft)]" />
						<div className="h-6 w-20 rounded-md bg-[var(--surface-soft)]" />
					</div>
				))}
			</div>
		</section>
	);
}
