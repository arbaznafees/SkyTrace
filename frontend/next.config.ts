import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "localhost:3001",
    "127.0.0.1:3000",
    "127.0.0.1:3001",
    "10.39.103.62:3000",
    "10.39.103.62:3001",
    "192.168.*",
  ],
  devIndicators: false,
};

export default nextConfig;
