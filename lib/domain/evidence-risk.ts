import type { FacebookPageClassification } from "@/lib/domain/facebook-page-policy";

export type EvidenceRiskLevel = "low" | "medium" | "high";

export type EvidenceRiskCategory =
	| "enforcement"
	| "political"
	| "security"
	| "conflict"
	| "disinformation"
	| "inflammatory"
	| "civic"
	| "engagement"
	| "routine"
	| "unclassified";

export type EvidenceRiskAssessment = {
	categories: EvidenceRiskCategory[];
	level: EvidenceRiskLevel;
	reasons: string[];
	signals: string[];
};

/**
 * Deterministic fallback rubric. The authoritative classifier is the LLM in
 * `lib/llm/risk-classification.ts`; this runs at provider-ingest time (before the
 * rows exist) and whenever no LLM provider is configured or the model call fails,
 * so a scan never lands unscored.
 */
export function assessEvidenceRisk(input: {
	comments?: number;
	shares?: number;
	sourceClassification?: FacebookPageClassification;
	storedRisk?: EvidenceRiskLevel;
	text?: string | null;
}): EvidenceRiskAssessment {
	const comments = finiteCount(input.comments);
	const shares = finiteCount(input.shares);
	const text = normalizeVietnamese(input.text);
	// Obfuscated writing ("N.ướng", "l()n", "c.ô.n.g a.n") survives normalization as
	// stray single letters. Matching the space-free form catches those evasions.
	const compact = text.replace(/\s+/gu, "");
	const hasText = text.length > 0;
	const reasons: string[] = [];
	const categories = new Set<EvidenceRiskCategory>();
	let level: EvidenceRiskLevel = hasText ? "low" : (input.storedRisk ?? "low");

	const match = (group: SignalGroup) => matchedLabels(text, compact, group);
	const enforcement = match(ENFORCEMENT_SIGNALS);
	const political = match(POLITICAL_SIGNALS);
	const security = match(SECURITY_SIGNALS);
	const conflict = match(CONFLICT_SIGNALS);
	const disinformation = match(DISINFORMATION_SIGNALS);
	const inflammatory = match(INFLAMMATORY_SIGNALS);
	const civic = match(CIVIC_SIGNALS);
	const routine = match(ROUTINE_POSITIVE_SIGNALS);
	const severe = [
		["enforcement", enforcement, "Có diễn biến pháp lý hoặc cưỡng chế cần ưu tiên theo dõi"],
		["political", political, "Nội dung chính trị nhạy cảm cần rà soát trước khi phản hồi"],
		["security", security, "Nội dung liên quan an ninh, trật tự hoặc lực lượng vũ trang"],
		["conflict", conflict, "Có xung đột, thương vong hoặc tấn công"],
		["disinformation", disinformation, "Có dấu hiệu thông tin sai lệch hoặc kích động"],
	] as const;
	const matchedSevere = severe.filter(([, labels]) => labels.length);

	if (matchedSevere.length) {
		level = "high";
		for (const [category, labels, headline] of matchedSevere) {
			categories.add(category);
			reasons.push(`${headline}: ${labels.slice(0, 3).join(", ")}.`);
		}
		if (inflammatory.length) {
			categories.add("inflammatory");
			reasons.push(
				`Ngôn từ công kích hoặc xúc phạm đi kèm chủ đề nhạy cảm: ${inflammatory.slice(0, 2).join(", ")}.`,
			);
		}
	} else if (inflammatory.length && civic.length) {
		level = "high";
		categories.add("inflammatory").add("civic");
		reasons.push(
			`Ngôn từ công kích nhắm vào chủ thể công: ${[...inflammatory, ...civic].slice(0, 3).join(", ")}.`,
		);
	} else if (routine.length) {
		level = "low";
		categories.add("routine");
		reasons.push(
			`Nội dung mang tính thông tin hoặc ghi nhận tích cực: ${routine.slice(0, 3).join(", ")}.`,
		);
	} else if (civic.length) {
		level = "medium";
		categories.add("civic");
		reasons.push(
			`Nội dung liên quan vấn đề công cần theo dõi: ${civic.slice(0, 3).join(", ")}.`,
		);
	} else if (inflammatory.length) {
		level = "medium";
		categories.add("inflammatory");
		reasons.push(
			`Ngôn từ công kích hoặc xúc phạm cần kiểm tra ngữ cảnh: ${inflammatory.slice(0, 3).join(", ")}.`,
		);
	}

	if (level === "low" && !routine.length && (comments > 20 || shares > 5)) {
		level = "medium";
		categories.add("engagement");
		reasons.push("Nội dung đang nhận được nhiều sự chú ý và nên được theo dõi thêm.");
	} else if (level !== "high" && (comments > 100 || shares > 30)) {
		categories.add("engagement");
		reasons.push(
			"Nội dung đang lan truyền mạnh, nhưng mức rủi ro vẫn dựa trên bản chất sự việc.",
		);
	}

	if (input.sourceClassification === "at_risk") {
		reasons.push(
			"Nguồn đang được theo dõi sát; mức rủi ro của bài viết vẫn được chấm theo nội dung.",
		);
	}
	if (!reasons.length) {
		categories.add("unclassified");
		reasons.push("Chưa thấy diễn biến có ảnh hưởng đáng kể trong nội dung hiện có.");
	}

	return {
		categories: [...categories],
		level,
		reasons,
		signals: [
			...enforcement,
			...political,
			...security,
			...conflict,
			...disinformation,
			...inflammatory,
			...civic,
		],
	};
}

export const EVIDENCE_RISK_CATEGORY_LABELS: Record<EvidenceRiskCategory, string> = {
	civic: "Chính sách & chủ thể công",
	conflict: "Xung đột & thương vong",
	disinformation: "Thông tin sai lệch",
	enforcement: "Pháp lý & cưỡng chế",
	engagement: "Lan truyền mạnh",
	inflammatory: "Ngôn từ công kích",
	political: "Chính trị nhạy cảm",
	routine: "Thông tin thường nhật",
	security: "An ninh & trật tự",
	unclassified: "Chưa phân loại",
};

/**
 * `patterns` run against the accent-stripped text; `phrases` run against the same
 * text with every space removed so spelling tricks ("Đ.ế Q.uốc M.ỹ") still match.
 */
type SignalGroup = {
	patterns: Array<[RegExp, string]>;
	phrases: Array<[string, string]>;
};

const ENFORCEMENT_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(bat giu|bat tam giam|tam giu|bi bat|truy na|bat qua tang|ap giai)\b/u, "bắt giữ hoặc truy bắt"],
		[/\b(khoi to|truy to|xet xu|phat tu|thi hanh an|ket an|tuyen an)\b/u, "khởi tố hoặc xét xử"],
		[/\b(khoi kien|bi kien|vu kien|kien ra toa|to cao|to giac)\b/u, "tranh chấp hoặc tố tụng"],
		[/\b(tham nhung|nhan hoi lo|dua hoi lo|ky luat|cach chuc|bai nhiem|tu chuc|khai tru)\b/u, "sai phạm hoặc kỷ luật cán bộ"],
		[/\b(thao do|go bo|danh sap|dong cua|dinh chi|cam hoat dong|thu hoi giay phep|phong toa)\b/u, "gỡ bỏ, đình chỉ hoặc đóng cửa"],
		[/\b(cuong che|giai toa|thu hoi dat|dan ap|tran ap)\b/u, "cưỡng chế hoặc trấn áp"],
	],
	phrases: [
		["batgiu", "bắt giữ hoặc truy bắt"],
		["khoito", "khởi tố hoặc xét xử"],
		["thamnhung", "sai phạm hoặc kỷ luật cán bộ"],
	],
};

const POLITICAL_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(dang cong san|cong san|nguoi cong san|dang vien|bo chinh tri|trung uong dang|tong bi thu)\b/u, "đảng và lãnh đạo cấp cao"],
		[/\b(che do|the che|thay doi che do|lat do|nguy quyen|bo may chinh quyen|nha nuoc phap quyen)\b/u, "thể chế và bộ máy chính quyền"],
		[/\b(de quoc|de quoc my|thuc dan|dan toc chu nghia|chu nghia xa hoi|chu nghia tu ban|y thuc he)\b/u, "diễn ngôn ý thức hệ và ngoại bang"],
		[/\b(chong pha|phan dong|the luc thu dich|dien bien hoa binh|lat do chinh quyen|kich dong chinh tri)\b/u, "cáo buộc chống phá hoặc thù địch"],
		[/\b(cong kich dang|cong kich nha nuoc|cong kich chinh quyen|xuc pham lanh tu|bao mon niem tin)\b/u, "công kích chủ thể chính trị"],
		[/\b(dau da|khac phe|phe phai|be phai|thanh trung|dot lo|khung hoang chinh tri)\b/u, "đấu đá và biến động chính trị"],
		[/\b(chu quyen|bien dong|hoang sa|truong sa|duong luoi bo|toan ven lanh tho)\b/u, "chủ quyền và tranh chấp lãnh thổ"],
		[/\b(bau cu|bo phieu|ung cu vien|nhiem ky|quyen luc chinh tri|dan chu|nhan quyen|tu do ngon luan)\b/u, "chính trị bầu cử và quyền công dân"],
		[/\b(chien tranh viet nam|giai phong mien nam|30 thang 4|cai cach ruong dat|thuyen nhan|ty nan chinh tri)\b/u, "lịch sử chính trị gây tranh cãi"],
	],
	phrases: [
		["dequoc", "diễn ngôn ý thức hệ và ngoại bang"],
		["congsan", "đảng và lãnh đạo cấp cao"],
		["phandong", "cáo buộc chống phá hoặc thù địch"],
		["chongpha", "cáo buộc chống phá hoặc thù địch"],
		["latdo", "thể chế và bộ máy chính quyền"],
		["nguyquyen", "thể chế và bộ máy chính quyền"],
		["chuquyen", "chủ quyền và tranh chấp lãnh thổ"],
	],
};

const SECURITY_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(an ninh trat tu|an ninh quoc gia|an ninh chinh tri|trat tu cong cong|an ninh mang)\b/u, "an ninh và trật tự công cộng"],
		[/\b(cong an|canh sat|quan doi|bo doi|bien phong|canh sat co dong|cong an nhan dan)\b/u, "lực lượng thực thi và vũ trang"],
		[/\b(bo cong an|bo quoc phong|quoc phong|tinh bao|phan gian|bao ve chinh tri noi bo)\b/u, "cơ quan an ninh, quốc phòng"],
		[/\b(bao loan|bieu tinh|tu tap dong nguoi|gay roi trat tu|chong nguoi thi hanh cong vu)\b/u, "tụ tập, biểu tình hoặc gây rối"],
		[/\b(khung bo|to chuc phan dong|vu khi|no sung|chat no|buon lau vu khi)\b/u, "khủng bố và vũ khí"],
	],
	phrases: [
		["anninhtratu", "an ninh và trật tự công cộng"],
		["anninhquocgia", "an ninh và trật tự công cộng"],
		["congan", "lực lượng thực thi và vũ trang"],
		["quandoi", "lực lượng thực thi và vũ trang"],
		["bieutinh", "tụ tập, biểu tình hoặc gây rối"],
		["khungbo", "khủng bố và vũ khí"],
	],
};

const CONFLICT_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(thiet mang|tu vong|chet nguoi|thuong vong|thiet hai nhan mang|nan nhan thiet mang)\b/u, "thương vong"],
		[/\b(chien tranh|quan su|drone|ten lua|khong kich|danh bom|oanh tac|phao kich|xung dot vu trang)\b/u, "xung đột quân sự"],
		[/\b(bao luc|hanh hung|danh nguoi|giet nguoi|tham sat|thanh trung sac toc)\b/u, "bạo lực"],
		[/\b(tan cong mang|ro ri du lieu|danh cap du lieu|chiem quyen|ma doc|lua dao|chiem doat tai san)\b/u, "tấn công mạng hoặc lừa đảo"],
		[/\bn?uong \d+ (trieu|nghin|ngan|van) nguoi\b/u, "quy kết tổn thất sinh mạng quy mô lớn"],
	],
	phrases: [
		["thietmang", "thương vong"],
		["chientranh", "xung đột quân sự"],
		["tancongmang", "tấn công mạng hoặc lừa đảo"],
	],
};

const DISINFORMATION_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(sai su that|khong dung su that|bia dat|xuyen tac|kich dong|chua kiem chung|tin gia|fake news)\b/u, "thông tin có dấu hiệu sai lệch"],
		[/\b(bop meo|dan dat du luan|tuyen truyen sai|thong tin doc hai|goi lai qua khu)\b/u, "dẫn dắt dư luận"],
	],
	phrases: [
		["xuyentac", "thông tin có dấu hiệu sai lệch"],
		["biadat", "thông tin có dấu hiệu sai lệch"],
		["kichdong", "thông tin có dấu hiệu sai lệch"],
	],
};

const INFLAMMATORY_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(do ngu|dm|dcm|vcl|vl|clgt|nguu|suc vat|cho chet|mat day|khon nan|ba lang nhang)\b/u, "ngôn từ thô tục"],
		[/\b(lu |bon |dam )(?:chung|no|nguoi)\b/u, "miệt thị nhóm người"],
		[/\b(cai gi cung noi duoc|noi lao|ba hoa|xao tra|lua bip)\b/u, "cáo buộc dối trá"],
	],
	phrases: [
		["cailon", "ngôn từ thô tục"],
		["cailn", "ngôn từ thô tục"],
		["ditme", "ngôn từ thô tục"],
		["dmm", "ngôn từ thô tục"],
	],
};

const CIVIC_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(ban chap hanh trung uong|quoc hoi|chinh phu|uy ban nhan dan|hoi dong nhan dan)\b/u, "cơ quan trung ương và địa phương"],
		[/\b(chu tich nuoc|thu tuong|bo truong|bi thu|chu tich uy ban|pho thu tuong)\b/u, "lãnh đạo cấp cao"],
		[/\b(nghi quyet|nghi dinh|du luat|thong tu|chinh sach|dieu tra|quy hoach|sap nhap tinh)\b/u, "chính sách hoặc quyết định công"],
	],
	phrases: [["quochoi", "cơ quan trung ương và địa phương"]],
};

const ROUTINE_POSITIVE_SIGNALS: SignalGroup = {
	patterns: [
		[/\b(hoc sinh|sinh vien).{0,36}\b(diem cao|dat diem|hoc gioi|dat giai|thanh tich)\b/u, "thành tích học tập"],
		[/\b(giam hoc phi|mien hoc phi|mien giam hoc phi|giam le phi|mien le phi|ho tro hoc phi)\b/u, "giảm chi phí học tập"],
		[/\b(hoc bong|tuyen duong|vinh danh|khen thuong|khai giang|tot nghiep)\b/u, "giáo dục và ghi nhận tích cực"],
		[/\b(khuyen mai|giam gia|uu dai|lich nghi|thong bao lich)\b/u, "thông tin dịch vụ thường nhật"],
		[/\b(gia vang|bang gia|mua \d+ tang \d+|khai truong|tuyen dung|dat lich|giao hang|thuc don)\b/u, "hoạt động kinh doanh thường nhật"],
		[/\b(thoi tiet|lich thi dau|ket qua tran dau|su kien cong dong|thien nguyen|hien mau|quyen gop)\b/u, "sinh hoạt cộng đồng"],
	],
	phrases: [],
};

function matchedLabels(text: string, compact: string, group: SignalGroup) {
	const labels = new Set<string>();
	for (const [pattern, label] of group.patterns) {
		if (pattern.test(text)) labels.add(label);
	}
	for (const [phrase, label] of group.phrases) {
		if (compact.includes(phrase)) labels.add(label);
	}
	return [...labels];
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
