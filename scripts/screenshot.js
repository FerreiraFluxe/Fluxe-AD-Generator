'use strict';

async function takeScreenshot(htmlPath, outPngPath, { width = 1080, height = 1080 } = {}) {
  let browser;

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    // Trigger.dev cloud: Chrome installed by puppeteer() build extension
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  } else {
    // Local dev: full puppeteer (indirect require to avoid esbuild bundling)
    const puppeteer = require(['puppeteer'].join(''));
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: outPngPath, type: 'png', clip: { x: 0, y: 0, width, height } });
  } finally {
    await browser.close();
  }
}

module.exports = { takeScreenshot };
