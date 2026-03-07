import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['dexie'],
  outputFileTracingIncludes: {
    '/': ['./src/workers/**/*'],
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
