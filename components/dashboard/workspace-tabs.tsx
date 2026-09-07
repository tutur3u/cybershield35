"use client";

import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

type Item<T extends string> = { id: T; label: string; icon?: LucideIcon };

/** Shared, keyboard-operable tabs for focused workspace sections. */
export function WorkspaceTabs<T extends string>({
	items,
	value,
	onChange,
	label,
	children,
}: {
	items: readonly Item<T>[];
	value: T;
	onChange: (value: T) => void;
	label: string;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<div className="space-y-5">
			<div role="tablist" aria-label={label} className="workspace-tabs">
				{items.map((item, index) => {
					const Icon = item.icon;
					return (
						<button
							key={item.id}
							type="button"
							role="tab"
							id={`${id}-${item.id}`}
							aria-controls={`${id}-panel`}
							aria-selected={value === item.id}
							tabIndex={value === item.id ? 0 : -1}
							onClick={() => onChange(item.id)}
							onKeyDown={(event) => {
								let next: number;
								if (event.key === "ArrowRight")
									next = (index + 1) % items.length;
								else if (event.key === "ArrowLeft")
									next = (index - 1 + items.length) % items.length;
								else if (event.key === "Home") next = 0;
								else if (event.key === "End") next = items.length - 1;
								else return;
								event.preventDefault();
								const target = items[next];
								if (target) {
									onChange(target.id);
									document.getElementById(`${id}-${target.id}`)?.focus();
								}
							}}
						>
							{Icon ? <Icon size={16} aria-hidden="true" /> : null}
							{item.label}
						</button>
					);
				})}
			</div>
			<div
				role="tabpanel"
				id={`${id}-panel`}
				aria-labelledby={`${id}-${value}`}
				tabIndex={0}
				className="min-w-0 space-y-5"
			>
				{children}
			</div>
		</div>
	);
}
