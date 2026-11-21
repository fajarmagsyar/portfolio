import type { NextConfig } from "next";

// Deployed as a static site (GitHub Pages): the workflow sets STATIC_EXPORT=1 and, for a project
// page at https://<user>.github.io/<repo>/, NEXT_PUBLIC_BASE_PATH=/<repo>. Locally neither is set.
const base = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
const exporting = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // lets the dev server be opened from other devices on the LAN (phone, second PC)
  // 127.0.0.1 / [::1] so the loopback addresses work as well as `localhost`
  allowedDevOrigins: ["192.168.0.4", "127.0.0.1", "[::1]"],
  // (these two cannot be used in a static export, so the Pages build leaves them off)
  ...(exporting ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : { cacheComponents: true, partialPrefetching: true }),
  basePath: base,
  // lets a test build run beside the dev server without touching its files
  distDir: process.env.NEXT_DIST_DIR || undefined,
};

export default nextConfig;
