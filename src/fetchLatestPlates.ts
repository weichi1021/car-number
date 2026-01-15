import 'dotenv/config';
import * as puppeteer from 'puppeteer';
import fs from 'fs';
import { formatDate } from './utils/formatDate';
import { recognizeCaptcha } from './utils/recognizeCaptcha';
import { scheduleTaskWithWindow } from './utils/scheduler';

// 全域變數：共用的 browser 實例
let sharedBrowser: puppeteer.Browser | null = null;
let browserRestartCount = 0;
const MAX_BROWSER_USAGE = 50; // 每 50 次查詢後重啟 browser

async function ensureBrowser(): Promise<puppeteer.Browser> {
  if (!sharedBrowser || !sharedBrowser.connected) {
    console.log('啟動新的 Browser 實例...');
    const launchOptions: any = {
      headless: true,
      devtools: false, // 關閉 devtools 減少記憶體
      defaultViewport: null as any,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // 避免共享記憶體不足
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    };
    sharedBrowser = await puppeteer.launch(launchOptions);
    browserRestartCount = 0;
  }
  return sharedBrowser;
}

async function closeBrowser() {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
      console.log('Browser 已關閉');
    } catch (e) {
      console.error('關閉 Browser 失敗:', e);
    }
    sharedBrowser = null;
  }
}

async function fetchLatestPlates() {
  const url = 'https://www.mvdis.gov.tw/m3-emv-plate/webpickno/queryPickNo#';

  const browser = await ensureBrowser();
  const page = await browser.newPage();
  // 增加預設導航 timeout，並使用 safeGoto 做重試處理
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  async function safeGoto(page: puppeteer.Page, url: string, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        // 使用 domcontentloaded 降低被第三方資源卡住的機率
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        return;
      } catch (err) {
        console.warn(`page.goto 失敗（第 ${i + 1} 次）：`, err instanceof Error ? err.message : err);
        if (i === attempts - 1) throw err;
        await new Promise(res => setTimeout(res, 2000 * (i + 1)));
      }
    }
  }

  async function safeReload(page: puppeteer.Page, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        return;
      } catch (err) {
        console.warn(`page.reload 失敗（第 ${i + 1} 次）：`, err instanceof Error ? err.message : err);
        if (i === attempts - 1) throw err;
        await new Promise(res => setTimeout(res, 2000 * (i + 1)));
      }
    }
  }

  await safeGoto(page, url);

  // 選擇「台北市」
  await page.select('#selDeptCode', '2');
  // 等待「基隆監理站」載入
  await page.waitForFunction(() => {
    const sel = document.querySelector('#selStationCode');
    return sel && sel.querySelectorAll('option').length > 1;
  });
  // 選擇「基隆監理站」(通常 value 需根據實際 option value，這裡假設為第一個非0選項)
  const stationOptions = await page.$$eval('#selStationCode option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  const keelung = stationOptions.find(o => o.text?.includes('基隆'));
  if (keelung) {
    await page.select('#selStationCode', keelung.value);
  }
  // 等待「領牌地點」載入
  await page.waitForFunction(() => {
    const sel = document.querySelector('#selWindowNo');
    return sel && sel.querySelectorAll('option').length > 1;
  });
  // 選擇第一個可選領牌地點（非0）
  const windowOptions = await page.$$eval('#selWindowNo option', opts => opts.map(o => o.value).filter(v => v !== '0'));
  if (windowOptions.length > 0) {
    await page.select('#selWindowNo', windowOptions[0]);
  }
  await new Promise(res => setTimeout(res, 500)); // 確保選單載入完成
  // 選擇「汽車」
  await page.select('#selCarType', 'C');
  // 等待「能源別」選單刷新（通常會重建 option）
  await page.waitForFunction(() => {
    const sel = document.querySelector('#selEnergyType');
    return sel && sel.querySelectorAll('option').length > 1;
  });
  // 選擇「非電能」
  await page.select('#selEnergyType', 'C');
  // 等待「車牌別」選單刷新，且有「自用小客貨車」
  await page.waitForFunction(() => {
    const sel = document.querySelector('#selPlateType');
    if (!sel) return false;
    const opts = Array.from(sel.querySelectorAll('option'));
    return opts.some(o => o.textContent && o.textContent.includes('自用小客貨車'));
  });
  // 選擇「自用小客貨車」(需根據 option 文字比對)
  const plateTypeOptions = await page.$$eval('#selPlateType option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  const privateCar = plateTypeOptions.find(o => o.text?.includes('自用小客貨車'));
  if (privateCar) {
    await page.select('#selPlateType', privateCar.value);
  }
  // 等待「新式車牌」radio 出現
  await page.waitForSelector('input[name="plateVer"][value="2"]');
  // 點選「新式車牌」
  await page.click('input[name="plateVer"][value="2"]');


  // 驗證碼辨識與重試邏輯
  const MAX_CAPTCHA_RETRY = 3; // 最多重試 3 次
  let captchaText = '';
  let captchaSuccess = false;

  for (let retryCount = 0; retryCount < MAX_CAPTCHA_RETRY; retryCount++) {
    try {
      // 直接截圖驗證碼圖片
      const captchaElem = await page.$('#pickimg');
      if (!captchaElem) throw new Error('找不到驗證碼圖片');

      // 使用記憶體 buffer 而非檔案，減少磁碟 I/O
      const screenshotBuffer = await captchaElem.screenshot({ encoding: 'binary' });
      fs.writeFileSync('captcha_raw.jpg', screenshotBuffer);

      // 自動辨識驗證碼
      captchaText = await recognizeCaptcha('captcha_raw.jpg', 'captcha.jpg');
      console.log(`辨識到的驗證碼: ${captchaText}`);
      captchaSuccess = true;
      break; // 辨識成功，跳出重試迴圈
    } catch (error) {
      console.error(`驗證碼辨識失敗 (第 ${retryCount + 1} 次):`, error instanceof Error ? error.message : error);

      if (retryCount < MAX_CAPTCHA_RETRY - 1) {
        console.log('重新載入驗證碼...');
        // 刷新驗證碼圖片
        // 點擊「換一張」驗證碼按鈕
        await page.click('a[onclick*="pickimg"]');
        await new Promise(res => setTimeout(res, 1000)); // 等待新驗證碼載入
      } else {
        console.error(`驗證碼辨識失敗超過 ${MAX_CAPTCHA_RETRY} 次，終止程式`);
        throw new Error(`驗證碼辨識失敗: 已重試 ${MAX_CAPTCHA_RETRY} 次`);
      }
    }
  }

  if (!captchaSuccess) {
    throw new Error('驗證碼辨識失敗');
  }

  // 輸入驗證碼
  await page.type('#validateStr', captchaText);

  // 送出查詢
  await page.click('.align_c.gap_t a.std_btn[onclick="doSubmit()"]');

  // 等待查詢結果出現
  await page.waitForSelector('#countList');

  // 跳到最後一頁
  const href = await page.$eval('#previous', el => el.getAttribute('href'));
  await safeGoto(page, 'https://www.mvdis.gov.tw' + href);

  // 等待查詢結果出現
  await page.waitForSelector('#countList');

  // 確保至少有一個車牌欄位可讀取
  await page.waitForFunction(() => {
    const cells = document.querySelectorAll('.number_cell');
    return cells && cells.length > 0;
  });

  // 取得最後一個 number_cell 的車牌號
  const lastPlate = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.number_cell'));
    if (cells.length === 0) return null;
    const lastCell = cells[cells.length - 1];
    const numberAnchor = lastCell.querySelector('a.number');
    return numberAnchor ? numberAnchor.textContent?.trim() : null;
  });

  if (lastPlate) {
    // 取得當下時間（YYYY/MM/DD hh:mm:ss 24 小時制）
    const now = formatDate(new Date());
    let plateList = [];
    const filePath = 'latest_plates.json';
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        plateList = JSON.parse(raw);
        if (!Array.isArray(plateList)) plateList = [];
      } catch (e) {
        plateList = [];
      }
    }
    // 僅當新抓到的車牌號與最後一筆不同時才寫入
    const lastRecord = plateList.length > 0 ? plateList[plateList.length - 1] : null;
    let lastIndex = -1;
    let targetIdx = -1;
    if (!lastRecord || lastRecord.latest !== lastPlate) {
      plateList.push({ latest: lastPlate, timestamp: now });
      // 只保留最新 20 筆
      if (plateList.length > 20) {
        plateList = plateList.slice(-20);
      }
      fs.writeFileSync(filePath, JSON.stringify(plateList, null, 2), 'utf-8');

      // === 計算距離 CAT-2533 還有多少個 ===
      try {
        const notfoundPlates = JSON.parse(fs.readFileSync('notfound/notfound-all.json', 'utf-8'));
        // 找到最新車牌在 notfound/notfound-all.json 的 index
        lastIndex = notfoundPlates.indexOf(lastPlate);
        targetIdx = notfoundPlates.indexOf('CAT-2533');
        if (lastIndex !== -1 && targetIdx !== -1) {
          console.log(`目前最新: ${lastPlate} (第 ${lastIndex + 1} 個)，時間: ${now}`);
          console.log(`目標: CAT-2533，距離目標剩餘: ${targetIdx - lastIndex} 個`);
        } else {
          console.log('最新車牌號不在有效清單內，無法計算距離');
        }
      } catch (e) {
        console.log('計算距離失敗:', e);
      }
    } else {
      console.log('車牌號未變動', '時間:', now);
    }
  } else {
    console.log('未找到車牌號');
  }

  // 清理頁面資源
  await page.close();

  // 定期重啟 browser 以釋放記憶體
  browserRestartCount++;
  if (browserRestartCount >= MAX_BROWSER_USAGE) {
    console.log(`已執行 ${browserRestartCount} 次，重啟 Browser 以釋放記憶體...`);
    await closeBrowser();
  }
}

// 包裝呼叫：立即執行一次，發生錯誤時只記錄不終止
async function runOnce() {
  try {
    await fetchLatestPlates();
  } catch (err) {
    console.error('fetchLatestPlates 執行失敗:', err);
    // 若為導航超時（Puppeteer TimeoutError），5 分鐘後自動重試一次
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || /Navigation timeout/i.test(err.message || ''));
    if (isTimeout) {
      const RETRY_MS = 1 * 15 * 1000; // 1 分鐘
      console.log(`偵測到導航超時，將在 ${Math.round(RETRY_MS / 1000)} 秒後重新嘗試一次`);
      setTimeout(async () => {
        try {
          await fetchLatestPlates();
        } catch (e) {
          console.error('5 分鐘後重試失敗:', e);
        }
      }, RETRY_MS);
    }
  }
}

// 使用共用 scheduler，時段 07:00-22:00，每 30 秒執行
scheduleTaskWithWindow(runOnce, { startHour: 7, endHour: 22, intervalMs: 1 * 15 * 1000 });

// 程式結束時清理資源
process.on('SIGINT', async () => {
  console.log('\n收到中斷訊號，正在清理資源...');
  await closeBrowser();
  // 清理暫存檔案
  try {
    if (fs.existsSync('captcha_raw.jpg')) fs.unlinkSync('captcha_raw.jpg');
    if (fs.existsSync('captcha.jpg')) fs.unlinkSync('captcha.jpg');
  } catch (e) {
    // 忽略清理錯誤
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n收到終止訊號，正在清理資源...');
  await closeBrowser();
  process.exit(0);
});
