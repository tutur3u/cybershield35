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
	/*
	 * A media id addresses one uploaded file forever — replacing an image creates
	 * a new row rather than rewriting this one — so the answer is immutable and
	 * worth caching hard. It was revalidating hourly, which meant every article
	 * view after an hour paid for a round trip through us to the CMS to be told
	 * nothing had changed.
	 */
	const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";
	const location = upstream.headers.get("location");
	if (location && upstream.status >= 300 && upstream.status < 400) {
		// Deliberately short, and deliberately not permanent: the destination is a
		// signed storage URL that expires, so a long-lived or permanent redirect
		// would outlive its own target and start pointing at a dead link. Caching
		// the *bytes* is what matters, and the image optimiser does that.
		return new Response(null, {
			headers: {
				"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
				Location: location,
			},
			status: 307,
		});
	}
	return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? media.contentType, "Cache-Control": upstream.ok ? IMMUTABLE : "private, no-store" } });
}
