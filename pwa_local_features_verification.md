# 公開靜態版 PWA、本機提醒與群組驗證

驗證時間：2026-08-23（台北時間）

## 生產建置資產

以靜態建置預覽檢查，首頁、`manifest.webmanifest` 與 `sw.js` 均回傳 HTTP 200；Service Worker 的 `Content-Type` 為 JavaScript。完整 Vitest、TypeScript 與靜態 Vite 建置後均確認 manifest 與 Service Worker 已輸出至 `github-pages/dist`。

## 瀏覽器檢查

瀏覽器自動化預覽初次顯示空白，但沒有任何 console 錯誤；同一預覽埠的 HTML、manifest 與 Service Worker 均可由 HTTP 取得。此為預覽工具初始畫面差異，後續仍需以重新導覽或另一個正式預覽埠確認完整 UI 與 Service Worker 的瀏覽器註冊狀態。

根因確認為 GitHub Pages 專用的 `/investment-dashboard-pages/` 基底路徑不適用於本機根路徑預覽；改以根路徑重新建置後，正式預覽完整載入。畫面顯示「可安裝 · 離線可用」、安裝與離線瀏覽說明、群組篩選、基金淨值門檻設定、新群組建立，以及每張基金卡的群組指派控制。

在正式根路徑預覽中，`navigator.serviceWorker.getRegistrations()` 回傳一個 active Service Worker，scope 為網站根目錄。Cache Storage 中確認已有 `/`、`/index.html`、`/manifest.webmanifest`、`/data/dashboard.json`、JavaScript bundle 與 CSS bundle，符合最近應用程式殼層與公開資料快照的離線瀏覽需求。

瀏覽器在符合安裝條件後發出安裝事件，頁首狀態由「可安裝 · 離線可用」切換為「安裝到裝置」按鈕。群組建立的自動化測試已通過；瀏覽器自動化在頁面捲動後的元素索引重排使首次建立群組操作未完成，後續以 DOM 直接輸入方式補做群組與提醒實機驗證。

以 DOM 輸入 `核心持股` 並等待前端狀態更新後提交，`static-dashboard:favorite-groups` 成功寫入含群組名稱、空基金清單與建立時間的 JSON。這確認群組資料由目前瀏覽器本機保存，而非傳送到伺服器。

再以最新公開 JSON 的「野村台灣運籌基金」設定高於等於 `465.93` 的本機門檻後重新載入，畫面顯示「基金淨值提醒」橫幅與 `465.94 ≥ 465.93` 的觸發條件；群組篩選中同時顯示「核心持股（0）」並在各基金卡提供可勾選的群組指派選項。
