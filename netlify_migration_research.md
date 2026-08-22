# Netlify 遷移研究記錄

## 官方文件重點

| 範圍 | 已確認事項 | 來源 |
| --- | --- | --- |
| 手動部署 | 手動建立部署不會執行建置命令；拖曳部署時需提供可發布的檔案或登入後讓平台偵測框架建置。完整含 Functions 的手動部署應使用 Netlify CLI 或 API。 | [Create deploys](https://docs.netlify.com/deploy/create-deploys/) |
| Functions | 函式採用 `Request`／`Response` 介面，可設定自訂 `path`。串流回應可使用 `ReadableStream`，但串流函式上限為 60 秒與 20 MB。 | [Functions API reference](https://docs.netlify.com/build/functions/api/) |
| 排程 | 排程 Functions 使用 UTC 五欄 cron。排程函式上限為 30 秒，較長工作應改為背景函式或拆分處理；已發布版本可在 Functions 頁執行 Run now。 | [Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/) |
| 背景工作 | Background Functions 會先回應 `202`，背景執行最長 15 分鐘，逾時或失敗會由平台重試；但不支援回應串流。 | [Background Functions](https://docs.netlify.com/build/functions/background-functions/) |
| Identity | `@netlify/identity` 可在 Functions 中取得使用者與角色；`app_metadata.roles` 包含管理者角色，應在伺服器端做 admin 驗證。 | [Use Identity in functions](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/) |
| 登入 | Netlify Identity 可設為 Invite only，於後台邀請管理者；登入與註冊可由前端套件或伺服器端函式完成。 | [Registration and login](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/registration-login/) |
| 原專案部署阻塞點 | 原始碼 ZIP 的首頁為 `client/index.html`，沒有根目錄可直接發布的 `index.html`；且目前專案依賴 Express、tRPC、MySQL、Manus OAuth、Forge LLM、S3 代理、SSE 與 Heartbeat，不能僅拖曳原始碼 ZIP 後正常運作。 | 專案檔案與部署診斷 |

## 遷移設計結論

本遷移保留 MySQL 與 Drizzle 資料模型，以 Netlify Functions 提供 API。登入改由 Netlify Identity 管理，管理者權限以 `app_metadata.roles` 的 `admin` 角色驗證。每日台北時間 08:00 的資料刷新需要換算成 UTC 00:00；因既有刷新實測約 57 秒，不能直接依賴 30 秒排程函式完成，應改由排程函式呼叫背景刷新工作。手動刷新改為先啟動背景工作，再由前端輪詢資料庫內的刷新紀錄；原 SSE 只可作為 60 秒內的輔助通知，不能作為背景工作完成狀態的唯一來源。
