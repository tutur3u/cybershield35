"use client";

import { Dialog } from "@/components/dashboard/dialog-frame";
import { ProfileSettingsPanel } from "@/components/dashboard/profile-settings-panel";
import type {
	AdminSessionView,
	AuthViewState,
} from "@/components/dashboard/types";

export function ProfileSettingsPanelDialog({
	auth,
	onClose,
	onProfileUpdated,
}: {
	auth: AuthViewState;
	onClose: () => void;
	onProfileUpdated: (session: AdminSessionView) => void;
}) {
	return (
		<Dialog
			open
			onClose={onClose}
			title="Hồ sơ tài khoản"
			description="Tên hiển thị và ảnh đại diện cho phiên đang đăng nhập."
			size="wide"
		>
			<ProfileSettingsPanel
				auth={auth}
				embedded
				onProfileUpdated={onProfileUpdated}
			/>
		</Dialog>
	);
}
