import type { NextConfig } from "next";

const useWebpackBuild = process.env.NEXT_WEBPACK_BUILD === "1";

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
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
