import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    defaultViewport: {
      width: Number(process.env.VIEWPORT_WIDTH) || 1920,
      height: Number(process.env.VIEWPORT_HEIGHT) || 1080,
    },
  });
  const page = await browser.newPage();
  await page.setUserAgent(process.env.USER_AGENT || 'Mozilla/5.0');
  await page.goto(process.env.TARGET_URL || 'https://example.com', {
    timeout: Number(process.env.TIMEOUT) || 30000,
    waitUntil: 'domcontentloaded',
  });

  // 範例：擷取網頁標題
  const title = await page.title();
  console.log('網頁標題:', title);

  // 範例：擷取網頁內容
  const content = await page.content();
  console.log('網頁內容長度:', content.length);

  await browser.close();
})();
