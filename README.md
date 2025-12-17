# 定期抓取最新車牌選號

本專案支援自動抓取監理服務網最新車牌選號資訊。

## 使用方式

1. 安裝依賴（如尚未安裝）：
   ```sh
   npm install
   ```
2. 執行抓取腳本：
   ```sh
   npx ts-node src/fetchLatestPlates.ts
   ```
   執行後會自動將最新車牌選號資訊儲存於 `latest_plates.json`。

3. 若需定期自動執行，可搭配 crontab 或排程工具。
   例如每天凌晨 1 點自動執行：
   ```sh
   0 1 * * * cd /你的/專案路徑 && npx ts-node src/fetchLatestPlates.ts
   ```

> 註：如需調整抓取欄位，請依實際網頁結構修改 `src/fetchLatestPlates.ts` 內的 selector。
# Puppeteer Crawler 專案

本專案是一個使用 Node.js + TypeScript + Puppeteer 的網頁爬蟲範例。

## 目錄結構

```
car-number/
├── .github/
│   └── copilot-instructions.md
├── src/
│   └── examples/
│       └── basic-scraper.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## 安裝步驟

1. 安裝依賴套件：
   ```bash
   npm install
   ```
2. 複製環境變數範例檔並修改：
   ```bash
   cp .env.example .env
   # 編輯 .env 檔案，設定目標網址與爬蟲參數
   ```
3. 執行範例爬蟲腳本：
   ```bash
   npm run scrape:example
   ```

## 主要技術
- Node.js
- TypeScript
- Puppeteer
- dotenv (環境變數管理)

## 注意事項
- 請勿用於非法用途，僅供學術或合法資料蒐集。
- 複雜爬蟲請參考 src/examples/basic-scraper.ts 內註解。

## 聯絡方式
如有問題請於 GitHub Issue 留言。
