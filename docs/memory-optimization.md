# 記憶體優化指南

## 問題診斷

每 30 秒執行一次爬蟲導致記憶體持續增長的主要原因：

### 1. Puppeteer Browser 未關閉
- **原問題**：每次執行 `fetchLatestPlates()` 都會啟動新的 browser，但沒有關閉
- **影響**：每個 browser 實例佔用 50-150 MB 記憶體，30 秒累積一次會快速耗盡記憶體

### 2. 瀏覽器快取與資源累積
- **原問題**：Puppeteer 的 devtools 和快取會佔用額外記憶體
- **影響**：長時間運行後累積大量未清理的資源

### 3. 圖片檔案重複寫入
- **原問題**：每次都將驗證碼截圖寫入磁碟
- **影響**：雖然記憶體影響較小，但仍造成不必要的 I/O 開銷

---

## 已實施的優化方案

### ✅ 方案 1：共用 Browser 實例

**核心改進**：
- 使用全域變數 `sharedBrowser` 在整個生命週期中共用單一 browser
- 僅在 browser 斷線或需要重啟時才建立新實例
- 每次查詢後關閉 page，但保留 browser

**預期效果**：
- 記憶體使用從線性增長變為穩定狀態
- 減少 80-90% 的記憶體佔用
- 加快查詢速度（避免重複啟動 browser）

**實作重點**：
```typescript
let sharedBrowser: puppeteer.Browser | null = null;

async function ensureBrowser(): Promise<puppeteer.Browser> {
  if (!sharedBrowser || !sharedBrowser.connected) {
    sharedBrowser = await puppeteer.launch(launchOptions);
  }
  return sharedBrowser;
}
```

### ✅ 方案 2：定期重啟 Browser

**核心改進**：
- 每執行 50 次查詢後自動重啟 browser
- 防止長時間運行造成的記憶體洩漏累積

**實作重點**：
```typescript
const MAX_BROWSER_USAGE = 50;
let browserRestartCount = 0;

// 查詢後增加計數
browserRestartCount++;
if (browserRestartCount >= MAX_BROWSER_USAGE) {
  await closeBrowser(); // 觸發下次重建
}
```

### ✅ 方案 3：優化 Puppeteer 啟動參數

**新增參數**：
```typescript
args: [
  '--disable-dev-shm-usage',        // 避免共享記憶體不足
  '--disable-gpu',                   // 停用 GPU 加速
  '--disable-software-rasterizer',   // 停用軟體光柵化
]
```

**移除參數**：
- `devtools: false` - 關閉開發者工具減少記憶體

### ✅ 方案 4：頁面資源清理

**核心改進**：
```typescript
await page.close(); // 每次查詢後關閉頁面
```

### ✅ 方案 5：優雅的關閉處理

**核心改進**：
- 監聽 SIGINT / SIGTERM 訊號
- 程式結束時自動清理 browser 和暫存檔案

---

## 進階優化建議

### 選項 A：降低查詢頻率（最有效）

**建議調整**：
```typescript
// 從 30 秒改為 2-5 分鐘
scheduleTaskWithWindow(runOnce, { 
  startHour: 7, 
  endHour: 22, 
  intervalMs: 2 * 60 * 1000  // 2 分鐘
});
```

**理由**：
- 車牌號碼更新頻率通常不會太快
- 降低對目標網站的負擔（禮貌性爬蟲）
- 大幅減少記憶體與 CPU 使用

### 選項 B：限制運行時段

**建議調整**：
```typescript
// 只在熱門時段執行
scheduleTaskWithWindow(runOnce, { 
  startHour: 9,   // 上午 9 點
  endHour: 18,    // 下午 6 點
  intervalMs: 1 * 60 * 1000 
});
```

### 選項 C：增加錯誤處理與斷路器

當連續失敗多次時暫停查詢：
```typescript
let consecutiveErrors = 0;
const MAX_ERRORS = 5;
const PAUSE_DURATION = 10 * 60 * 1000; // 10 分鐘

async function runOnce() {
  try {
    await fetchLatestPlates();
    consecutiveErrors = 0; // 重置錯誤計數
  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors >= MAX_ERRORS) {
      console.log(`連續失敗 ${MAX_ERRORS} 次，暫停 10 分鐘...`);
      await new Promise(resolve => setTimeout(resolve, PAUSE_DURATION));
      consecutiveErrors = 0;
    }
  }
}
```

### 選項 D：使用輕量級 HTTP 請求替代 Puppeteer

如果目標網站支援，可以考慮：
```typescript
import axios from 'axios';

// 使用 axios 而非完整瀏覽器
const response = await axios.get(url);
```

**注意**：需要分析網站是否可以不用完整瀏覽器就能查詢

---

## 記憶體監控工具

### 使用方法

```bash
# 每 10 秒記錄一次記憶體狀態（預設）
npx ts-node scripts/monitor-memory.ts

# 自訂間隔（例如 5 秒）
npx ts-node scripts/monitor-memory.ts 5
```

### 同時監控爬蟲與記憶體

開兩個終端機視窗：

```bash
# 終端機 1：執行爬蟲
npx ts-node src/fetchLatestPlates.ts

# 終端機 2：監控記憶體
npx ts-node scripts/monitor-memory.ts 10
```

---

## 驗證優化效果

### 測試步驟

1. **基準測試**（優化前）：
   ```bash
   # 記錄執行 10 分鐘的記憶體變化
   npx ts-node scripts/monitor-memory.ts 30 > baseline.log &
   npx ts-node src/fetchLatestPlates.ts
   ```

2. **優化後測試**：
   ```bash
   # 使用相同條件測試優化版本
   npx ts-node scripts/monitor-memory.ts 30 > optimized.log &
   npx ts-node src/fetchLatestPlates.ts
   ```

3. **比較結果**：
   - 記憶體增長率應該大幅降低（< 5% / 小時）
   - RSS 應該穩定在 150-250 MB 範圍
   - 不應該有持續線性增長的趨勢

### 預期結果

**優化前**：
```
起始: 120 MB → 10 分鐘後: 800 MB
增長率: +566%
```

**優化後**：
```
起始: 120 MB → 10 分鐘後: 180 MB
增長率: +50% (大部分為正常波動)
```

---

## 生產環境建議

### 1. 使用 PM2 管理進程

```bash
npm install -g pm2

# 啟動爬蟲（自動重啟）
pm2 start "npx ts-node src/fetchLatestPlates.ts" --name car-crawler --max-memory-restart 500M

# 監控
pm2 monit
```

### 2. 設定記憶體上限

在 [package.json](package.json) 增加：
```json
{
  "scripts": {
    "start:fetch": "node --max-old-space-size=512 -r ts-node/register src/fetchLatestPlates.ts"
  }
}
```

### 3. 定期清理舊檔案

```bash
# 每天清理 30 天前的結果檔案
find result/ -name "*.json" -mtime +30 -delete
find notfound/ -name "*.json" -mtime +30 -delete
```

---

## 問題排查

### 記憶體仍持續增長？

1. **檢查是否有其他 browser 實例未關閉**：
   ```bash
   ps aux | grep chrome
   ps aux | grep chromium
   ```

2. **強制關閉殘留進程**：
   ```bash
   pkill -9 chrome
   pkill -9 chromium
   ```

3. **檢查 Puppeteer 版本**：
   ```bash
   npm list puppeteer
   # 建議使用最新穩定版
   npm install puppeteer@latest
   ```

### Browser 無法啟動？

可能是系統資源不足，嘗試：
```typescript
// 降低並發數
args: ['--max-old-space-size=256']
```

---

## 參考資源

- [Puppeteer 記憶體優化最佳實踐](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#tips)
- [Node.js 記憶體管理](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PM2 進程管理](https://pm2.keymetrics.io/)
