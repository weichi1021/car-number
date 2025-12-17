# 車牌查詢自動化專案 — 使用說明（更新）

本文件針對專案程式碼做補充與執行說明，方便開發與執行自動化查詢流程。

主要檔案與函式
- 車牌產生器：[`generatePlateNumbers`](src/utils/generatePlateNumbers.ts) ([src/utils/generatePlateNumbers.ts](src/utils/generatePlateNumbers.ts))
- 驗證碼辨識（可選自動化）：[`recognizeCaptcha`](src/utils/recognizeCaptcha.ts) ([src/utils/recognizeCaptcha.ts](src/utils/recognizeCaptcha.ts))
- LINE 推播：[`sendLineNotify`](src/utils/lineNotify.ts)（以及 `ReplyMessage`, `BroadcastMsg`）([src/utils/lineNotify.ts](src/utils/lineNotify.ts))
- 定期抓最新車牌：主程式 [src/fetchLatestPlates.ts](src/fetchLatestPlates.ts)（以實作為主，預設要求人工輸入 captcha）
- 批次查詢車牌並儲存結果：[`queryPlate`](src/queryPlate.ts)（可替換為使用 [`generatePlateNumbers`](src/utils/generatePlateNumbers.ts) 產生的清單）([src/queryPlate.ts](src/queryPlate.ts))
- 範例爬蟲： [src/examples/basic-scraper.ts](src/examples/basic-scraper.ts)
- 專案設定： [package.json](package.json), [tsconfig.json](tsconfig.json), [.env.example](.env.example)

快速執行
1. 安裝依賴：
   ```sh
   npm install
   ```
2. 設定環境變數（可選，用於 LINE 推播）：
   - 複製範例：`cp .env.example .env`
   - 編輯 `.env` 填入 `CHANNEL_ACCESS_TOKEN`（參考 [.env.example](.env.example)）
3. 執行抓最新車牌（會截圖 captcha，預設需手動在終端輸入）：
   ```sh
   npx ts-node src/fetchLatestPlates.ts
   ```
   相關實作位於 [src/fetchLatestPlates.ts](src/fetchLatestPlates.ts)。

批次查詢流程（離線/離峰）
- 若要批次查詢大量車牌，請使用 [src/queryPlate.ts](src/queryPlate.ts)：
  - 範例中暫時使用手動 plate 清單；可改回使用 [`generatePlateNumbers`](src/utils/generatePlateNumbers.ts) 產生完整清單。
  - 查詢結果會分檔寫入 `results_*.json` 與 `notfound_*.json`（程式內寫入邏輯在 [src/queryPlate.ts](src/queryPlate.ts)）。
  - 範例輸出資料夾/檔案可參考 repo 根目錄中的 `result/` 與 `notfound/`。

驗證碼自動化說明
- 專案提供簡單的 OCR 前處理與辨識實作：[`recognizeCaptcha`](src/utils/recognizeCaptcha.ts)。
- 預設流程（[src/fetchLatestPlates.ts](src/fetchLatestPlates.ts)）為「截圖 captcha 並要求人工輸入」，因為網站反爬或辨識準確度可能不穩定。
- 若要改成自動辨識：
  1. 確認已安裝 `tesseract.js` 與 `jimp`（已列於 [package.json](package.json)）。
  2. 在 [src/fetchLatestPlates.ts](src/fetchLatestPlates.ts) 中啟用：
     - 將註解的 `recognizeCaptcha('captcha_raw.jpg', 'captcha.jpg')` 取消註解並調整流程。
  3. 注意：自動化辨識可能需下載或配置 Tesseract 訓練檔（若需更高準確度，請評估訓練資料與預處理參數）。

LINE 推播
- 推播函式在 [src/utils/lineNotify.ts](src/utils/lineNotify.ts)，呼叫 [`sendLineNotify`](src/utils/lineNotify.ts) 即可發送文字訊息。
- 若要測試：執行 [src/testLineNotify.ts](src/testLineNotify.ts)（需在 .env 設定 `CHANNEL_ACCESS_TOKEN`）。

注意事項與建議
- 請遵守網站使用條款與法規，避免過度頻繁請求導致封鎖或影響服務。
- 建議將查詢速度放慢（在查詢迴圈加入適當 delay），並在必要時加入重試與退避機制（exponential backoff）。
- 記錄與輸出：查詢結果已由 [src/queryPlate.ts](src/queryPlate.ts) 分檔儲存，請留意磁碟空間與檔案上限。
- 開發時可參考範例 [src/examples/basic-scraper.ts](src/examples/basic-scraper.ts) 來設定 headless、viewport 等參數。

建置與開發
- 編譯 TypeScript：
  ```sh
  npm run build
  ```
  使用設定：[tsconfig.json](tsconfig.json)
- 以範例執行：
  ```sh
  npm run scrape:example
  ```
  指令定義位於 [package.json](package.json)。

如需針對某個檔案或功能進一步修改（例如自動化 CAPTCHA、增加重試機制、或定期排程實作），請指定目標檔案（例如 [src/fetchLatestPlates.ts](src/fetchLatestPlates.ts) 或 [src/queryPlate.ts](src/queryPlate.ts)），我會提供對應修正建議與程式碼範例。
