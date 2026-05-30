import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'fluxe-ad-generator',
  runtime: 'node',
  logLevel: 'log',
  maxDuration: 300,
  additionalFiles: ['scripts/**'],
  additionalPackages: ['sharp', 'puppeteer-core', '@sparticuz/chromium-min', 'axios', 'cheerio', '@mendable/firecrawl-js', 'fs-extra'],
  dirs: ['trigger'],
});
