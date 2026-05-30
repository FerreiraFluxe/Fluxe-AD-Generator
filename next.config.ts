import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', 'puppeteer', 'puppeteer-core', '@sparticuz/chromium-min'],
};

export default nextConfig;
