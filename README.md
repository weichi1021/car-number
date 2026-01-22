# 買到想要的 CAT 車牌大作戰

本專案以 Puppeteer + TypeScript 實作，支援自動產生 CAT 車牌清單、批次查詢監理站、定期抓取最新車牌、計算差距並推播 LINE 通知。
支援分批儲存查詢結果、記憶體監控、CAPTCHA 人工/自動辨識等功能。

## 環境需求

- Node.js 18+

## 開始使用

```bash
npm install
cp .env.example .env
# 編輯 .env，填入 CHANNEL_ACCESS_TOKEN 等必要參數（如需 LINE 推播）
```

## 專案結構

```
car-number/
├── src/
│   ├── fetchLatestPlates.ts         # 定期抓最新車牌
│   ├── queryPlate.ts                # 批次查詢監理站
│   ├── scheduleSendLineNotify.ts    # 定時推播 LINE
│   ├── utils/
│   │   ├── generatePlateNumbers.ts  # 產生 CAT 車牌清單
│   │   ├── recognizeCaptcha.ts      # CAPTCHA OCR（預設人工）
│   │   ├── lineNotify.ts            # LINE 推播工具
│   │   └── formatDate.ts            # 日期格式化
│   └── examples/
│       └── basic-scraper.ts         # Puppeteer 範例
├── scripts/
│   └── monitor-memory.ts            # 記憶體監控工具
├── result/                          # 查詢結果（有資料）
├── notfound/                        # 查無資料
├── latest_plates.json               # 最新車牌紀錄
├── .env.example
└── README.md
```


## 操作流程

### 1. 產生 CAT 車牌清單

```bash
npx ts-node src/utils/generatePlateNumbers.ts > plates.json
```
- 可用 Node.js 過濾含「4」的號碼：
```bash
node -e "const p=require('./plates.json'); console.log(JSON.stringify(p.filter(x=>/4/.test(x))));" > plates_with_4.json
```

### 2. 批次查詢監理站

```bash
npx ts-node src/queryPlate.ts --input plates_with_4.json
```
- 查詢結果分批寫入 `result/results_X.json`（有資料）與 `notfound/notfound_X.json`（查無資料），每檔 500 筆。

### 3. 定期抓取最新車牌

```bash
npx ts-node src/fetchLatestPlates.ts
```
- 會自動排程於 07:00-22:00，每 15 秒執行一次（可調整）。
- 結果寫入 `latest_plates.json`，僅保留最新 20 筆。

### 4. 計算差距與推播 LINE

- 比較最新車牌與目標（如 CAT-2533）距離，並推播 LINE：
```bash
npx ts-node src/scheduleSendLineNotify.ts
```
- 通知內容與上一則相同則不重複推播，訊息記錄於 `result/line_last_message.txt`。

---

## CAPTCHA 與自動辨識政策

- 預設流程：人工輸入（截圖後手動輸入）。
- 若啟用 `recognizeCaptcha` 自動辨識，請參考 [src/utils/recognizeCaptcha.ts](src/utils/recognizeCaptcha.ts) 並在 PR 說明辨識率、錯誤處理與合法性。


## 常見問題排查

- CAPTCHA 辨識失敗？請改用人工輸入或調整 OCR API 設定。
- 查詢結果分批檔案過多？請定期壓縮或清理 `result/`、`notfound/` 資料夾。

## 範例訊息

```
【車牌通知】
目前最新: CAT-8800 (第 1783 個)
時間: 2025/12/17 14:39:56
目標: CAT-8888
距離目標剩餘: 80 個
```

