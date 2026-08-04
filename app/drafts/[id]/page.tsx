
import { permanentRedirect } from "next/navigation";

import { findArticleIdByOriginDraftId } from "@/lib/articles/store";

export const instant = true;
export const prefetch = "allow-runtime";

export default function DraftDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ scanId?: string }>;
}) {
	return redirectDraftDetail(params, searchParams);
}

async function redirectDraftDetail(
	params: Promise<{ id: string }>,
	searchParams: Promise<{ scanId?: string }>,
) {
	const [{ id }, query] = await Promise.all([params, searchParams]);
	const articleId = await findArticleIdByOriginDraftId(id);
	const suffix = query.scanId ? `?scanId=${encodeURIComponent(query.scanId)}` : "";
	permanentRedirect(articleId ? `/articles/${articleId}${suffix}` : `/articles${suffix}`);
}
