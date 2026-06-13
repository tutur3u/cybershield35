"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { ClientRuntime, ClientRuntimeKeys } from "@/lib/runtime/client-runtime";

const STORAGE_KEY = "cybershield35:testing-runtime:v1";

const emptyRuntime: ClientRuntime = { keys: {} };
let cachedRuntimeRaw: string | null | undefined;
let cachedRuntimeValue: ClientRuntime = emptyRuntime;

export type ClientRuntimeSummary = {
	googleGenerativeAi: boolean;
	apify: boolean;
	firecrawl: boolean;
	browserUse: boolean;
	any: boolean;
};

export function useClientRuntimeCredentials() {
	const runtime = useSyncExternalStore(
		subscribeRuntimeStorage,
		readStoredRuntime,
		() => emptyRuntime,
	);

	const summary = useMemo(() => summarizeRuntime(runtime), [runtime]);

	function setRuntime(nextRuntime: ClientRuntime) {
		const normalized = normalizeRuntime(nextRuntime);
		if (summaryHasKeys(summarizeRuntime(normalized))) {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
		} else {
			sessionStorage.removeItem(STORAGE_KEY);
		}
		window.dispatchEvent(new Event("cybershield35-runtime"));
	}

	function clearRuntime() {
		sessionStorage.removeItem(STORAGE_KEY);
		window.dispatchEvent(new Event("cybershield35-runtime"));
	}

	return { runtime, summary, setRuntime, clearRuntime };
}

function subscribeRuntimeStorage(onStoreChange: () => void) {
	window.addEventListener("storage", onStoreChange);
	window.addEventListener("cybershield35-runtime", onStoreChange);
	return () => {
		window.removeEventListener("storage", onStoreChange);
		window.removeEventListener("cybershield35-runtime", onStoreChange);
	};
}

export function runtimeForRequest(runtime: ClientRuntime) {
	return summaryHasKeys(summarizeRuntime(runtime)) ? runtime : undefined;
}

export function summarizeRuntime(runtime: ClientRuntime): ClientRuntimeSummary {
	const keys = runtime.keys;
	return {
		googleGenerativeAi: Boolean(keys.googleGenerativeAiApiKey),
		apify: Boolean(keys.apifyToken),
		firecrawl: Boolean(keys.firecrawlApiKey),
		browserUse: Boolean(keys.browserUseApiKey),
		any: Boolean(
			keys.googleGenerativeAiApiKey ||
				keys.apifyToken ||
				keys.firecrawlApiKey ||
				keys.browserUseApiKey,
		),
	};
}

export function summaryHasKeys(summary: ClientRuntimeSummary) {
	return summary.any;
}

function readStoredRuntime(): ClientRuntime {
	if (typeof window === "undefined") return emptyRuntime;
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (raw === cachedRuntimeRaw) return cachedRuntimeValue;
		cachedRuntimeRaw = raw;
		if (!raw) {
			cachedRuntimeValue = emptyRuntime;
			return cachedRuntimeValue;
		}
		const parsed = JSON.parse(raw) as ClientRuntime;
		cachedRuntimeValue = normalizeRuntime(parsed);
		return cachedRuntimeValue;
	} catch {
		cachedRuntimeRaw = null;
		cachedRuntimeValue = emptyRuntime;
		return emptyRuntime;
	}
}

function normalizeRuntime(runtime: ClientRuntime): ClientRuntime {
	return {
		keys: normalizeKeys(runtime.keys ?? {}),
	};
}

function normalizeKeys(keys: ClientRuntimeKeys): ClientRuntimeKeys {
	return {
		googleGenerativeAiApiKey: clean(keys.googleGenerativeAiApiKey),
		googleGenerativeAiModel:
			clean(keys.googleGenerativeAiModel) ??
			(clean(keys.googleGenerativeAiApiKey) ? "gemini-2.5-flash" : undefined),
		apifyToken: clean(keys.apifyToken),
		firecrawlApiKey: clean(keys.firecrawlApiKey),
		browserUseApiKey: clean(keys.browserUseApiKey),
	};
}

function clean(value?: string) {
	const trimmed = value?.trim();
	return trimmed || undefined;
}
