/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is required by the Docker image. Its trace-copy step creates
  // symlinks, which fails with EPERM on Windows unless Developer Mode is enabled —
  // set NEXT_OUTPUT_STANDALONE=false to verify a build locally on such machines.
  output: process.env.NEXT_OUTPUT_STANDALONE === 'false' ? undefined : 'standalone',
  transpilePackages: ['@ai-career/shared'],
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
