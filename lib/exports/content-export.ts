import "server-only";

import {
	AlignmentType,
	Document,
	Footer,
	HeadingLevel,
	Packer,
	PageNumber,
	Paragraph,
	TextRun,
} from "docx";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

export type ExportContent = {
	content: string;
	title: string;
};

export async function createDocxExport(input: ExportContent) {
	const body = contentParagraphs(input.content);
	const document = new Document({
		creator: "CyberShield35",
		description: "Nội dung nội bộ được xuất từ CyberShield35.",
		sections: [
			{
				children: [
					new Paragraph({
						alignment: AlignmentType.CENTER,
						heading: HeadingLevel.TITLE,
						spacing: { after: 320 },
						children: [new TextRun({ bold: true, text: input.title })],
					}),
					...body.map(
						(text) =>
							new Paragraph({
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
	const pdf = pdfMake.createPdf({
		content: [
			{
				alignment: "center",
				bold: true,
				fontSize: 18,
				margin: [0, 0, 0, 18],
				text: input.title,
			},
			...contentParagraphs(input.content).map((text) => ({
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
	return content
		.replace(/\r\n?/g, "\n")
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
}
