import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs';
import { recognizeCaptcha } from './utils/recognizeCaptcha';
import { sendLineNotify } from './utils/lineNotify';

async function fetchLatestPlates() {
  const url = 'https://www.mvdis.gov.tw/m3-emv-plate/webpickno/queryPickNo#';
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

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


  // 直接截圖驗證碼圖片，不跳頁
  const captchaElem = await page.$('#pickimg');
  if (!captchaElem) throw new Error('找不到驗證碼圖片');
  await captchaElem.screenshot({ path: 'captcha_raw.jpg' });

  // === 自動辨識驗證碼 ===
  // const captchaText = await recognizeCaptcha('captcha_raw.jpg', 'captcha.jpg');
  // console.log('辨識到的驗證碼:', captchaText);
  // === 改用人工輸入驗證碼 ===
  console.log('請開啟 captcha_raw.jpg，並輸入驗證碼：');
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const captchaText: string = await new Promise(resolve => {
    rl.question('驗證碼：', (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
  // 輸入驗證碼
  await page.type('#validateStr', captchaText);

  // 送出查詢
  await page.click('.align_c.gap_t a.std_btn[onclick="doSubmit()"]');

  // 等待查詢結果出現
  await page.waitForSelector('#countList');

  // 跳到最後一頁
  const href = await page.$eval('#previous', el => el.getAttribute('href'));
  await page.goto('https://www.mvdis.gov.tw' + href);

  // 封裝抓取與儲存邏輯
  async function fetchAndSavePlate() {
    // 重整頁面並等待查詢結果重新載入
    await page.reload({ waitUntil: 'networkidle2' });
    // 確保結果區塊已經出現
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
      function formatDate(date: Date) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        const ss = pad(date.getSeconds());
        return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
      }
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
      if (!lastRecord || lastRecord.latest !== lastPlate) {
        plateList.push({ latest: lastPlate, timestamp: now });
        // 只保留最新 20 筆
        if (plateList.length > 20) {
          plateList = plateList.slice(-20);
        }
        fs.writeFileSync(filePath, JSON.stringify(plateList, null, 2), 'utf-8');
        console.log('最新車牌號:', lastPlate, '時間:', now);

        // 組合要發送的通知內容
        let notifyMsg = `最新車牌號: ${lastPlate} 時間: ${now}`;

        // === 計算距離 CAT-2533 還有多少個 ===
        try {
          const notfoundPlates = JSON.parse(fs.readFileSync('notfound/notfound-all.json', 'utf-8'));
          // 找到最新車牌在 notfound/notfound-all.json 的 index
          const idx = notfoundPlates.indexOf(lastPlate);
          const targetIdx = notfoundPlates.indexOf('CAT-2533');
          if (idx !== -1 && targetIdx !== -1) {
            const remain = targetIdx - idx;
            console.log(`已出 ${idx + 1} 個，距離 CAT-2533 還有 ${remain} 個`);
            notifyMsg += `，已出 ${idx + 1} 個，距離 CAT-2533 還有 ${remain} 個`;
          } else {
            console.log('最新車牌號不在有效清單內，無法計算距離');
          }
        } catch (e) {
          console.log('計算距離失敗:', e);
        }

        // 發送 LINE Notify 推播（若有設定 token）
        try {
          await sendLineNotify(notifyMsg);
        } catch (e) {
          console.log('LINE 推播失敗:', e);
        }
      } else {
        console.log('車牌號未變動', '時間:', now);
      }
    } else {
      console.log('未找到車牌號');
    }
  }

  // sendLineNotify 已移到 utils/lineNotify.ts，從該模組匯入使用

  // 先執行一次
  await fetchAndSavePlate();
  // 每 10 秒執行一次
  setInterval(fetchAndSavePlate, 150000);
}

fetchLatestPlates().catch(err => {
  console.error('抓取失敗:', err);
  process.exit(1);
});
