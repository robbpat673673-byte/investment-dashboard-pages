# GitHub Pages 公開部署驗證

## Repository 與工作流程

公開原始碼已同步至 [robbpat673673-byte/investment-dashboard-pages](https://github.com/robbpat673673-byte/investment-dashboard-pages)，預設分支為 `main`。Repository 內含 `.github/workflows/update-static-pages.yml`，工作流程名稱為「更新並發布靜態資料」，並提供 `workflow_dispatch` 與每日 UTC 00:00（台北時間 08:00）排程。

首次手動執行（run `32602869700`）於建置階段失敗，原因為 `pnpm/action-setup@v4` 同時在 workflow 指定 `version: 10`、而 `package.json` 指定 `pnpm@10.4.1`。已移除 workflow 重複版本欄位，提交 `e7ddf7b` 至公開 repository。

## 成功部署

修正後，已以 `workflow_dispatch` 執行 run [`32602967496`](https://github.com/robbpat673673-byte/investment-dashboard-pages/actions/runs/32602967496)。`build` 工作（33 秒）與 `deploy` 工作（8 秒）均成功；前者完成安裝、公開資料更新、靜態建置、Pages artifact 上傳，後者完成 Pages 發布。GitHub 顯示的 Node 20 遷移訊息為 warning，並未影響本次執行成功。

公開網站已驗證可載入：[https://robbpat673673-byte.github.io/investment-dashboard-pages/](https://robbpat673673-byte.github.io/investment-dashboard-pages/)。頁面顯示 GitHub Actions 產生時間 `2026/8/22 22:38`、全球市場、基金淨值與區間報酬、RSS 新聞、深色模式、基金搜尋／排序與本機收藏控制；`data/dashboard.json` 已隨 Pages artifact 正常提供。

另直接開啟 [`/investment-dashboard-pages/data/dashboard.json`](https://robbpat673673-byte.github.io/investment-dashboard-pages/data/dashboard.json)，確認 JSON 成功回應，`generatedAt` 為 `2026-08-22T22:38:09.226Z`，並包含 `markets`、基金分類、RSS 新聞與來源健康資訊。這也驗證 Vite 的 repository base path 與公開資料相對路徑設定正確。
