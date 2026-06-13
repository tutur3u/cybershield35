import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";

import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
	subsets: ["latin", "vietnamese"],
	weight: ["300", "400", "500", "600", "700", "800"],
	variable: "--font-be-vietnam",
	display: "swap",
});

export const metadata: Metadata = {
	title: {
		default: "CyberShield 35 | AI For Life",
		template: "%s | CyberShield 35",
	},
	description:
		"Bảng điều khiển phân tích thảo luận công khai, bằng chứng và lập luận phản hồi cho AI For Life.",
	applicationName: "CyberShield 35",
	authors: [{ name: "AI For Life", url: "https://ai.daklak.gov.vn" }],
	creator: "AI For Life",
	publisher: "Dak Lak AI",
	metadataBase: new URL("https://ai.daklak.gov.vn"),
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="vi" className={`${beVietnam.variable} h-full antialiased`}>
			<body>{children}</body>
		</html>
	);
}
