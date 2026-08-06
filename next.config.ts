import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const useWebpackBuild = process.env.NEXT_WEBPACK_BUILD === "1";

/**
 * The host this app is served from, which is the only remote host whose images
 * the optimiser may touch. Falls back to the production domain so a build
 * without the variable still serves its own media.
 */
const publicAppHostname = (() => {
	const configured = process.env.CYBERSHIELD35_PUBLIC_APP_URL?.trim();
	if (!configured) return "cybershield35.ttr.gg";
	try {
		return new URL(configured).hostname;
	} catch {
		return "cybershield35.ttr.gg";
	}
})();

const securityHeaders = [
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Permitted-Cross-Domain-Policies", value: "none" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
	},
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self'",
			"connect-src 'self'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join("; "),
	},
];

const nextConfig: NextConfig = {
	cacheComponents: true,
	images: {
		/*
		 * Only our own media is optimised. Pointing the optimiser at arbitrary
		 * remote hosts turns it into an open image proxy for anyone who can guess
		 * the URL shape, and the foreign covers we do show are expiring CDN links
		 * that would poison the cache anyway.
		 */
		formats: ["image/avif", "image/webp"],
		localPatterns: [{ pathname: "/api/articles/**" }],
		/*
		 * Our own media is stored as absolute URLs, which the optimiser classifies
		 * as remote even though they point back here — so allow-listing the local
		 * path alone matched nothing and every article image failed to load. The
		 * pathname keeps the permission narrow: only the media route, never an
		 * arbitrary file, and only from hosts we serve.
		 */
		remotePatterns: [
			{
				hostname: publicAppHostname,
				pathname: "/api/articles/**",
				protocol: "https",
			},
			{ hostname: "localhost", pathname: "/api/articles/**", protocol: "http" },
		],
		// Article covers render around 380px in the rail and full width on mobile.
		imageSizes: [64, 128, 256, 384],
	},
	partialPrefetching: true,
	reactCompiler: !useWebpackBuild,
	experimental: {
		instantInsights: {
			validationLevel: "warning",
		},
		staleTimes: {
			dynamic: 120,
			static: 300,
		},
		...(useWebpackBuild
			? {}
			: {
					turbopackFileSystemCacheForBuild: true,
					turbopackRustReactCompiler: true,
				}),
	},
	transpilePackages: ["@tuturuuu/ui", "@tuturuuu/icons", "@tuturuuu/utils"],
	async redirects() {
		return [
			{ source: "/drafts", destination: "/articles", permanent: true },
			{ source: "/topics", destination: "/intelligence?view=topics", permanent: true },
			{ source: "/topics/:slug", destination: "/intelligence/topics/:slug", permanent: true },
			{ source: "/analysis", destination: "/intelligence?view=overview", permanent: true },
			{ source: "/alerts", destination: "/intelligence?view=alerts", permanent: true },
			{ source: "/reports", destination: "/articles", permanent: true },
		];
	},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
};

/**
 * Workflows compiles `'use workflow'` / `'use step'` functions into the routes
 * that make them durable, so the wrapper has to see the whole config.
 */
export default withWorkflow(nextConfig);
