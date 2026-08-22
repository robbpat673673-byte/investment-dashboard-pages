# 替代部署方案研究記錄

| 方案 | 可保留功能 | 主要限制 | 官方來源 |
| --- | --- | --- | --- |
| 保留目前受管版本 | 現有 MySQL、tRPC、SSE、取消、每日刷新、登入與資料庫功能皆無需重寫 | 網址與託管維持在目前平台，非 Netlify | 專案現況 |
| GitHub Pages + 靜態資料 | 公開行情、基金表格、圖表與新聞閱讀；可用 GitHub Actions 建置／發布 | 無伺服器 API、登入、MySQL、即時刷新、手動管理、AI 功能；每日資料需另用排程產生 JSON 並提交 | [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) |
| Cloudflare Pages + Workers + D1 | 公開網站、Functions、SQLite 資料庫、登入可另接 Access／第三方；適合小型讀取量 | 需將 MySQL／Drizzle mysql schema 與 query 改寫為 SQLite/D1；現有 SSE／取消與 57 秒刷新需重新設計 | [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Supabase + 靜態前端／Functions | PostgreSQL、Auth、Storage、Realtime 可整合，減少分散服務 | 需從 MySQL 改為 PostgreSQL，重寫 Drizzle schema／查詢；Free 方案 500 MB、閒置一週會暫停 | [Supabase pricing](https://supabase.com/pricing) |
| Netlify + Aiven MySQL（現行遷移） | 大部分資料模型可保留；Netlify Identity、Functions、每日背景刷新可接入 | 需設定外部 MySQL／LLM；Free 資料庫 1 GB／1 GB RAM／單節點，閒置可能休眠；Background Function 不支援原 SSE | [Netlify pricing](https://www.netlify.com/pricing/) · [Aiven free MySQL](https://aiven.io/free-mysql-database) |

## 關鍵事實

- Cloudflare D1 Free 提供每日 500 萬列讀取、10 萬列寫入與 5 GB 總儲存；超過日限額時，D1 查詢會回傳錯誤直到下一個 UTC 日重置。
- Supabase Free 有 500 MB 資料庫、50,000 MAU、5 GB egress、1 GB Storage，但專案閒置一週會暫停。
- GitHub Pages 工作流程可自訂前端建置與 artifact 發布，但其本質為靜態網站，不能取代本專案現有的伺服器端資料刷新、Identity、tRPC 與 MySQL。
