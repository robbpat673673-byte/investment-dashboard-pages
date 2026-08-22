# Netlify 手動部署指南（外部 MySQL 版）

## 重要限制

本專案原本依賴 Manus OAuth、Forge LLM／儲存與 Heartbeat。此遷移套件改用 **Netlify Identity**、外部 MySQL、Netlify Functions 與外部 OpenAI 相容 LLM。拖曳原始碼 ZIP 造成 404 的原因，是網站根目錄沒有可發布的 `index.html`；而且未建置的原始碼不會包含可執行的 Functions。

> 建議使用 Netlify CLI 手動部署。這仍屬手動上傳，但會正確建置前端與 Functions；只拖曳原始碼 ZIP 不適合完整後端網站。

## 部署前準備

| 項目 | 您需要準備的值 | 用途 |
| --- | --- | --- |
| 外部 MySQL | `DATABASE_URL` | 保留基金、行情、RSS、摘要、刷新紀錄與使用者資料 |
| OpenAI 相容服務 | `OPENAI_API_KEY`，可選 `OPENAI_BASE_URL`／`OPENAI_MODEL` | 財經小智、新聞摘要與每日摘要 |
| Netlify Identity | 在後台啟用 Identity、建立第一位使用者 | 取代 Manus OAuth |
| 管理者角色 | 將第一位管理者設定為 `admin` | 控制立即刷新與每日摘要產生 |

## 建立 MySQL 資料庫

1. 建立一個 MySQL 8 相容資料庫，並允許 Netlify Functions 對外連線。
2. 將現有 `drizzle/schema.ts` 對應的 migration 套用到該資料庫。資料遷移前，請先由原站匯出資料庫備份。
3. 在 Netlify 後台的 **Project configuration → Environment variables** 設定 `DATABASE_URL`，格式為 `mysql://USER:PASSWORD@HOST:3306/DATABASE`。

## 設定 Identity 與管理者

1. 開啟 **Project configuration → Identity**，啟用 Identity，並把 Registration 設為 **Invite only**。
2. 在 **Identity → Users** 邀請自己的電子郵件地址，完成登入後，在使用者設定將角色加入 `admin`。
3. 管理者角色變更會在重新登入或 token refresh 後生效。

## 設定環境變數

複製 `.env.netlify.example` 的變數名稱至 Netlify 後台。不要將任何密鑰放入前端或上傳 ZIP。至少設定：

```text
DATABASE_URL=...
OPENAI_API_KEY=...
VITE_RUNTIME_TARGET=netlify
```

## 使用 Netlify CLI 手動發布

在自己的電腦解壓本遷移套件後執行：

```bash
pnpm install
pnpm run build:netlify
npx netlify login
npx netlify link --name resilient-kheer-beb4f9
npx netlify deploy --build --prod
```

執行後先開啟 `/api/health`。若回傳 `{"ok":true}`，表示 Netlify Function 已能連接外部 MySQL。然後登入 Identity，檢查首頁、基金詳情、觀測站、新聞摘要與管理刷新。

## 每日更新與手動刷新

`netlify/functions/daily-refresh.mts` 使用 UTC cron `0 0 * * *`，即台北時間每日 08:00。因完整刷新通常超過一般排程 Function 的 30 秒限制，套件將其標示為 Background Function。手動刷新則呼叫 `/api/admin/refresh`，會先回傳 202，實際完成狀態由 `/api/admin/refresh-status` 讀取 MySQL 的 `refresh_runs`。

## 尚待外部設定後驗證的項目

此套件已提供 API、Identity、背景刷新與排程骨架；在尚未取得外部 MySQL／OpenAI 值前，無法對實際資料庫執行 migration、驗證資料讀寫或發布至您的 Netlify 網址。既有 SSE 即時進度與中止功能在 Netlify Background Function 架構下需改為資料庫工作狀態輪詢，不能直接沿用平台內記憶體取消控制器。

