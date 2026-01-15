import puppeteer, { Page } from 'puppeteer';
import dotenv from 'dotenv';
import { generatePlateNumbers } from './utils/generatePlateNumbers';
import errorList from '../result/errors_to_retry.json';
import fs from 'fs';
dotenv.config();

function logMem(tag = '') {
  const m = process.memoryUsage();
  console.log('[mem]', tag, {
    rss: `${Math.round(m.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(m.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(m.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(m.external / 1024 / 1024)} MB`,
  });
}

const TARGET_URL = 'https://www.mvdis.gov.tw/m3-emv-plate/bid/queryBid#gsc.tab=0';

interface QueryResult {
  plate: string;
  status: string;
  message?: string;
  amount?: string | null;
}

async function queryPlate(plate: string, page: Page): Promise<QueryResult> {
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.$eval('#queryPlateNumber', el => (el as HTMLInputElement).value = '');
    await page.type('#queryPlateNumber', plate);
    await page.locator('.tab_cont a.std_btn').click()
    await new Promise(res => setTimeout(res, 1000));
    // 查詢無資料
    const notFoundHandle = await page.$('#to tbody tr:first-child.empty');
    if (notFoundHandle) {
      const text = await notFoundHandle.evaluate(node => node.textContent?.trim() || '');
      return { plate, status: 'not found', message: text };
    }
    // 抓取查詢結果表格第 5 個 td（決標金額）
    const amountTdHandle = await page.$('#to tbody tr:first-child td:nth-child(5)');
    if (amountTdHandle) {
      const html = await amountTdHandle.evaluate(node => node.innerHTML);
      return { plate, status: 'found', message: `決標金額 ${html}` };
    }

    return { plate, status: 'error', message: '' };
  } catch (err: any) {
    return { plate, status: 'error', message: err.message };
  }
}

async function main() {
  logMem('queryPlate:main:start');
  // const plates = generatePlateNumbers();
  const plates = [
    'CAT-2533',
    'CAT-1036',
    'CAT-6310',
    'CAT-3318',
    'CAT-3610',
    'CAT-6103',
    'CAT-3633',
    'CAT-3321',
    'CAT-2133',
    'CAT-2103',
    'CAT-3821',
  ]
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();// 正常資料分檔

  let fileIndex = 1;
  let recordCount = 0;
  let filePath = `results_t${fileIndex}.json`;
  fs.writeFileSync(filePath, '[\n');
  // 查無資料分檔
  let notFoundIndex = 1;
  let notFoundCount = 0;
  let notFoundPath = `notfound_t${notFoundIndex}.json`;
  fs.writeFileSync(notFoundPath, '[\n');

  for (let i = 0; i < plates.length; i++) {
    const plate = plates[i];
    const result = await queryPlate(plate, page);
    console.log(result.plate, result.status, result.message || '');
    if ((i + 1) % 10 === 0) logMem(`progress:${i + 1}`);
    const isNotFound = result.status === 'not found' || (result.message && result.message.includes('查無資料'));
    if (isNotFound) {
      // 只寫入 notfound_X.json
      if (notFoundCount > 0) {
        fs.appendFileSync(notFoundPath, ',\n');
      }
      fs.appendFileSync(notFoundPath, JSON.stringify(result, null, 2));
      notFoundCount++;
      if (notFoundCount === 500) {
        fs.appendFileSync(notFoundPath, '\n]');
        console.log(`已儲存 ${notFoundPath} (第${i + 1}筆)`);
        notFoundIndex++;
        notFoundPath = `notfound_${notFoundIndex}.json`;
        fs.writeFileSync(notFoundPath, '[\n');
        notFoundCount = 0;
      }
    } else {
      // 只寫入 results_X.json
      if (recordCount > 0) {
        fs.appendFileSync(filePath, ',\n');
      }
      fs.appendFileSync(filePath, JSON.stringify(result, null, 2));
      recordCount++;
      if (recordCount === 500) {
        fs.appendFileSync(filePath, '\n]');
        console.log(`已儲存 ${filePath} (第${i + 1}筆)`);
        fileIndex++;
        filePath = `results_${fileIndex}.json`;
        fs.writeFileSync(filePath, '[\n');
        recordCount = 0;
      }
    }
    await new Promise(res => setTimeout(res, 500));
  }
  // 結尾補上 ]
  if (recordCount > 0) {
    fs.appendFileSync(filePath, '\n]');
    console.log(`已儲存 ${filePath} (最後${recordCount}筆)`);
  } else {
    try { fs.appendFileSync(filePath, '\n]'); } catch {}
  }
  if (notFoundCount > 0) {
    fs.appendFileSync(notFoundPath, '\n]');
    console.log(`已儲存 ${notFoundPath} (最後${notFoundCount}筆)`);
  } else {
    try { fs.appendFileSync(notFoundPath, '\n]'); } catch {}
  }

  await browser.close();
  logMem('queryPlate:browser-closed');
  console.log('查詢完成，所有結果已分批儲存。');
}

main();