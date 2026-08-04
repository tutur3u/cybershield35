import { getArticleMedia, resolveCmsAsset } from "@/lib/articles/cms-media";
import { requireAdminSession } from "@/lib/auth/require-admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
	const { id, mediaId } = await params;
	const media = await getArticleMedia(id, mediaId);
	if (!media?.cmsAssetId) return Response.json({ error: "Không tìm thấy ảnh." }, { status: 404 });

	// Published CMS assets are intentionally available to Zalo's image fetcher.
	// Draft assets remain private because Tuturuuu refuses anonymous resolution.
	let upstream = await resolveCmsAsset(media.cmsAssetId);
	if (upstream.status < 300 || upstream.status >= 400) {
		const auth = await requireAdminSession(request);
		if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
		upstream = await resolveCmsAsset(media.cmsAssetId, auth.session);
	}
	const location = upstream.headers.get("location");
	if (location && upstream.status >= 300 && upstream.status < 400) return Response.redirect(location, 307);
	return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? media.contentType, "Cache-Control": upstream.ok ? "public, max-age=3600" : "private, no-store" } });
}
