import { requireAdminSession, authHeaders } from "@/lib/auth/require-admin";
import { parseCostExchangeRate } from "@/lib/costs/currency";

export async function GET(request: Request) {
	const auth = await requireAdminSession(request);
	if ("error" in auth)
		return Response.json({ error: auth.error }, { status: auth.status });
	try {
		const response = await fetch("https://open.er-api.com/v6/latest/USD", {
			next: { revalidate: 86400 },
			signal: AbortSignal.timeout(8000),
		});
		if (!response.ok) throw new Error("Exchange rate unavailable");
		return Response.json(parseCostExchangeRate(await response.json()), {
			headers: {
				...authHeaders(auth),
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch {
		return Response.json(
			{ error: "Chưa tải được tỷ giá. Chi phí gốc vẫn được lưu bằng USD." },
			{ status: 503, headers: authHeaders(auth) },
		);
	}
}
