import "server-only";

import { cacheLife } from "next/cache";

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
	"use cache: private";
	cacheLife({ expire: 1800, revalidate: 300, stale: 300 });

	return fetchWorkspaceMembersForRequest(await requestFromCurrentHeaders());
}
