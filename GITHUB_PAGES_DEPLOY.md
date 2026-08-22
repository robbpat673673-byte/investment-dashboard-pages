# GitHub Pages 靜態免費版發布指南

本套件位於 `github-pages/`，是**不需要資料庫、登入服務或 API 金鑰**的公開版本。完整的 Manus 全端版本不會被替換；GitHub Pages 只會發布另一套可免費託管的靜態網站。

## 內容與限制

| 保留功能 | 靜態版處理方式 |
| --- | --- |
| 全球行情、31 檔基金、五期報酬與走勢 | GitHub Actions 從公開來源抓取，寫入部署成品中的 `data/dashboard.json`。 |
| 財經 RSS 新聞與來源健康狀態 | 每來源最多 4 則、僅保留 7 日內項目；失敗來源不會阻止其他來源發布。 |
| 搜尋、排序、圖表區間、深色模式 | 在瀏覽器端執行；圖表區間與深色模式會保存於本機。 |
| 自選基金、新聞收藏與稍後閱讀 | 僅保存於該瀏覽器的 `localStorage`，不會跨裝置同步。 |
| 登入、管理面板、SSE 手動刷新、資料庫、AI 摘要／財經小智、通知 | 靜態網站沒有伺服器，因此不提供；介面會明確標示此限制。 |

> 市場與基金資料依各公開來源的可供應交易日為準。基金淨值、假日與海外市場收盤時間可能使「資料截至日」不同於台北當日日期；網站會顯示 JSON 產生時間與每筆資料日期，不將舊資料標示為即時。

## 一次性發布設定

1. 在 GitHub 建立一個**公開**儲存庫，例如 `investment-dashboard-online`；將本專案（不含 `node_modules`、`dist`、`.env` 與 `.git`）推送到預設分支 `main`。
2. 到儲存庫 **Settings → Pages**，在 **Build and deployment** 選擇 **GitHub Actions**。GitHub 的官方 Pages Actions 發布流程說明可參考 [GitHub Pages 官方文件][1]。
3. 到 **Settings → Actions → General**，確認工作流程有讀取權限。隨附的 `.github/workflows/update-static-pages.yml` 已在工作流程層級宣告 `pages: write` 與 `id-token: write`，不需要新增任何金鑰。
4. 進入 **Actions → 更新並發布靜態資料 → Run workflow**，選取預設分支並手動執行一次。第一次執行約會先抓取 31 檔基金、20 組行情與 7 個 RSS 來源，再建置並發布。
5. 部署成功後，GitHub 會在工作流程的 `deploy` 工作顯示公開網址。一般專案網址會是 `https://<帳號>.github.io/<儲存庫名稱>/`。

## 每日資料刷新

工作流程排程為 `0 0 * * *`，即 **UTC 00:00／台北時間每日 08:00**。GitHub 指出排程工作可能在高負載時延後、且只會從預設分支執行；若需要立即更新，請使用 **Run workflow**。[2]

這份工作流程會在每次執行時：

1. 執行 `pnpm run static:refresh`，抓取公開來源並產生 `github-pages/public/data/dashboard.json`；
2. 將 JSON 與靜態前端一起建置為 Pages artifact；
3. 發布 artifact 到 GitHub Pages。

JSON 不會自動提交回 Git；公開網站使用的是當次部署 artifact 中的資料。這可以避免每日無意義的提交紀錄，同時保留 Actions 執行日誌以追查來源失敗。

## Base path 與自訂網域

預設工作流程將 `VITE_BASE_PATH` 設為 `/<儲存庫名稱>/`，適合一般 Project Pages。若使用者名稱／組織名稱同名的 repository（例如 `<帳號>.github.io`）或已設定自訂網域，請將工作流程中的：

```yaml
VITE_BASE_PATH: /${{ github.event.repository.name }}/
```

改為：

```yaml
VITE_BASE_PATH: /
```

自訂網域可在 **Settings → Pages → Custom domain** 設定；依 GitHub 指示設定 DNS 後再啟用 HTTPS。[3] 靜態前端以 `import.meta.env.BASE_URL` 讀取 JSON，因此調整 base path 後資產與資料路徑會一併正確。

## 本機驗證與故障排除

```bash
pnpm install --frozen-lockfile
pnpm run static:refresh
VITE_BASE_PATH=/investment-dashboard-online/ pnpm run static:build
```

若更新器中有來源失敗，仍會輸出可用的其他資料，並把原因寫入 `dashboard.json` 的 `errors`；前端會顯示「部分來源本次未更新」。如果所有內容仍為空，請開啟該次 Actions log，確認公開來源是否暫時拒絕 GitHub runner、RSS 是否變更或市場是否休市。請勿把帳密、資料庫連線字串或 OpenAI 金鑰加入此公開 repository。

[1]: https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
[2]: https://docs.github.com/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule
[3]: https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site

