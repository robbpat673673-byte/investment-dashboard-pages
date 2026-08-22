# 外部 MySQL 與 Netlify 設定指南

本指南會把投資儀表板從原本的託管環境搬到 Netlify。建議先完成資料庫與環境變數，再手動發布遷移套件。**密碼、資料庫連線字串與 API 金鑰只貼在服務商後台，不要貼在聊天室、GitHub 或 ZIP 檔。**

> 最短路徑是：建立 Railway MySQL → 取得公開連線字串 → 匯入資料結構 → 在 Netlify 設定三個環境變數 → 啟用 Identity → 用 Netlify CLI 發布。

## 1. 建立外部 MySQL

以下以 Railway MySQL 為例，因為它會提供外部 TCP 連線字串。您也可以使用已有的雲端 MySQL 或 Aiven，但必須讓 Netlify Functions 能連線到資料庫。

| 選項 | 適用情況 | 您最後需要取得的值 |
| --- | --- | --- |
| **Railway MySQL** | 希望快速建立一個 MySQL 服務 | 啟用 Public Access 後的 `MYSQL_PUBLIC_URL` |
| **Aiven MySQL** | 想使用受管 MySQL 服務與其連線設定 | 主機、連接埠、資料庫、帳號與密碼 |
| **既有 MySQL** | 已有公司或個人 MySQL 主機 | 可從網際網路連線的 `mysql://...` URL |

### Railway 操作步驟

1. 登入 [Railway](https://railway.app/)，選擇 **New Project**。
2. 點選 **New**，選擇 **Database → MySQL**，等待服務部署完成。
3. 點選 MySQL 服務，前往 **Settings → Networking**，加入 **Public Access**。
4. 在服務的 **Variables** 找到 `MYSQL_PUBLIC_URL`，按複製。這就是之後要使用的資料庫連線字串。

> Railway 的 MySQL 預設是私有網路；外部 Netlify Functions 必須使用開啟 Public Access 後產生的 `MYSQL_PUBLIC_URL`，而不是僅供同一 Railway 專案使用的內部連線值。[1]

### 建立資料表

在您的電腦解壓遷移 ZIP 後，打開終端機並執行以下命令。請把尖括號內容換成真正的連線字串；不要把它存入 Git。

```bash
cd investment-dashboard-online
pnpm install

# macOS / Linux
export DATABASE_URL='mysql://使用者:密碼@主機:連接埠/資料庫'

# Windows PowerShell
# $env:DATABASE_URL='mysql://使用者:密碼@主機:連接埠/資料庫'

# 將目前的 Drizzle schema 產生／套用至外部 MySQL
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

如果您希望把目前儀表板內的基金、歷史淨值、新聞與摘要一起搬過去，請先從原資料庫匯出 SQL 備份，然後在新的 MySQL 匯入。只建立 schema 時，Netlify 站點可以啟動，但首頁會是空資料，直到第一次刷新完成。

## 2. 在 Netlify 設定環境變數

開啟您的 Netlify 專案 `resilient-kheer-beb4f9`，依序進入 **Project configuration → Environment variables**，新增下列變數。設定後請觸發一次新的部署，讓 Functions 讀取新值。

| 變數 | 要填的值 | 是否機密 |
| --- | --- | --- |
| `DATABASE_URL` | Railway 的 `MYSQL_PUBLIC_URL` 或其他外部 MySQL 連線字串 | 是 |
| `OPENAI_API_KEY` | 您的 OpenAI／相容模型服務 API 金鑰 | 是 |
| `VITE_RUNTIME_TARGET` | `netlify` | 否 |
| `OPENAI_BASE_URL` | 可選；預設是 OpenAI chat completions URL | 視服務而定 |
| `OPENAI_MODEL` | 可選；預設 `gpt-5-mini` | 否 |

請勿將 `DATABASE_URL` 或 `OPENAI_API_KEY` 寫進 `client/`、`.env.netlify.example`、Git 或任何可公開下載的檔案。

## 3. 啟用 Netlify Identity 與管理者

1. 在 Netlify 專案進入 **Project configuration → Identity**，啟用 Identity。
2. 在 **Registration** 將註冊方式設為 **Invite only**，避免任何訪客自行建立帳號。
3. 在 **Identity → Users** 邀請您的電子郵件，完成信件中的登入／設定密碼。
4. 打開該使用者的設定，加入 `admin` 角色，再登出並重新登入。

Netlify Functions 會從 Identity JWT 的 `app_metadata.roles` 讀取 `admin`，用來限制「立即執行一次」、每日摘要產生與其他管理操作。[2]

## 4. 手動發布至 Netlify

請使用遷移 ZIP 內的專案資料夾，而不是先前的原始碼 ZIP。完整網站含 Functions，建議以 CLI 發布；單純拖曳原始碼 ZIP 可能不會正確建置或部署 Functions。[3]

```bash
cd investment-dashboard-online
pnpm install
pnpm run build:netlify
npx netlify login
npx netlify link --name resilient-kheer-beb4f9
npx netlify deploy --build --prod
```

當命令顯示成功後，先開啟：

```text
https://resilient-kheer-beb4f9.netlify.app/api/health
```

看到 `{"ok":true,"runtime":"netlify"...}` 代表 Function 已可連線 MySQL。接著開啟首頁、登入 Identity，並以管理者身份測試「立即執行一次」。每日排程使用 UTC `0 0 * * *`，對應台北時間每日 08:00。[4]

## 5. 完成後回覆我

請回覆下列其中一種狀態即可：

| 您的回覆 | 我會進行的下一步 |
| --- | --- |
| **MySQL 已建立** | 協助檢查連線格式與 schema 初始化結果 |
| **Netlify 變數已設定** | 協助檢查健康檢查網址與 Function 日誌 |
| **已發布** | 針對根網址、登入、API、資料刷新與每日排程逐項驗證 |
| **卡在第 X 步** | 依您截圖或錯誤訊息排除問題 |

## References

[1]: https://docs.railway.com/databases/mysql "Railway MySQL documentation"
[2]: https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/ "Use Identity in functions"
[3]: https://docs.netlify.com/deploy/create-deploys/ "Create deploys"
[4]: https://docs.netlify.com/build/functions/scheduled-functions/ "Scheduled Functions"
