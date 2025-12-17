# 車牌查詢自動化專案 — Copilot / 開發者 指令與守則

目的
------
此文件提供給 AI 生成工具（例如 Copilot）與專案開發者使用的操作與編輯守則，讓自動化建議與人工修改保持一致、可驗證且安全。

適用範圍
------
- 可修改範圍：`src/`、`src/utils/`、`src/examples/`、`scripts/`（新增工具腳本）。
- 受限制（請勿自動修改）：`.env`、`.env.example`、`package.json`（除非明確要求）、`README.md`（由 maintainers 決定是否更新）以及任何含機密的檔案。

基本守則（給 AI 與貢獻者）
------
1. 變更要小且可驗證：優先做小幅度的修改，並附上測試或示範命令（至少一個 happy-path）。
2. 不要引入秘密：不得在程式碼中寫入 API keys、token 或其他敏感資訊。
3. 保留原有程式風格：請遵守現有 TypeScript 風格（不要整段 reformat 檔案，除非需要）並通過現有 lint/type 檢查（若有）。
4. 網路請求要有禮貌：任何對網站的自動化請求都必須包含 rate-limit（delay）、錯誤重試與退避機制，且在 PR 中說明預期流量與失敗處理。
5. 修改爬蟲/查詢程式時，請在 PR 說明中列出測試方法與可重現流程。

CAPTCHA 與自動辨識政策
------
- 預設流程：`src/fetchLatestPlates.ts` 為人工輸入 CAPTCHA（截圖後手動輸入）。
- 若提案要啟用 `recognizeCaptcha` 自動辨識，PR 必須包含：
  - 甄別辨識準確率的實驗結果（範例圖片與成功率）
  - 會怎麼處理錯誤辨識（例如辨識失敗 fallback 到人工）
  - 合法性聲明：確認該網站政策允許此種自動化行為。

PR / Commit 要求
------
- PR 標題需描述變更目的（例如：`feat: 支援 queryPlate --input`）。
- 若是功能性變更，請附上示範指令與輸出範例，並在可能的情況下加一個小測試或 sample output。  
- 重要行為（例如改 rate limit、加上自動辨識）需在 PR 描述標明風險與防護措施。

範例 prompt（給 AI）
------
當你要請 Copilot 生成/修改 `src/queryPlate.ts` 時，可帶上：

"請在 `src/queryPlate.ts` 中加入讀取 `--input` 參數的功能（可接受 JSON 檔案或純文字檔），並在查詢迴圈加入一個 `delayMs` 參數與最多 3 次重試邏輯；不要更改其他檔案，記得加上簡單的 log 輸出與使用說明。"

常見情境處理
------
- 日誌與輸出：請將查詢結果寫到 `result/`（找到）與 `notfound/`（未找到），並在 PR 中標示檔名模式（例如 `results_*.json`、`notfound_*.json`）。
- 效能與磁碟：大量查詢會產生大量檔案，建議實作檔案分批或壓縮策略。

聯絡與維護
------
如需例外許可（例如修改 `.env.example` 或 `package.json`），請在 PR 中標註 maintainer 並取得批准。

---

此檔案為機器與維護者協作的規範；若有專案流程變動，請同步更新本檔以維持一致性。
