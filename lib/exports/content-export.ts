import "server-only";

import {
	AlignmentType,
	Document,
	Footer,
	HeadingLevel,
	ImageRun,
	Packer,
	PageNumber,
	Paragraph,
	TextRun,
} from "docx";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

import { cleanDraftContent } from "@/lib/domain/draft-content";

export type ExportContent = {
	content: string;
	/** Optional cover art. Fetched here rather than sent by the client so the
	 * export cannot be used to make the server fetch an arbitrary URL. */
	coverUrl?: string | null;
	title: string;
};

type FetchedCover = { dataUrl: string; height: number; width: number };

const COVER_TIMEOUT_MS = 8_000;
const COVER_MAX_BYTES = 6 * 1024 * 1024;
const COVER_WIDTH_PT = 480;
const COVER_ASPECT = 9 / 16;

/**
 * Downloads the cover so the exported document looks like the published article
 * rather than starting abruptly at the headline. A cover that is missing, slow,
 * oversized or not actually an image is skipped: an export is worth more than a
 * perfect cover, and it must never hang on a dead CDN link.
 */
export async function fetchExportCover(
	coverUrl: string | null | undefined,
): Promise<FetchedCover | null> {
	if (!coverUrl) return null;
	let parsed: URL;
	try {
		parsed = new URL(coverUrl);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:") return null;

	try {
		const response = await fetch(parsed, {
			cache: "no-store",
			// Several image CDNs — Wikimedia among them — reject a request with no
			// User-Agent outright, and a referrer is not ours to leak.
			headers: {
				accept: "image/*",
				"user-agent": "CyberShield35-Export/1.0 (+https://cs35.ttr.gg)",
			},
			redirect: "follow",
			referrerPolicy: "no-referrer",
			signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
		});
		if (!response.ok) return null;
		const mediaType = response.headers.get("content-type") ?? "";
		if (!mediaType.startsWith("image/")) return null;

		const buffer = await response.arrayBuffer();
		if (!buffer.byteLength || buffer.byteLength > COVER_MAX_BYTES) return null;

		const base64 = Buffer.from(buffer).toString("base64");
		return {
			dataUrl: `data:${mediaType};base64,${base64}`,
			height: Math.round(COVER_WIDTH_PT * COVER_ASPECT),
			width: COVER_WIDTH_PT,
		};
	} catch {
		return null;
	}
}

export async function createDocxExport(input: ExportContent) {
	const body = contentParagraphs(input.content);
	const cover = await fetchExportCover(input.coverUrl);
	const document = new Document({
		creator: "CyberShield35",
		description: "Nội dung nội bộ được xuất từ CyberShield35.",
		sections: [
			{
				children: [
					...(cover
						? [
								new Paragraph({
									alignment: AlignmentType.CENTER,
									spacing: { after: 240 },
									children: [
										new ImageRun({
											data: cover.dataUrl,
											transformation: {
												height: cover.height,
												width: cover.width,
											},
											type: "png",
										}),
									],
								}),
							]
						: []),
					new Paragraph({
						alignment: AlignmentType.CENTER,
						heading: HeadingLevel.TITLE,
						spacing: { after: 320 },
						children: [new TextRun({ bold: true, text: input.title })],
					}),
					...body.map(
						(text) =>
							new Paragraph({
								alignment: AlignmentType.JUSTIFIED,
								children: [new TextRun(text)],
								spacing: { after: 160, line: 340 },
							}),
					),
				],
				footers: {
					default: new Footer({
						children: [
							new Paragraph({
								alignment: AlignmentType.CENTER,
								children: [
									new TextRun("CyberShield35 · Trang "),
									new TextRun({ children: [PageNumber.CURRENT] }),
								],
							}),
						],
					}),
				},
				properties: {
					page: {
						margin: { bottom: 1080, left: 1080, right: 1080, top: 1080 },
					},
				},
			},
		],
		subject: input.title,
		title: input.title,
	});

	return Packer.toBuffer(document);
}

export async function createPdfExport(input: ExportContent) {
	pdfMake.addVirtualFileSystem(pdfFonts);
	const cover = await fetchExportCover(input.coverUrl);
	const pdf = pdfMake.createPdf({
		content: [
			...(cover
				? [
						{
							image: cover.dataUrl,
							margin: [0, 0, 0, 16] as [number, number, number, number],
							width: cover.width,
						},
					]
				: []),
			{
				alignment: "center",
				bold: true,
				fontSize: 18,
				margin: [0, 0, 0, 18],
				text: input.title,
			},
			...contentParagraphs(input.content).map((text) => ({
				alignment: "justify" as const,
				fontSize: 11,
				lineHeight: 1.45,
				margin: [0, 0, 0, 9] as [number, number, number, number],
				text,
			})),
		],
		defaultStyle: {
			font: "Roboto",
		},
		footer: (currentPage, pageCount) => ({
			alignment: "center",
			color: "#6b7280",
			fontSize: 8,
			text: `CyberShield35 · Trang ${currentPage}/${pageCount}`,
		}),
		info: {
			author: "CyberShield35",
			subject: "Nội dung nội bộ được xuất từ CyberShield35.",
			title: input.title,
		},
		pageMargins: [54, 54, 54, 60],
	});

	return pdf.getBuffer();
}

function contentParagraphs(content: string) {
	return cleanDraftContent(content)
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
}
