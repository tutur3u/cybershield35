import type { FacebookPageClassification } from "@/lib/domain/facebook-page-policy";

export type EvidenceRiskLevel = "low" | "medium" | "high";

export function assessEvidenceRisk(input: {
	comments?: number;
	shares?: number;
	sourceClassification?: FacebookPageClassification;
	storedRisk?: EvidenceRiskLevel;
	text?: string | null;
}) {
	const comments = finiteCount(input.comments);
	const shares = finiteCount(input.shares);
	const text = normalizeVietnamese(input.text);
	const signals: string[] = [];
	let level: EvidenceRiskLevel = text ? "low" : (input.storedRisk ?? "low");

	const highImpactSignals = matchedLabels(text, HIGH_IMPACT_PATTERNS);
	const routinePositiveSignals = matchedLabels(text, ROUTINE_POSITIVE_PATTERNS);
	const civicImportanceSignals = matchedLabels(text, CIVIC_IMPORTANCE_PATTERNS);

	if (highImpactSignals.length) {
		level = "high";
		signals.push(
			`Có diễn biến cần ưu tiên theo dõi: ${highImpactSignals.slice(0, 3).join(", ")}.`,
		);
	} else if (routinePositiveSignals.length) {
		level = "low";
		signals.push(
			`Nội dung mang tính thông tin hoặc ghi nhận tích cực: ${routinePositiveSignals.slice(0, 3).join(", ")}.`,
		);
	} else if (civicImportanceSignals.length) {
		level = "medium";
		signals.push(
			`Nội dung liên quan vấn đề công cần theo dõi: ${civicImportanceSignals.slice(0, 3).join(", ")}.`,
		);
	}

	if (level === "low" && routinePositiveSignals.length === 0 && (comments > 20 || shares > 5)) {
		level = "medium";
		signals.push("Nội dung đang nhận được nhiều sự chú ý và nên được theo dõi thêm.");
	} else if (level !== "high" && (comments > 100 || shares > 30)) {
		signals.push("Nội dung đang lan truyền mạnh, nhưng mức rủi ro vẫn dựa trên bản chất sự việc.");
	}

	if (input.sourceClassification === "at_risk") {
		signals.push("Nguồn đang được theo dõi sát; mức rủi ro của bài viết vẫn được chấm theo nội dung.");
	}
	if (!signals.length) {
		signals.push("Chưa thấy diễn biến có ảnh hưởng đáng kể trong nội dung hiện có.");
	}

	return {
		level,
		reasons: signals,
	};
}

const HIGH_IMPACT_PATTERNS: Array<[RegExp, string]> = [
	[/\b(bat giu|bat tam giam|tam giu|bi bat|truy na|trieu pha|bat qua tang)\b/u, "bắt giữ hoặc truy bắt"],
	[/\b(khoi to|truy to|xet xu|phat tu|thi hanh an|ket an)\b/u, "khởi tố hoặc xét xử"],
	[/\b(khoi kien|bi kien|vu kien|kien ra toa|to cao)\b/u, "tranh chấp hoặc tố tụng"],
	[/\b(an ninh trat tu|an ninh quoc gia|bao loan|bieu tinh|khung bo|xung dot|bao luc|vu khi|no sung)\b/u, "an ninh và trật tự công cộng"],
	[/\b(tan cong mang|ro ri du lieu|danh sap|ha guc|chiem quyen|ma doc|lua dao)\b/u, "tấn công hoặc xâm hại"],
	[/\b(tham nhung|nhan hoi lo|ky luat|cach chuc|bai nhiem|tu chuc|khung hoang chinh tri)\b/u, "biến động chính trị hoặc sai phạm nghiêm trọng"],
	[/\b(dau da|khac phe|phe phai|dan ap|cuong che|giai tan|chong pha|phan dong|the luc thu dich|cong kich dang|cong kich nha nuoc)\b/u, "xung đột hoặc đối đầu chính trị"],
	[/\b(dang cong san|nguoi cong san|bo may chinh quyen|che do|dot lo)\b/u, "vấn đề chính trị có ảnh hưởng lớn"],
	[/\b(thao do|go bo|danh sap|dong cua|dinh chi|cam hoat dong|thu hoi giay phep)\b/u, "gỡ bỏ, đình chỉ hoặc đóng cửa"],
	[/\b(sai su that|khong dung su that|bia dat|xuyen tac|kich dong|chua kiem chung)\b/u, "thông tin có dấu hiệu sai lệch"],
];

const ROUTINE_POSITIVE_PATTERNS: Array<[RegExp, string]> = [
	[/\b(hoc sinh|sinh vien).{0,36}\b(diem cao|dat diem|hoc gioi|dat giai|thanh tich)\b/u, "thành tích học tập"],
	[/\b(giam hoc phi|mien hoc phi|mien giam hoc phi|giam le phi|mien le phi|ho tro hoc phi)\b/u, "giảm chi phí học tập"],
	[/\b(hoc bong|tuyen duong|vinh danh|khen thuong|khai giang|tot nghiep)\b/u, "giáo dục và ghi nhận tích cực"],
	[/\b(khuyen mai|giam gia|uu dai|lich nghi|thong bao lich)\b/u, "thông tin dịch vụ thường nhật"],
];

const CIVIC_IMPORTANCE_PATTERNS: Array<[RegExp, string]> = [
	[/\b(bo chinh tri|ban chap hanh trung uong|quoc hoi|chinh phu|bo cong an|bo quoc phong)\b/u, "cơ quan trung ương"],
	[/\b(chu tich nuoc|thu tuong|tong bi thu|bo truong|bi thu|chu tich uy ban)\b/u, "lãnh đạo cấp cao"],
	[/\b(nghi quyet|nghi dinh|du luat|chinh sach|bau cu|bo phieu|dieu tra)\b/u, "chính sách hoặc quyết định công"],
	[/\b(cong an|canh sat|quan doi|an ninh|trat tu cong cong)\b/u, "an ninh hoặc lực lượng thực thi"],
];

function matchedLabels(text: string, patterns: Array<[RegExp, string]>) {
	return patterns
		.filter(([pattern]) => pattern.test(text))
		.map(([, label]) => label);
}

function normalizeVietnamese(value?: string | null) {
	return (value ?? "")
		.toLocaleLowerCase("vi")
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/đ/gu, "d")
		.replace(/[^a-z0-9\s]/gu, " ")
		.replace(/\s+/gu, " ")
		.trim();
}

function finiteCount(value?: number) {
	return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 0;
}
