import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output → small Docker image (only the server + traced deps).
  output: "standalone",
};

export default nextConfig;
