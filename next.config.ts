import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets the dev server be opened from other devices on the LAN (phone, second PC)
  allowedDevOrigins: ["192.168.0.4"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
