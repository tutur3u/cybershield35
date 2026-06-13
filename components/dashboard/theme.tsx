"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "cybershield35:theme";
const preferences: ThemePreference[] = ["system", "light", "dark"];

export function useThemePreference() {
	const preference = useSyncExternalStore<ThemePreference>(
		subscribeThemePreference,
		readStoredPreference,
		() => "system",
	);
	const systemTheme = useSyncExternalStore<ResolvedTheme>(
		subscribeSystemTheme,
		readSystemTheme,
		() => "light",
	);

	const resolvedTheme: ResolvedTheme =
		preference === "system" ? systemTheme : preference;

	useEffect(() => {
		applyTheme(preference, resolvedTheme);
	}, [preference, resolvedTheme]);

	function setPreference(next: ThemePreference) {
		localStorage.setItem(STORAGE_KEY, next);
		applyTheme(next, next === "system" ? systemTheme : next);
		window.dispatchEvent(new Event("cybershield35-theme"));
	}

	function cyclePreference() {
		const currentIndex = preferences.indexOf(preference);
		const next = preferences[(currentIndex + 1) % preferences.length] ?? "system";
		setPreference(next);
	}

	return { preference, resolvedTheme, setPreference, cyclePreference };
}

function subscribeThemePreference(onStoreChange: () => void) {
	window.addEventListener("storage", onStoreChange);
	window.addEventListener("cybershield35-theme", onStoreChange);
	return () => {
		window.removeEventListener("storage", onStoreChange);
		window.removeEventListener("cybershield35-theme", onStoreChange);
	};
}

function subscribeSystemTheme(onStoreChange: () => void) {
	const media = window.matchMedia("(prefers-color-scheme: dark)");
	media.addEventListener("change", onStoreChange);
	return () => media.removeEventListener("change", onStoreChange);
}

export function ThemeToggleButton({
	onCycle,
	preference,
	resolvedTheme,
}: {
	onCycle: () => void;
	preference: ThemePreference;
	resolvedTheme: ResolvedTheme;
}) {
	const Icon = useMemo(() => {
		if (preference === "system") return Laptop;
		return resolvedTheme === "dark" ? Moon : Sun;
	}, [preference, resolvedTheme]);

	return (
		<button
			type="button"
			onClick={onCycle}
			title={`Giao diện: ${themeLabel(preference)}`}
			className="grid size-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)]"
		>
			<Icon size={15} />
		</button>
	);
}

export function ThemeModeDialog({
	onClose,
	onSelect,
	open,
	preference,
	resolvedTheme,
}: {
	onClose: () => void;
	onSelect: (preference: ThemePreference) => void;
	open: boolean;
	preference: ThemePreference;
	resolvedTheme: ResolvedTheme;
}) {
	if (!open) return null;

	return (
		<div className="grid gap-2">
			{preferences.map((option) => (
				<button
					key={option}
					type="button"
					onClick={() => {
						onSelect(option);
						onClose();
					}}
					className={`flex h-11 items-center justify-between rounded-md border px-3 text-left text-[13px] font-bold transition ${
						preference === option
							? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
							: "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
					}`}
				>
					<span>{themeLabel(option)}</span>
					<span className="text-[11px] font-semibold text-[var(--muted)]">
						{option === "system" ? `Đang dùng ${themeLabel(resolvedTheme)}` : ""}
					</span>
				</button>
			))}
		</div>
	);
}

export function themeLabel(value: ThemePreference | ResolvedTheme) {
	switch (value) {
		case "dark":
			return "Tối";
		case "light":
			return "Sáng";
		default:
			return "Theo hệ thống";
	}
}

function readStoredPreference(): ThemePreference {
	if (typeof window === "undefined") return "system";
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "system"
		? stored
		: "system";
}

function readSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme) {
	document.documentElement.dataset.theme = resolvedTheme;
	document.documentElement.dataset.themePreference = preference;
}
