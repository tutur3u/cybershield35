"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type IntentPrefetchLinkProps = ComponentProps<typeof Link>;

export function IntentPrefetchLink({
	onFocus,
	onPointerEnter,
	prefetch,
	...props
}: IntentPrefetchLinkProps) {
	const [hasIntent, setHasIntent] = useState(false);

	return (
		<Link
			{...props}
			prefetch={prefetch ?? (hasIntent ? true : undefined)}
			onFocus={(event) => {
				setHasIntent(true);
				onFocus?.(event);
			}}
			onPointerEnter={(event) => {
				setHasIntent(true);
				onPointerEnter?.(event);
			}}
		/>
	);
}
