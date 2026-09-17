import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  compress: false,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@ai-chat-suite/suite', 'mermaid'],
};

export default nextConfig;
