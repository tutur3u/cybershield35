"use client";

import { useEffect, useState } from "react";

/**
 * The day the reader is currently looking at.
 *
 * The date used to be a sticky header per group, pinned at a hard-coded offset
 * below the toolbar. Two things pinned to the same strip of screen is one too
 * many: the offset drifted whenever the toolbar changed height, and even when
 * correct it left a translucent bar hovering over the card beneath it.
 *
 * Reading the position instead lets the toolbar — which is already pinned —
 * carry the date, so there is one fixed element on the page rather than two
 * negotiating for the same space.
 */
export function useVisibleDay(enabled: boolean) {
	const [label, setLabel] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled) {
			// Deferred rather than set here: a synchronous setState inside an effect
			// makes React render twice for one commit.
			const clear = requestAnimationFrame(() => setLabel(null));
			return () => cancelAnimationFrame(clear);
		}

		const read = () => {
			const markers = document.querySelectorAll<HTMLElement>("[data-day-label]");
			let current: string | null = null;
			for (const marker of markers) {
				// The last separator that has passed the top of the viewport is the
				// day whose posts fill the screen right now.
				if (marker.getBoundingClientRect().top > 140) break;
				current = marker.dataset.dayLabel ?? null;
			}
			setLabel(current);
		};

		const first = requestAnimationFrame(read);
		window.addEventListener("scroll", read, { passive: true });
		window.addEventListener("resize", read, { passive: true });
		return () => {
			cancelAnimationFrame(first);
			window.removeEventListener("scroll", read);
			window.removeEventListener("resize", read);
		};
	}, [enabled]);

	return label;
}
