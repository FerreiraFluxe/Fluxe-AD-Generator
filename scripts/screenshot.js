'use strict';

async function takeScreenshot(htmlPath, outPngPath, { width = 1080, height = 1080 } = {}) {
  let browser;

  if (process.env.TRIGGER_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = require('@sparticuz/chromium-min');
    const puppeteer = require('puppeteer-core');
    const executablePath = await chromium.executablePath(
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar'
    );
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  } else {
    // Use indirect require so esbuild doesn't try to bundle 'puppeteer' in the cloud build
    const puppeteer = require(/* local-dev */ ['puppeteer'].join(''));
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
