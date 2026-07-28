const INLINE_CITATION_MARKER =
	/(?:\s|\u00a0)*(?:\[(?:\d+(?:\s*[,–-]\s*\d+)*)\]|【\s*\d+(?:\s*[,–-]\s*\d+)*\s*】)/gu;

export function cleanDraftContent(content: string) {
	return content
		.replace(/\r\n?/gu, "\n")
		.replace(INLINE_CITATION_MARKER, "")
		.replace(/[ \t]+([,.;:!?])/gu, "$1")
		.replace(/[ \t]{2,}/gu, " ")
		.replace(/\n[ \t]+/gu, "\n")
		.replace(/\n{3,}/gu, "\n\n")
		.trim();
}

