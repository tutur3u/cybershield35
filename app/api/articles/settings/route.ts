import { authHeaders, requireAdminSession } from "@/lib/auth/require-admin";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	return Response.json(
		{ autoSyncDrafts: false, defaultOa: null, defaultRemoteStatus: "hidden" },
		{ headers: authHeaders(auth) },
	);
}

export async function PATCH(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth) {
		return Response.json({ error: auth.error }, { status: auth.status });
	}
	return Response.json(
		{ error: "Đồng bộ bản nháp tự động đã được gỡ bỏ. Hãy duyệt và xuất bản bài viết trong trình biên tập." },
		{ status: 410, headers: authHeaders(auth) },
	);
}
