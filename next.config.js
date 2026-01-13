/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure external packages for serverless Puppeteer support
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  },
};

module.exports = nextConfig;
