"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";

import { Dialog } from "@/components/dashboard/dialog-frame";
import {
	FieldLabel,
	PrimaryButton,
	SecondaryButton,
} from "@/components/dashboard/ui-primitives";
import type { ClientRuntime } from "@/lib/runtime/client-runtime";

type FormState = {
	googleGenerativeAiApiKey: string;
	googleGenerativeAiModel: string;
	apifyToken: string;
	firecrawlApiKey: string;
	browserUseApiKey: string;
};

const emptyForm: FormState = {
	googleGenerativeAiApiKey: "",
	googleGenerativeAiModel: "gemini-2.5-flash",
	apifyToken: "",
	firecrawlApiKey: "",
	browserUseApiKey: "",
};

export function TestingKeysDialog({
	onClear,
	onClose,
	onSave,
	open,
	runtime,
}: {
	onClear: () => void;
	onClose: () => void;
	onSave: (runtime: ClientRuntime) => void;
	open: boolean;
	runtime: ClientRuntime;
}) {
	const [form, setForm] = useState<FormState>(() => formFromRuntime(runtime));

	function save() {
		onSave({
			keys: {
				googleGenerativeAiApiKey: clean(form.googleGenerativeAiApiKey),
				googleGenerativeAiModel:
					clean(form.googleGenerativeAiModel) ?? "gemini-2.5-flash",
				apifyToken: clean(form.apifyToken),
				firecrawlApiKey: clean(form.firecrawlApiKey),
				browserUseApiKey: clean(form.browserUseApiKey),
			},
		});
		onClose();
	}

	function clear() {
		setForm(emptyForm);
		onClear();
		onClose();
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Khóa kiểm thử trên trình duyệt"
			description="Khóa chỉ lưu trong sessionStorage của trình duyệt này. Server env key luôn được ưu tiên và khóa này không được ghi vào database."
			size="wide"
		>
			<div className="grid gap-4 md:grid-cols-2">
				<SecretField
					label="Google AI API key"
					value={form.googleGenerativeAiApiKey}
					placeholder="AIza..."
					onChange={(value) =>
						setForm((current) => ({
							...current,
							googleGenerativeAiApiKey: value,
						}))
					}
				/>
				<TextField
					label="Google AI model"
					value={form.googleGenerativeAiModel}
					placeholder="gemini-2.5-flash"
					onChange={(value) =>
						setForm((current) => ({
							...current,
							googleGenerativeAiModel: value,
						}))
					}
				/>
				<SecretField
					label="Apify token"
					value={form.apifyToken}
					placeholder="apify_api_..."
					onChange={(value) =>
						setForm((current) => ({ ...current, apifyToken: value }))
					}
				/>
				<SecretField
					label="Firecrawl API key"
					value={form.firecrawlApiKey}
					placeholder="fc-..."
					onChange={(value) =>
						setForm((current) => ({ ...current, firecrawlApiKey: value }))
					}
				/>
				<SecretField
					label="Browser Use API key"
					value={form.browserUseApiKey}
					placeholder="bu_..."
					onChange={(value) =>
						setForm((current) => ({ ...current, browserUseApiKey: value }))
					}
				/>
				<div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-[12px] leading-5 text-[var(--muted-strong)]">
					<p className="font-bold text-[var(--foreground)]">Luồng ưu tiên</p>
					<p className="mt-1">
						Server key được ưu tiên; browser-session key chỉ dùng khi server chưa
						cấu hình khóa tương ứng.
					</p>
				</div>
			</div>
			<div className="mt-5 flex flex-wrap justify-between gap-2">
				<SecondaryButton onClick={clear}>
					<Trash2 size={14} /> Xóa khỏi session
				</SecondaryButton>
				<PrimaryButton onClick={save}>
					<KeyRound size={15} /> Lưu khóa kiểm thử
				</PrimaryButton>
			</div>
		</Dialog>
	);
}

function SecretField({
	label,
	onChange,
	placeholder,
	value,
}: {
	label: string;
	onChange: (value: string) => void;
	placeholder: string;
	value: string;
}) {
	return (
		<label className="block">
			<FieldLabel>{label}</FieldLabel>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				type="password"
				className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
			/>
		</label>
	);
}

function TextField({
	label,
	onChange,
	placeholder,
	value,
}: {
	label: string;
	onChange: (value: string) => void;
	placeholder: string;
	value: string;
}) {
	return (
		<label className="block">
			<FieldLabel>{label}</FieldLabel>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				className="mt-2 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
			/>
		</label>
	);
}

function clean(value: string) {
	const trimmed = value.trim();
	return trimmed || undefined;
}

function formFromRuntime(runtime: ClientRuntime): FormState {
	return {
		googleGenerativeAiApiKey: runtime.keys.googleGenerativeAiApiKey ?? "",
		googleGenerativeAiModel:
			runtime.keys.googleGenerativeAiModel ?? "gemini-2.5-flash",
		apifyToken: runtime.keys.apifyToken ?? "",
		firecrawlApiKey: runtime.keys.firecrawlApiKey ?? "",
		browserUseApiKey: runtime.keys.browserUseApiKey ?? "",
	};
}
