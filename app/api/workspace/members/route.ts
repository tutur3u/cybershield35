import { proxyWorkspaceMembersRequest } from "@/lib/workspace-members/proxy";

export async function GET(request: Request) {
	return proxyWorkspaceMembersRequest(request, {
		method: "GET",
		path: "",
	});
}
