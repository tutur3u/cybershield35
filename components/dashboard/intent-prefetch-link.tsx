"use client";

import Link, { useLinkStatus } from "next/link";
import { useState, type ComponentProps } from "react";

type IntentPrefetchLinkProps = ComponentProps<typeof Link>;

export function IntentPrefetchLink({
	children,
	className,
	onFocus,
	onPointerEnter,
	prefetch,
	...props
}: IntentPrefetchLinkProps) {
	const [hasIntent, setHasIntent] = useState(false);

	return (
		<Link
			{...props}
			className={`${className ?? ""} relative`}
			prefetch={prefetch ?? (hasIntent ? true : undefined)}
			onFocus={(event) => {
				setHasIntent(true);
				onFocus?.(event);
			}}
			onPointerEnter={(event) => {
				setHasIntent(true);
				onPointerEnter?.(event);
			}}
		>
			{children}
			<NavigationPending />
		</Link>
	);
}

function NavigationPending() {
	const { pending } = useLinkStatus();
	if (!pending) return null;
	return (
		<span
			role="status"
			aria-label="Đang mở trang"
			className="pointer-events-none absolute inset-0 animate-pulse rounded-[inherit] border-2 border-[var(--accent)] motion-reduce:animate-none"
		>
			<span className="sr-only">Đang mở trang…</span>
		</span>
	);
}
