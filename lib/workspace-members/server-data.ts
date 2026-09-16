import "server-only";


import type { WorkspaceMembersResponse } from "@/components/dashboard/types";
import { requestFromCurrentHeaders } from "@/lib/auth/current-request";
import { fetchWorkspaceMembersForRequest } from "@/lib/workspace-members/proxy";

export const emptyWorkspaceMembers: WorkspaceMembersResponse = {
	context: {
		canManageMembers: false,
		canManageRoles: false,
		defaultAdminEnabled: false,
	},
	invitations: [],
	members: [],
};

export async function getWorkspaceMembersInitialData() {
	try {
		return await getCachedWorkspaceMembersInitialData();
	} catch {
		return emptyWorkspaceMembers;
	}
}

async function getCachedWorkspaceMembersInitialData() {

	return fetchWorkspaceMembersForRequest(await requestFromCurrentHeaders());
}
