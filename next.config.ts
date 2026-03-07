import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['dexie'],
  headers: async () => [
    {
      source: '/ads.txt',
      headers: [
        { key: 'Content-Type', value: 'text/plain' },
        { key: 'Cache-Control', value: 'public, max-age=86400' },
      ],
    },
    {
      source: '/robots.txt',
      headers: [
        { key: 'Content-Type', value: 'text/plain' },
        { key: 'Cache-Control', value: 'public, max-age=86400' },
      ],
    },
  ],
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
