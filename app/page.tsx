import { Badge } from "@tuturuuu/ui/badge";
import { Button } from "@tuturuuu/ui/button";

export default function Home() {
	return (
		<main className="flex min-h-screen items-center justify-center px-6 py-16">
			<section className="w-full max-w-2xl space-y-8">
				<div className="space-y-4">
					<Badge variant="secondary">Tuturuuu Starter</Badge>
					<h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						Ready for shared Tuturuuu UI.
					</h1>
					<p className="max-w-lg text-base leading-7 text-muted-foreground">
						This page renders package CSS and components through the public
						package imports used by a standalone app.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row">
					<Button asChild>
						<a href="https://tuturuuu.com">Open Tuturuuu</a>
					</Button>
					<Button asChild variant="outline">
						<a href="https://github.com/tutur3u/platform">View Platform</a>
					</Button>
				</div>
			</section>
		</main>
	);
}
