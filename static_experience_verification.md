# 靜態版品牌與載入體驗驗證

## 本機預覽觀察

2026-08-22：最初以 GitHub Pages 子路徑 artifact 配合本機 Vite preview 時，資產 base path 不匹配而只顯示空白頁，console 無執行錯誤。改以根路徑 artifact 重新建置後，靜態預覽可正常呈現完整資料頁；頁首深色模式按鈕顯示太陽圖案與「淺色模式」，全球市場、基金與新聞面板均使用深色配色且文字對比清楚。這驗證空白頁是本機 preview 路徑差異，而非 React 入口或主題初始化錯誤。

型別檢查、32 個 Vitest 測試檔／117 個案例與靜態 Vite build 已通過。下一步將以更新後 GitHub Pages artifact 重新部署並檢查 metadata 與公開頁面。
