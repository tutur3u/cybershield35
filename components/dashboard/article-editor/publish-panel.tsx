"use client";

import { ExternalLink } from "lucide-react";

import { ExportActions } from "@/components/dashboard/export-actions";

import { Section, articlePlainText } from "./shared";
import type { PublishRailProps } from "./publish-rail";
import { PublishSections } from "./publish-rail";

/**
 * Everything that takes the article out of CS35: onto the Zalo Official Account,
 * or down to a file. These used to sit in the right-hand rail beside the writing
 * surface, where shipping competed for attention with drafting.
 */
export function PublishPanel(props: PublishRailProps) {
	return (
		<div className="min-w-0 space-y-4">
			<PublishSections {...props} />

			<Section
				description="Bản Word và PDF gồm cả ảnh bìa; bản âm thanh là giọng đọc tiếng Việt."
				icon={ExternalLink}
				title="Xuất & tải xuống"
			>
				<ExportActions
					content={articlePlainText(props.draft)}
					coverUrl={props.draft.coverUrl}
					fileName={props.draft.title || "bai-viet-cybershield35"}
					title={props.draft.title || "Bài viết CyberShield35"}
				/>
			</Section>
		</div>
	);
}
