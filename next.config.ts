import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets the dev server be opened from other devices on the LAN (phone, second PC)
  // 127.0.0.1 / [::1] so the loopback addresses work as well as `localhost`
  allowedDevOrigins: ["192.168.0.4", "127.0.0.1", "[::1]"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
