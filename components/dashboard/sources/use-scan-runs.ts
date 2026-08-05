"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export type ScanRunPhase =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "starting";

export type ScanRun = {
	error?: string;
	evidenceCount: number;
	highRiskCount: number;
	phase: ScanRunPhase;
	scanId: string | null;
	startedAt: number;
};

type ScanStatusResponse = {
	errorMessage: string | null;
	evidenceCount: number;
	highRiskCount: number;
	status: "queued" | "running" | "completed" | "failed" | "retrying";
};

const POLL_INTERVAL_MS = 2_000;

/**
 * Drives the "Quét ngay" experience: enqueue the scan, kick off processing, then
 * poll real job status so operators watch queued → đang quét → hoàn tất instead of
 * an opaque spinner.
 */
export function useScanRuns() {
	const queryClient = useQueryClient();
	const [runs, setRuns] = useState<Record<string, ScanRun>>({});
	const timers = useRef(new Map<string, number>());

	useEffect(() => {
		const pending = timers.current;
		return () => {
			for (const timer of pending.values()) window.clearTimeout(timer);
			pending.clear();
		};
	}, []);

	const patch = useCallback((key: string, next: Partial<ScanRun>) => {
		setRuns((current) => {
			const existing = current[key];
			if (!existing) return current;
			return { ...current, [key]: { ...existing, ...next } };
		});
	}, []);

	const poll = useCallback(
		(key: string, scanId: string) => {
			const tick = async () => {
				try {
					const response = await fetch(`/api/scans/${scanId}/status`, {
						cache: "no-store",
						credentials: "same-origin",
					});
					if (!response.ok) throw new Error("status unavailable");
					const payload = (await response.json()) as ScanStatusResponse;
					const phase: ScanRunPhase =
						payload.status === "completed"
							? "completed"
							: payload.status === "failed"
								? "failed"
								: payload.status === "running"
									? "running"
									: "queued";
					patch(key, {
						error: payload.errorMessage ?? undefined,
						evidenceCount: payload.evidenceCount,
						highRiskCount: payload.highRiskCount,
						phase,
					});
					if (phase === "completed" || phase === "failed") {
						timers.current.delete(key);
						await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
						return;
					}
				} catch {
					// A transient status read failure should not abandon the run; the next
					// tick reports the truth once the API answers again.
				}
				timers.current.set(key, window.setTimeout(tick, POLL_INTERVAL_MS));
			};
			timers.current.set(key, window.setTimeout(tick, 600));
		},
		[patch, queryClient],
	);

	const start = useCallback(
		async (key: string, enqueue: () => Promise<{ scanId: string }>) => {
			setRuns((current) => ({
				...current,
				[key]: {
					evidenceCount: 0,
					highRiskCount: 0,
					phase: "starting",
					scanId: null,
					startedAt: Date.now(),
				},
			}));
			try {
				const { scanId } = await enqueue();
				patch(key, { phase: "queued", scanId });
				poll(key, scanId);
				// Processing runs in its own request so the queued state stays visible
				// while collection and analysis happen.
				void fetch(`/api/scans/${scanId}/run`, {
					credentials: "same-origin",
					method: "POST",
				}).catch(() => undefined);
				return scanId;
			} catch (error) {
				patch(key, {
					error: error instanceof Error ? error.message : "Không thể bắt đầu quét.",
					phase: "failed",
				});
				return null;
			}
		},
		[patch, poll],
	);

	const dismiss = useCallback((key: string) => {
		const timer = timers.current.get(key);
		if (timer) window.clearTimeout(timer);
		timers.current.delete(key);
		setRuns((current) => {
			const next = { ...current };
			delete next[key];
			return next;
		});
	}, []);

	return { dismiss, runs, start };
}
