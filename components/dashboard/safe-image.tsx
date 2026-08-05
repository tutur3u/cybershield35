"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Remote media disappears constantly (expired Facebook CDN links, deleted CMS
 * uploads). Rendering those as a broken-image glyph makes the whole workspace
 * look broken, so every surface goes through this component: it verifies the URL
 * shape up front, swaps in a real placeholder on load failure, and can tell the
 * owner to drop the dead reference for good.
 */
export function isRenderableImageUrl(
	value: string | null | undefined,
): value is string {
	if (!value) return false;
	if (value.startsWith("data:image/")) return true;
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

export function SafeImage({
	alt,
	className = "",
	fallback = null,
	height,
	onUnavailable,
	priority = false,
	sizes,
	src,
	width,
}: {
	alt: string;
	className?: string;
	fallback?: ReactNode;
	height: number;
	onUnavailable?: () => void;
	priority?: boolean;
	sizes?: string;
	src: string | null | undefined;
	width: number;
}) {
	// Tracking which URL failed (rather than a boolean) resets the state whenever
	// `src` changes, without an effect that would trigger a cascading render.
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const reportedRef = useRef<string | null>(null);
	const renderable = isRenderableImageUrl(src);
	const broken = Boolean(src) && failedSrc === src;

	useEffect(() => {
		if (!onUnavailable) return;
		const dead = src && (!renderable || broken) ? src : null;
		if (!dead || reportedRef.current === dead) return;
		reportedRef.current = dead;
		onUnavailable();
	}, [broken, onUnavailable, renderable, src]);

	if (!renderable || broken) return <>{fallback}</>;

	return (
		<Image
			unoptimized
			alt={alt}
			className={className}
			height={height}
			loading={priority ? "eager" : "lazy"}
			onError={() => setFailedSrc(src)}
			sizes={sizes}
			src={src}
			width={width}
		/>
	);
}

export function ImagePlaceholder({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={`grid place-items-center rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] ${className}`}
		>
			{children}
		</span>
	);
}
