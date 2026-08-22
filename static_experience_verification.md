# 靜態版品牌與載入體驗驗證

## 本機預覽觀察

2026-08-22：最初以 GitHub Pages 子路徑 artifact 配合本機 Vite preview 時，資產 base path 不匹配而只顯示空白頁，console 無執行錯誤。改以根路徑 artifact 重新建置後，靜態預覽可正常呈現完整資料頁；頁首深色模式按鈕顯示太陽圖案與「淺色模式」，全球市場、基金與新聞面板均使用深色配色且文字對比清楚。這驗證空白頁是本機 preview 路徑差異，而非 React 入口或主題初始化錯誤。

型別檢查、32 個 Vitest 測試檔／117 個案例與靜態 Vite build 已通過。下一步將以更新後 GitHub Pages artifact 重新部署並檢查 metadata 與公開頁面。

## 公開部署驗證

更新提交 `45e7731` 已透過 GitHub Actions run `32603605163` 成功發布；build 與 deploy 均完成。公開頁面以 cache-busting 參數載入時顯示資料更新時間 `2026/8/22 22:51`，可由月亮「深色模式」按鈕切換為太陽「淺色模式」，並在瀏覽器保存偏好。

部署 HTML 已包含 favicon、Open Graph `title`／`image` 與 Twitter large-image metadata。原創 favicon 與橫向社群預覽圖使用專案受控儲存 URL；兩個網址皆收到公開轉址回應。元件測試另覆蓋 JSON 尚未回應時的骨架屏、資料完成後的內容切換，以及深色偏好保存。最終檢查為 TypeScript 成功、**33** 個 Vitest 測試檔／**119** 個案例通過，且 GitHub Pages base path build 成功。
