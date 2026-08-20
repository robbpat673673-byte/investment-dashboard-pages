import {
  bigint,
  boolean,
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const funds = mysqlTable(
  "funds",
  {
    id: int("id").autoincrement().primaryKey(),
    fundType: mysqlEnum("fundType", ["domestic", "foreign"]).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    displayCode: varchar("displayCode", { length: 40 }),
    mcode: varchar("mcode", { length: 48 }).notNull(),
    isin: varchar("isin", { length: 20 }),
    bankCode: varchar("bankCode", { length: 48 }),
    currency: varchar("currency", { length: 8 }).notNull().default("TWD"),
    sortOrder: int("sortOrder").notNull(),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("funds_mcode_unique").on(table.mcode),
    index("funds_type_sort_idx").on(table.fundType, table.sortOrder),
  ],
);

export const fundNavHistory = mysqlTable(
  "fund_nav_history",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    fundId: int("fundId").notNull(),
    navDate: date("navDate").notNull(),
    nav: decimal("nav", { precision: 18, scale: 6 }).notNull(),
    sourcedAt: timestamp("sourcedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("fund_nav_history_fund_date_unique").on(table.fundId, table.navDate),
    index("fund_nav_history_date_idx").on(table.navDate),
  ],
);

export const fundPerformances = mysqlTable(
  "fund_performances",
  {
    id: int("id").autoincrement().primaryKey(),
    fundId: int("fundId").notNull(),
    asOfDate: date("asOfDate").notNull(),
    latestNav: decimal("latestNav", { precision: 18, scale: 6 }).notNull(),
    week: decimal("week", { precision: 10, scale: 4 }),
    month: decimal("month", { precision: 10, scale: 4 }),
    quarter: decimal("quarter", { precision: 10, scale: 4 }),
    halfYear: decimal("halfYear", { precision: 10, scale: 4 }),
    year: decimal("year", { precision: 10, scale: 4 }),
    ytd: decimal("ytd", { precision: 10, scale: 4 }),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("fund_performances_fund_unique").on(table.fundId)],
);

export const fundDistributions = mysqlTable(
  "fund_distributions",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    fundId: int("fundId").notNull(),
    recordDate: date("recordDate"),
    exDate: date("exDate").notNull(),
    payoutDate: date("payoutDate"),
    amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
    annualizedYield: decimal("annualizedYield", { precision: 10, scale: 4 }),
    currency: varchar("currency", { length: 8 }).notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    sourcedAt: timestamp("sourcedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("fund_distributions_fund_ex_date_unique").on(table.fundId, table.exDate),
    index("fund_distributions_fund_date_idx").on(table.fundId, table.exDate),
  ],
);

export const newsItems = mysqlTable(
  "news_items",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    url: text("url").notNull(),
    source: varchar("source", { length: 120 }).notNull(),
    publishedAt: timestamp("publishedAt"),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("news_items_content_hash_unique").on(table.contentHash),
    index("news_items_published_idx").on(table.publishedAt),
  ],
);

export const marketQuotes = mysqlTable(
  "market_quotes",
  {
    id: int("id").autoincrement().primaryKey(),
    ticker: varchar("ticker", { length: 24 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    price: decimal("price", { precision: 18, scale: 4 }),
    change: decimal("change", { precision: 18, scale: 4 }),
    percentChange: decimal("percentChange", { precision: 10, scale: 4 }),
    quoteDate: varchar("quoteDate", { length: 24 }),
    showAsCard: boolean("showAsCard").notNull().default(false),
    sortOrder: int("sortOrder").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("market_quotes_ticker_unique").on(table.ticker)],
);

export const marketHistory = mysqlTable(
  "market_history",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    ticker: varchar("ticker", { length: 24 }).notNull(),
    pointDate: date("pointDate").notNull(),
    close: decimal("close", { precision: 18, scale: 6 }).notNull(),
    source: varchar("source", { length: 80 }).notNull(),
    sourcedAt: timestamp("sourcedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("market_history_ticker_date_unique").on(table.ticker, table.pointDate),
    index("market_history_ticker_date_idx").on(table.ticker, table.pointDate),
  ],
);

export const refreshRuns = mysqlTable("refresh_runs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  status: mysqlEnum("status", ["running", "success", "partial", "failed"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  fundsUpdated: int("fundsUpdated").notNull().default(0),
  newsUpdated: int("newsUpdated").notNull().default(0),
  details: text("details"),
});

export const rssSourceHealthHistory = mysqlTable(
  "rss_source_health_history",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    refreshRunId: bigint("refreshRunId", { mode: "number" }),
    sourceUrl: text("sourceUrl").notNull(),
    source: varchar("source", { length: 120 }).notNull(),
    status: mysqlEnum("status", ["fresh", "stale", "empty", "error"]).notNull(),
    acceptedCount: int("acceptedCount").notNull().default(0),
    latencyMs: int("latencyMs"),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  },
  table => [index("rss_health_source_date_idx").on(table.source, table.recordedAt), index("rss_health_date_idx").on(table.recordedAt)],
);

export const appSettings = mysqlTable("app_settings", {
  settingKey: varchar("settingKey", { length: 64 }).primaryKey(),
  value: text("value"),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const observatoryDailySummaries = mysqlTable(
  "observatory_daily_summaries",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    summaryDate: date("summaryDate").notNull(),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
    snapshotAsOf: timestamp("snapshotAsOf"),
    content: text("content").notNull(),
    sourcesJson: text("sourcesJson").notNull(),
    model: varchar("model", { length: 64 }).notNull().default("gpt-5-mini"),
  },
  table => [
    uniqueIndex("observatory_daily_summaries_date_unique").on(table.summaryDate),
    index("observatory_daily_summaries_generated_idx").on(table.generatedAt),
  ],
);

export type Fund = typeof funds.$inferSelect;
export type InsertFund = typeof funds.$inferInsert;
