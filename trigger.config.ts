import { defineConfig } from "@trigger.dev/sdk/v3";
import { additionalFiles, additionalPackages, aptGet } from "@trigger.dev/build/extensions/core";
import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";

export default defineConfig({
  project: "proj_urmbshsegehkpwjrbrci",
  runtime: "node-22",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
  build: {
    extensions: [
      puppeteer(),
      aptGet({ packages: ["fonts-liberation", "fonts-freefont-ttf", "fontconfig"] }),
      additionalFiles({ files: ["./scripts/**"] }),
      additionalPackages({ packages: ["sharp", "axios", "cheerio", "@mendable/firecrawl-js", "fs-extra", "dotenv"] }),
    ],
  },
});
