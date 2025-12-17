# 買到想要的 CAT 車牌大作戰

這份文件幫你把專案工具（Puppeteer + TypeScript）串成一個可操作的流程：產生 CAT 車牌清單、過濾含「4」的候選、批次查詢監理站、定期抓取最新車牌、計算差距並在命中時推播 LINE。

## 快速上手（最短路徑）

1. 安裝依賴

```bash
npm install
```

2.（選用）設定 LINE 推播

```bash
cp .env.example .env
# 編輯 .env，填入 CHANNEL_ACCESS_TOKEN 等必要參數
```

3. 立刻抓一次最新車牌（會輸出 `latest_plates.json`）

```bash
npx ts-node src/fetchLatestPlates.ts
```

## 目錄結構

下面是此 repo 的主要目錄與檔案：

```
car-number/
├── .github/
│   └── copilot-instructions.md
├── src/
│   ├── examples/
│   │   └── basic-scraper.ts
│   ├── fetchLatestPlates.ts
│   ├── queryPlate.ts
│   └── utils/
│       ├── generatePlateNumbers.ts
│       ├── lineNotify.ts
│       └── recognizeCaptcha.ts
├── test/
│   ├── testLineNotify.ts
├── result/
├── notfound/
├── latest_plates.json
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 主要檔案總覽

- `src/utils/generatePlateNumbers.ts`：產生車牌清單（支援輸出 JSON / TXT）。
- `src/queryPlate.ts`：對監理站做批次查詢（輸出到 `result/` 與 `notfound/`）。
- `src/fetchLatestPlates.ts`：定期抓最新車牌並寫入 `latest_plates.json`。
- `src/utils/recognizeCaptcha.ts`：CAPTCHA OCR（需 `tesseract.js` 與 `jimp`，非預設流程）。
- `src/utils/lineNotify.ts`：LINE 推播工具；測試範例為 `test/testLineNotify.ts`。

## 操作流程

1) 產生 CAT 車牌清單並過濾（只保留含 4 的）

- 產生清單（或自行準備 `plates.json`），再用以下命令過濾出含 `4` 的條目：

```bash
node -e "const p=require('./plates.json'); console.log(JSON.stringify(p.filter(x=>/4/.test(x))));" > plates_with_4.json
```

2) 批次查詢監理站（找出尚未被競標的車牌）

- 使用 `src/queryPlate.ts` 查詢 `plates_with_4.json`（若尚未支援 `--input`，可以把清單放在該腳本預期位置或稍作修改使其能讀取外部檔案）。

範例：

```bash
npx ts-node src/queryPlate.ts --input plates_with_4.json
```

- 查詢結果會寫入 `result/`（有資料）與 `notfound/`（查無或未上架）。

3) 定期抓取最新車牌

- 使用 `src/fetchLatestPlates.ts` 並用 crontab 等排程定期執行，例如每天 01:00：

```bash
0 1 * * * cd /你的/專案路徑 && npx ts-node src/fetchLatestPlates.ts >> /var/log/car-number.log 2>&1
```

4) 比較差距（你想要的數字還差多少）

- 定義目標（例：`CAT-8888`），可以採用數字差或 Hamming distance 做比對。建議新增一個小腳本計算與目標的距離並輸出 top-K 候選。

5) 推播 LINE（當達成條件時）

- 在比對結果符合條件（例如差距小於門檻或完全符合）時呼叫 `sendLineNotify`。測試推播：

```bash
npx ts-node test/testLineNotify.ts
```

訊息範例：

```
【車牌通知】
目標: CAT-8888
目前最接近: CAT-8800（差距 4）
```

## 實務建議與注意事項

- 請勿頻繁暴力查詢：在每次查詢加入隨機短暫 delay，並實作重試與 exponential backoff。遵守目標網站使用條款。
- CAPTCHA：預設為人工輸入；若要自動化辨識請先評估辨識準確率與合法性，並在 PR 中說明風險。
- 資料管理：`result/` 與 `notfound/` 會累積，請定期壓縮或歸檔舊資料。

