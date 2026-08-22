# 新聞來源與診斷介面驗證

## 公開資料契約

靜態 JSON 的每則新聞含 `source` 與 `publishedAt`。來源健康資料保留 `source`、`status`、`acceptedCount`，並可選擇提供 `latencyMs` 與 `detail`；靜態前端以這些欄位顯示來源標籤、發布時間、最新新聞時間與資料同步時間，而不虛構來源或錯誤內容。

## 預覽驗證

2026-08-22 的本機靜態預覽已顯示新聞可信度卡片：已納入 6 個來源、最新新聞時間 `2026/8/22 12:30` 與 GitHub Actions 同步時間 `2026/8/22 12:45`。每篇新聞都有「來源」標籤與「發布」時間。

實際資料中，華爾街日報・市場為 `empty`，可展開的「資料來源診斷」呈現「沒有新資料」、`最近 7 日沒有內容通過新鮮度條件`、接受 0 則、延遲 2544 ms 與檢查時間。這與更新器的七日新鮮度規則一致，未將沒有可接受項目誤稱為技術錯誤。

完整 TypeScript 檢查、靜態 Pages build 及 Vitest **33** 個測試檔／**120** 個案例均通過；其中靜態 App 元件測試覆蓋來源 `error` 詳細原因、延遲、展開互動與全域更新錯誤。

## 公開 Pages 驗證

GitHub Actions run [`32604006629`](https://github.com/robbpat673673-byte/investment-dashboard-pages/actions/runs/32604006629) 已成功完成 build 與 deploy。公開網站 [https://robbpat673673-byte.github.io/investment-dashboard-pages/](https://robbpat673673-byte.github.io/investment-dashboard-pages/) 已載入本輪介面，資料同步時間為 `2026/8/22 23:00`；新聞來源與發布時間標籤、三張可信度卡片，以及華爾街日報・市場的可展開「沒有新資料」診斷均可見。明細包含 0 則接受項目、819 ms 延遲及該次檢查時間。
