import { authHeaders, requireAdminSession, requirePlatformAdminSession } from "@/lib/auth/require-admin";
import { getProviderCostOverview, reconcileApifyCosts, syncProviderCosts } from "@/lib/costs/server";

export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    return Response.json(await getProviderCostOverview(), { headers: { ...authHeaders(auth), "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Không thể tải chi phí. Vui lòng thử lại." }, { status: 503, headers: authHeaders(auth) });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdminSession(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    if (process.env.APIFY_ACCOUNT_DEDICATED_TO_CS35 === "true") {
      const { reconcileApifyAccountHistory } = await import("@/lib/costs/account-history");
      await reconcileApifyAccountHistory([new Date().toISOString().slice(0,10)], true);
    }
    const reconciliation = await reconcileApifyCosts(10);
    const sync = await syncProviderCosts(auth.session.accessToken, auth.session.workspaceId);
    return Response.json({ reconciliation, sync }, { headers: authHeaders(auth) });
  } catch {
    return Response.json({ error: "Chưa hoàn tất đối soát. Dữ liệu đã lưu vẫn được giữ; bạn có thể thử lại." }, { status: 503, headers: authHeaders(auth) });
  }
}
