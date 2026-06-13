import { Analytics } from "@vercel/analytics/next";
import "@tuturuuu/ui/globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		default: "Tuturuuu Starter",
		template: "%s | Tuturuuu Starter",
	},
	description: "A modern Next.js starter for Tuturuuu projects.",
	applicationName: "Tuturuuu Starter",
	authors: [{ name: "Tuturuuu", url: "https://tuturuuu.com" }],
	creator: "Tuturuuu",
	publisher: "Tuturuuu",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<Analytics />
			<body className="flex min-h-full flex-col bg-root-background text-foreground">
				{children}
			</body>
		</html>
	);
}
