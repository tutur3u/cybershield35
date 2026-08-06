/**
 * Regenerates every brand raster from the one source of truth, `app/icon.svg`.
 *
 * The favicon, the Apple touch icon and the Open Graph card are all committed
 * as binaries because they must not cost a function invocation per crawl. That
 * makes them exactly the kind of asset that drifts: somebody edits the SVG, the
 * PNGs keep showing last year's mark, and nobody notices until a link preview
 * looks wrong in a group chat. Run this after changing the mark or the copy.
 *
 *   bun run brand:generate
 *
 * Fonts are fetched rather than committed. They are only needed to re-render,
 * they are several megabytes, and Be Vietnam Pro is the same OFL family the app
 * already loads through `next/font`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

const ROOT = process.cwd();
const FONT_DIR = join(tmpdir(), "cs35-brand-fonts");
const FONT_BASE =
	"https://github.com/google/fonts/raw/main/ofl/bevietnampro/BeVietnamPro-";
const WEIGHTS = [
	{ file: "Regular", weight: 400 },
	{ file: "SemiBold", weight: 600 },
	{ file: "Bold", weight: 700 },
] as const;

const TITLE = "Giám sát thông tin công khai và phản hồi truyền thông";
const EYEBROW = "AN NINH THÔNG TIN TRÊN KHÔNG GIAN MẠNG";
const CAPABILITIES =
	"Quét nguồn theo lịch · Phân tích rủi ro bằng AI · Xuất bản lên Zalo OA";
const STAKEHOLDER = "Công an phường Ea Kao";
const DEVELOPER = "Tuturuuu";

async function font(name: (typeof WEIGHTS)[number]["file"]) {
	mkdirSync(FONT_DIR, { recursive: true });
	const path = join(FONT_DIR, `BeVietnamPro-${name}.ttf`);
	try {
		return readFileSync(path);
	} catch {
		const response = await fetch(`${FONT_BASE}${name}.ttf`);
		if (!response.ok) {
			throw new Error(`Không tải được font ${name}: ${response.status}`);
		}
		const data = Buffer.from(await response.arrayBuffer());
		writeFileSync(path, data);
		return data;
	}
}

const icon = readFileSync(join(ROOT, "app/icon.svg"));
const rasterise = (size: number) =>
	sharp(icon).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// iOS applies its own corner radius and never uses transparency, so the mark is
// drawn edge to edge and the rounding is left to the platform.
const appleIcon = await rasterise(180);
writeFileSync(join(ROOT, "app/apple-icon.png"), appleIcon);

/*
 * A .ico that wraps PNG payloads rather than BMPs. Every browser still asking
 * for /favicon.ico has understood embedded PNG for well over a decade, and the
 * alternative — a hand-rolled BMP encoder with its bottom-up rows and AND mask
 * — is a great deal of code to get an icon slightly more wrong.
 */
const frames = await Promise.all(
	[16, 32, 48].map(async (size) => ({ png: await rasterise(size), size })),
);
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // 1 = icon, as opposed to a cursor
header.writeUInt16LE(frames.length, 4);

let payloadOffset = 6 + frames.length * 16;
const directory = frames.map(({ png, size }) => {
	const entry = Buffer.alloc(16);
	entry.writeUInt8(size, 0);
	entry.writeUInt8(size, 1);
	entry.writeUInt16LE(1, 4); // colour planes
	entry.writeUInt16LE(32, 6); // bits per pixel
	entry.writeUInt32LE(png.length, 8);
	entry.writeUInt32LE(payloadOffset, 12);
	payloadOffset += png.length;
	return entry;
});
writeFileSync(
	join(ROOT, "app/favicon.ico"),
	Buffer.concat([header, ...directory, ...frames.map((frame) => frame.png)]),
);

/*
 * The card is rendered through satori rather than through sharp. sharp's SVG
 * backend here has no text support at all — it silently drops every <text>
 * node, which produces a handsome empty gradient and no words.
 */
const mark = `data:image/png;base64,${appleIcon.toString("base64")}`;
const card = new ImageResponse(
	(
		<div
			style={{
				background: "linear-gradient(135deg, #10151d 0%, #1a2432 100%)",
				color: "#f3f7fb",
				display: "flex",
				flexDirection: "column",
				height: "100%",
				justifyContent: "space-between",
				padding: "72px 96px 64px",
				width: "100%",
			}}
		>
			<div
				style={{
					background: "#2563eb",
					height: 8,
					left: 0,
					position: "absolute",
					top: 0,
					width: 1200,
				}}
			/>
			<div style={{ alignItems: "center", display: "flex", gap: 28 }}>
				{/*
					This tree is rendered by satori into a PNG, never by a browser, so
					`next/image` has nothing to optimise and `alt` has nowhere to go —
					the card's alt text lives in `app/opengraph-image.alt.txt`.
				*/}
				{/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
				<img src={mark} width={104} height={104} style={{ borderRadius: 24 }} />
				<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
					<div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -0.5 }}>
						CyberShield 35
					</div>
					<div
						style={{
							color: "#7d8da5",
							fontSize: 24,
							fontWeight: 600,
							letterSpacing: 3,
						}}
					>
						{EYEBROW}
					</div>
				</div>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
				<div
					style={{
						fontSize: 62,
						fontWeight: 700,
						lineHeight: 1.18,
						maxWidth: 940,
					}}
				>
					{TITLE}
				</div>
				<div style={{ color: "#9aa9bf", fontSize: 28, fontWeight: 400 }}>
					{CAPABILITIES}
				</div>
			</div>

			<div
				style={{
					borderTop: "1px solid #2a3444",
					color: "#7d8da5",
					display: "flex",
					fontSize: 24,
					fontWeight: 600,
					justifyContent: "space-between",
					paddingTop: 28,
					width: "100%",
				}}
			>
				<div style={{ display: "flex" }}>{STAKEHOLDER}</div>
				<div style={{ display: "flex" }}>{DEVELOPER}</div>
			</div>
		</div>
	),
	{
		fonts: await Promise.all(
			WEIGHTS.map(async ({ file, weight }) => ({
				data: await font(file),
				name: "Be Vietnam Pro",
				style: "normal" as const,
				weight,
			})),
		),
		height: 630,
		width: 1200,
	},
);
writeFileSync(
	join(ROOT, "app/opengraph-image.png"),
	Buffer.from(await card.arrayBuffer()),
);

console.log("Đã tạo favicon.ico, apple-icon.png và opengraph-image.png.");
