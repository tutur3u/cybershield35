"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export function TuturuuuLoginLink({ href }: { href: string }) {
	const [pending, setPending] = useState(false);

	return (
		<a
			aria-busy={pending}
			href={href}
			onClick={(event) => {
				event.preventDefault();
				setPending(true);
				window.requestAnimationFrame(() => {
					window.location.assign(href);
				});
			}}
			className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm transition hover:brightness-110"
		>
			{pending ? (
				<Loader2 size={16} className="animate-spin" />
			) : (
				<span className="grid size-6 shrink-0 place-items-center rounded bg-white">
					<Image
						src="/brand-icons/tuturuuu.svg"
						alt=""
						width={16}
						height={16}
						aria-hidden="true"
						unoptimized
					/>
				</span>
			)}
			{pending ? "Đang chuyển tiếp..." : "Tiếp tục với Tuturuuu"}
		</a>
	);
}
