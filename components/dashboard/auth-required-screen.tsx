import {
	AlertTriangle,
	CheckCircle2,
	Server,
	ShieldCheck,
	type LucideIcon,
} from "lucide-react";

const authEnvVars = [
	"TUTURUUU_API_BASE_URL",
	"TUTURUUU_CYBERSHIELD35_WORKSPACE_ID",
	"CYBERSHIELD35_APP_ID",
	"CYBERSHIELD35_APP_SECRET",
	"CYBERSHIELD35_SESSION_SECRET",
];

const providerEnvVars = [
	"DATABASE_URL",
	"GOOGLE_GENERATIVE_AI_API_KEY",
	"APIFY_TOKEN",
	"FIRECRAWL_API_KEY",
	"BROWSER_USE_API_KEY",
	"LLM_API_KEY",
];

export function AuthRequiredScreen({
	configured,
	error,
}: {
	configured: boolean;
	error?: string;
}) {
	return (
		<main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6">
			<div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center">
				<section className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
					<div className="flex items-start gap-3">
						<span className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--success-soft)] text-[var(--brand)]">
							<ShieldCheck size={22} />
						</span>
						<div className="min-w-0">
							<h1 className="text-[20px] font-bold leading-7">
								CyberShield 35
							</h1>
							<p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
								Yêu cầu phiên Tuturuuu hợp lệ và cấu hình server-side trước
								khi mở bảng điều khiển.
							</p>
						</div>
					</div>

					<div
						className={`mt-5 flex items-start gap-3 rounded-lg p-4 ${
							configured
								? "bg-[var(--danger-soft)] text-[var(--danger-strong)]"
								: "bg-[var(--warning-soft)] text-[var(--warning-strong)]"
						}`}
					>
						<AlertTriangle size={20} className="mt-0.5 shrink-0" />
						<div className="min-w-0">
							<p className="text-[13px] font-bold">
								{configured
									? "Không có phiên quản trị hợp lệ"
									: "Cấu hình Tuturuuu chưa hoàn tất trên máy chủ"}
							</p>
							<p className="mt-1 text-[12px] leading-5 opacity-85">
								{configured
									? (error ?? "Authentication required")
									: "Kiểm tra biến môi trường, triển khai lại ứng dụng, rồi mở lại trang."}
							</p>
						</div>
					</div>

					<div className="mt-5 grid gap-4 lg:grid-cols-2">
						<SetupCard
							icon={Server}
							title="Tuturuuu Auth"
							description="Trong Vercel, vào Project Settings, Environment Variables, đặt các secret dưới đây cho Production và Preview rồi redeploy."
							items={authEnvVars}
						/>
						<SetupCard
							icon={CheckCircle2}
							title="Runtime Services"
							description="Các provider, LLM và Postgres cũng phải được cấu hình trên server. Không nhập secret trong trình duyệt."
							items={providerEnvVars}
						/>
					</div>

					<div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
						<p className="text-[13px] font-bold text-[var(--foreground)]">
							Local development
						</p>
						<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
							Chỉ trên localhost hoặc loopback, có thể đặt{" "}
							<code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--foreground)]">
								AUTH_LOCAL_BYPASS=true
							</code>{" "}
							khi <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--foreground)]">NODE_ENV</code>{" "}
							không phải production. Production luôn yêu cầu phiên Tuturuuu
							thật.
						</p>
					</div>
				</section>
			</div>
		</main>
	);
}

function SetupCard({
	description,
	icon: Icon,
	items,
	title,
}: {
	description: string;
	icon: LucideIcon;
	items: string[];
	title: string;
}) {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--surface)] text-[var(--brand)]">
					<Icon size={18} />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-bold text-[var(--foreground)]">
						{title}
					</p>
					<p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
						{description}
					</p>
				</div>
			</div>
			<ul className="mt-4 space-y-2">
				{items.map((item) => (
					<li
						key={item}
						className="break-all rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] font-bold text-[var(--muted-strong)]"
					>
						{item}
					</li>
				))}
			</ul>
		</div>
	);
}
