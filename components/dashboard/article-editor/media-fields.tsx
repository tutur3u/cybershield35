"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { isRenderableImageUrl, SafeImage } from "@/components/dashboard/safe-image";

import { smallButton } from "./shared";

/**
 * One control for both cover and inline images: an upload dropzone while empty, a
 * live thumbnail with replace/remove once set. A URL that fails to load resolves
 * back to the empty state and notifies the owner, so dead media never renders as a
 * broken-image glyph.
 */
export function MediaField({
	articleId,
	compact = false,
	onChange,
	onUnavailable,
	url,
}: {
	articleId: string;
	compact?: boolean;
	onChange: (url: string | null) => void;
	onUnavailable?: () => void;
	url: string | null;
}) {
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");

	async function upload(file: File) {
		setUploading(true);
		setError("");
		try {
			const form = new FormData();
			form.set("file", file, file.name);
			form.set("kind", compact ? "inline" : "cover");
			const response = await fetch(`/api/articles/${articleId}/media`, {
				body: form,
				method: "POST",
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) throw new Error(payload?.error ?? "Không thể tải ảnh lên.");
			onChange(String(payload.previewUrl));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Không thể tải ảnh lên.");
		} finally {
			setUploading(false);
		}
	}

	const picker = (
		<input
			type="file"
			accept="image/*"
			disabled={uploading}
			className="sr-only"
			onChange={(event) => {
				const file = event.target.files?.[0];
				if (file) void upload(file);
				event.target.value = "";
			}}
		/>
	);

	if (isRenderableImageUrl(url)) {
		return (
			<div className="space-y-2">
				<div className="overflow-hidden rounded-lg border border-[var(--border)]">
					<SafeImage
						alt=""
						className={`w-full object-cover ${compact ? "max-h-64" : "aspect-[16/9]"}`}
						fallback={null}
						height={540}
						onUnavailable={onUnavailable}
						src={url}
						width={960}
					/>
				</div>
				<div className="flex flex-wrap gap-2">
					<label className={`${smallButton} cursor-pointer`}>
						{uploading ? (
							<LoaderCircle size={13} className="animate-spin" />
						) : (
							<ImagePlus size={13} />
						)}
						{uploading ? "Đang tải lên…" : "Đổi ảnh"}
						{picker}
					</label>
					<button
						type="button"
						onClick={() => onChange(null)}
						className={`${smallButton} text-[var(--danger-strong)]`}
					>
						<Trash2 size={13} /> Gỡ ảnh
					</button>
				</div>
				{error ? (
					<p className="text-[11px] font-semibold text-[var(--danger-strong)]">{error}</p>
				) : null}
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-4 text-center transition hover:border-[var(--accent)]">
				{uploading ? (
					<LoaderCircle size={18} className="animate-spin text-[var(--accent)]" />
				) : (
					<ImagePlus size={18} className="text-[var(--muted)]" />
				)}
				<span className="text-[12px] font-bold text-[var(--muted-strong)]">
					{uploading ? "Đang tải lên Tuturuuu CMS…" : "Chọn hoặc thả ảnh vào đây"}
				</span>
				<span className="text-[11px] text-[var(--muted)]">PNG, JPG hoặc WebP</span>
				{picker}
			</label>
			{error ? (
				<p className="text-[11px] font-semibold text-[var(--danger-strong)]">{error}</p>
			) : null}
		</div>
	);
}
