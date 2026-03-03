import type { NextConfig } from 'next';
import { join } from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  transpilePackages: ['@tgs3/shared'],
  experimental: {
    middlewareClientMaxBodySize: '2gb',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.ADMIN_API_PORT || '3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
