# GitHub Pages 靜態版驗證記錄

## 2026-08-22 本機資料更新與建置

| 檢查項目 | 結果 |
| --- | --- |
| 公開資料更新器 | 成功取得 **20** 組市場、**31** 檔基金與 **19** 則 RSS 新聞；`errors = 0`。 |
| JSON 產生時間 | `2026-08-22T12:38:38.763Z`。每個市場與基金物件都包含來源資料日期與抽樣歷史序列。 |
| Pages build | `VITE_BASE_PATH=/investment-dashboard-online/ pnpm run static:build` 成功；產物包含 `index.html` 與 `data/dashboard.json`。 |
| TypeScript | `pnpm exec tsc --noEmit` 成功，已納入 `github-pages/src`。 |
| Vitest | 靜態 JSON base path、資料契約、歷史區間裁切與基金排序測試納入完整測試套件。 |
| 最終回歸 | `pnpm exec tsc --noEmit`、**29** 個 Vitest 測試檔／**110** 個案例、`pnpm run static:refresh` 與 Pages build 全數通過。 |
| RSS 顯示品質 | 更新器已清理解碼 `&apos;`、`&#x2019;` 等常見 HTML 實體；最終 JSON 檢查結果為 0 個 `&apos;`。 |
| 交付套件 | 已建立 `investment-dashboard-github-pages.zip`，內含 Actions workflow、靜態前端、最新公開 JSON、發布指南與驗證紀錄；不含 `.env`、`node_modules`、`.git` 與 `dist`。 |

## 預覽畫面檢查

以 `VITE_BASE_PATH=/investment-dashboard-online/` 開啟 `/investment-dashboard-online/` 預覽，桌面畫面已實際載入 `dashboard.json`：頁首顯示 2026/08/22 12:43 的產生時間、8 張全球市場卡、國內基金搜尋／排序／自選控制、基金走勢區間按鈕，以及 RSS 來源篩選、新聞收藏與稍後閱讀控制。版面在中等寬度下仍維持四欄市場與三欄基金的可讀卡片；窄螢幕 CSS 已切換為單欄新聞與單欄卡片、可換行控制列。

## 設計邊界

靜態版僅使用公開資料來源與瀏覽器 `localStorage`；沒有資料庫、認證、伺服器 API 或任何機密。每日排程由 GitHub Actions 執行，具來源失敗隔離與來源健康資訊。GitHub Pages 尚未連接到使用者的 GitHub repository，因此公開網址與首次實際 Actions 執行結果需在依 `GITHUB_PAGES_DEPLOY.md` 推送後確認。
