"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Accordion({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return (
		<AccordionPrimitive.Root
			data-slot="accordion"
			className={cn(
				"overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]",
				className,
			)}
			{...props}
		/>
	);
}

function AccordionItem({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn(
				"border-b border-[var(--border)] last:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

function AccordionTrigger({
	children,
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"group flex min-h-12 flex-1 items-center justify-between gap-3 px-4 py-3 text-left text-[12px] font-extrabold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/40",
					className,
				)}
				{...props}
			>
				{children}
				<ChevronDown
					size={15}
					className="shrink-0 text-[var(--muted)] transition-transform duration-200 group-data-[state=open]:rotate-180"
				/>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({
	children,
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			data-slot="accordion-content"
			className="overflow-hidden text-[11px] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
			{...props}
		>
			<div className={cn("border-t border-[var(--border)] p-4", className)}>
				{children}
			</div>
		</AccordionPrimitive.Content>
	);
}

export {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
};
