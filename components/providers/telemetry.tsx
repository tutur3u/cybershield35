"use client";

import Script from "next/script";

/** Cloudflare Web Analytics is enabled with the site's public beacon token. */
export function Telemetry() {
 const token=process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;
 if(!token) return null;
 return <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive" data-cf-beacon={JSON.stringify({token})} />;
}
