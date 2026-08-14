import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  fundNavHistory,
  fundPerformances,
  funds,
  marketQuotes,
  newsItems,
  refreshRuns,
} from "../../drizzle/schema";
import { calculatePerformances, cleanText, parseHistoryPayload, safeUrl, sampleHistory, shiftMonths, type NavPoint } from "./dashboardCalculations";

type FundConfig = {
  fundType: "domestic" | "foreign";
  name: string;
  displayCode: string | null;
  mcode: string;
  currency: string;
  sortOrder: number;
};

const FUND_CONFIG: FundConfig[] = [
  { fundType: "domestic", name: "野村台灣運籌基金", displayCode: "NOM006", mcode: "ACKH03-006018", currency: "TWD", sortOrder: 1 },
  { fundType: "domestic", name: "合庫台灣基金", displayCode: "COB001", mcode: "ACCB01-047001", currency: "TWD", sortOrder: 2 },
  { fundType: "domestic", name: "野村鴻運基金", displayCode: "NOM001", mcode: "AC0001-006034", currency: "TWD", sortOrder: 3 },
  { fundType: "domestic", name: "安聯台灣科技基金", displayCode: "ALI006", mcode: "ACDD04-005003", currency: "TWD", sortOrder: 4 },
  { fundType: "domestic", name: "野村e科技基金", displayCode: "NOM005", mcode: "ACIC06-006004", currency: "TWD", sortOrder: 5 },
  { fundType: "domestic", name: "合庫台灣高科技基金", displayCode: "COB003", mcode: "ACCB78-047003", currency: "TWD", sortOrder: 6 },
  { fundType: "domestic", name: "第一金電子基金", displayCode: "FIR001", mcode: "ACNC16-039016", currency: "TWD", sortOrder: 7 },
  { fundType: "domestic", name: "瀚亞高科技基金", displayCode: "EAS002", mcode: "ACCP03-026003", currency: "TWD", sortOrder: 8 },
  { fundType: "domestic", name: "群益創新科技基金", displayCode: "PRE004", mcode: "ACCA09-001004", currency: "TWD", sortOrder: 9 },
  { fundType: "domestic", name: "富邦新台商基金", displayCode: "FBF046", mcode: "ACJS13-035031", currency: "TWD", sortOrder: 10 },
  { fundType: "domestic", name: "台中銀數位時代基金", displayCode: "TCS001", mcode: "ACDF07-028003", currency: "TWD", sortOrder: 11 },
  { fundType: "domestic", name: "野村高科技基金", displayCode: "NOM008", mcode: "ACKH19-006025", currency: "TWD", sortOrder: 12 },
  { fundType: "domestic", name: "復華數位經濟基金", displayCode: "FUA005", mcode: "ACFH06-031006", currency: "TWD", sortOrder: 13 },
  { fundType: "domestic", name: "元大新主流基金", displayCode: "YUA016", mcode: "ACYT11-018009", currency: "TWD", sortOrder: 14 },
  { fundType: "domestic", name: "元大高股息龍頭基金", displayCode: "YUA001", mcode: "ACYT161-018049", currency: "TWD", sortOrder: 15 },
  { fundType: "foreign", name: "富蘭克林美國科技基金", displayCode: null, mcode: "FLZ07-1302", currency: "USD", sortOrder: 1 },
  { fundType: "foreign", name: "安聯收益成長基金", displayCode: null, mcode: "TLZ63-1156", currency: "USD", sortOrder: 2 },
  { fundType: "foreign", name: "貝萊德世界礦業基金", displayCode: null, mcode: "SHZ19-3051", currency: "USD", sortOrder: 3 },
  { fundType: "foreign", name: "摩根新興市場債券基金", displayCode: null, mcode: "JFZ92-0180", currency: "USD", sortOrder: 4 },
  { fundType: "foreign", name: "聯博全球高收益債券基金", displayCode: null, mcode: "ALZ60-1616", currency: "USD", sortOrder: 5 },
  { fundType: "foreign", name: "摩根大通亞洲增長基金", displayCode: null, mcode: "JFH17-0186", currency: "USD", sortOrder: 6 },
];

const MARKET_CONFIG = [
  { ticker: "^DJI", name: "道瓊指數", showAsCard: true, sortOrder: 1 },
  { ticker: "^N225", name: "日經225", showAsCard: true, sortOrder: 2 },
  { ticker: "^HSI", name: "恒生指數", showAsCard: true, sortOrder: 3 },
  { ticker: "^TWII", name: "加權指數", showAsCard: true, sortOrder: 4 },
  { ticker: "^KS11", name: "KOSPI", showAsCard: true, sortOrder: 5 },
  { ticker: "^BSESN", name: "SENSEX", showAsCard: true, sortOrder: 6 },
  { ticker: "TSM", name: "台積電ADR", showAsCard: false, sortOrder: 7 },
  { ticker: "NVDA", name: "輝達", showAsCard: false, sortOrder: 8 },
];

const RSS_SOURCES = [
  ["https://news.google.com/rss/search?q=%E5%8F%B0%E7%81%A3+%E8%B2%A1%E7%B6%93+%E8%82%A1%E5%B8%82&hl=zh-TW&gl=TW&ceid=TW:zh-Hant", "Google 新聞・台灣財經"],
  ["https://news.google.com/rss/search?q=%E5%85%A8%E7%90%83+%E5%B8%82%E5%A0%B4+%E7%BE%8E%E8%82%A1+%E8%B2%A1%E7%B6%93&hl=zh-TW&gl=TW&ceid=TW:zh-Hant", "Google 新聞・全球市場"],
  ["https://news.google.com/rss/search?q=%E5%9F%BA%E9%87%91+%E5%82%B5%E5%88%B8+%E5%8C%AF%E7%8E%87&hl=zh-TW&gl=TW&ceid=TW:zh-Hant", "Google 新聞・基金市場"],
] as const;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const databaseDate = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; InvestmentDashboard/1.0)",
          Accept: "text/html,application/xml,application/rss+xml,text/plain,*/*;q=0.8",
          Referer: "https://fund.hncb.com.tw/",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) return await response.text();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(400 * (attempt + 1));
  }
  throw lastError instanceof Error ? lastError : new Error("資料來源無法連線");
}

export async function ensureFundConfiguration() {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  const existing = await db.select({ mcode: funds.mcode }).from(funds);
  const existingMcodes = new Set(existing.map(row => row.mcode));
  const missing = FUND_CONFIG.filter(fund => !existingMcodes.has(fund.mcode));
  if (missing.length > 0) await db.insert(funds).values(missing);
}

async function fetchFundHistory(fund: { mcode: string; fundType: "domestic" | "foreign" }): Promise<NavPoint[]> {
  const chartId = fund.mcode.split("-", 1)[0];
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate()));
  const format = (date: Date) => `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  const base = fund.fundType === "foreign"
    ? "https://fund.hncb.com.tw/w/bcd/BCDNavList.djbcd"
    : "https://fund.hncb.com.tw/w/bcd/tBCDNavList.djbcd";
  const url = `${base}?a=${encodeURIComponent(chartId)}&b=2&c=${format(start)}&d=${format(now)}`;
  return parseHistoryPayload(await fetchText(url));
}

function getXmlTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1] ?? "";
}

async function fetchNews() {
  const items: Array<{ title: string; summary: string; url: string; source: string; publishedAt: Date | null }> = [];
  const seen = new Set<string>();
  for (const [url, source] of RSS_SOURCES) {
    if (items.length >= 12) break;
    try {
      const xml = await fetchText(url);
      for (const block of xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []) {
        if (items.length >= 12) break;
        const title = cleanText(getXmlTag(block, "title"), 240);
        const itemUrl = safeUrl(cleanText(getXmlTag(block, "link"), 1_500));
        if (!title || !itemUrl || seen.has(title)) continue;
        seen.add(title);
        const summary = cleanText(getXmlTag(block, "description"));
        const rawDate = cleanText(getXmlTag(block, "pubDate"), 100);
        const parsedDate = new Date(rawDate);
        items.push({
          title,
          summary: summary === title ? "" : summary,
          url: itemUrl,
          source,
          publishedAt: Number.isNaN(parsedDate.getTime()) ? null : parsedDate,
        });
      }
    } catch (error) {
      console.warn("[refresh] RSS 抓取失敗", source, error);
    }
  }
  return items;
}

async function fetchMarketQuote(config: (typeof MARKET_CONFIG)[number]) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.ticker)}?range=5d&interval=1d`;
  const payload = JSON.parse(await fetchText(url)) as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> } };
  const chart = payload.chart?.result?.[0];
  const closes = chart?.indicators?.quote?.[0]?.close ?? [];
  const timestamps = chart?.timestamp ?? [];
  const points = closes
    .map((close, index) => ({ close, timestamp: timestamps[index] }))
    .filter((point): point is { close: number; timestamp: number } => typeof point.close === "number" && typeof point.timestamp === "number");
  if (points.length < 2) throw new Error("可用收盤價不足兩筆");
  const latest = points.at(-1)!;
  const previous = points.at(-2)!;
  const change = latest.close - previous.close;
  return {
    ...config,
    price: latest.close,
    change,
    percentChange: previous.close === 0 ? 0 : (change / previous.close) * 100,
    quoteDate: new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" }).format(new Date(latest.timestamp * 1000)),
  };
}

export async function refreshDashboardData() {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  await ensureFundConfiguration();
  const run = await db.insert(refreshRuns).values({ status: "running" });
  const runId = Number(run[0].insertId);
  const activeFunds = await db.select().from(funds).where(eq(funds.isActive, true)).orderBy(funds.fundType, funds.sortOrder);
  const errors: string[] = [];
  let fundsUpdated = 0;

  for (const fund of activeFunds) {
    try {
      const history = await fetchFundHistory(fund);
      if (history.length < 2) throw new Error("歷史淨值筆數不足");
      const latest = history.at(-1)!;
      const performance = calculatePerformances(history);
      const databasePerformance = Object.fromEntries(
        Object.entries(performance).map(([key, value]) => [key, value === null ? null : value.toFixed(4)]),
      );
      for (let index = 0; index < history.length; index += 250) {
        const batch = history.slice(index, index + 250).map(point => ({ fundId: fund.id, navDate: databaseDate(point.date), nav: point.nav.toFixed(6) }));
        await db.insert(fundNavHistory).values(batch).onDuplicateKeyUpdate({ set: { nav: sql`VALUES(nav)`, sourcedAt: new Date() } });
      }
      await db.insert(fundPerformances).values({
        fundId: fund.id,
        asOfDate: databaseDate(latest.date),
        latestNav: latest.nav.toFixed(6),
        ...databasePerformance,
      }).onDuplicateKeyUpdate({
        set: {
          asOfDate: databaseDate(latest.date),
          latestNav: latest.nav.toFixed(6),
          ...databasePerformance,
          updatedAt: new Date(),
        },
      });
      fundsUpdated += 1;
    } catch (error) {
      errors.push(`${fund.name}：${error instanceof Error ? error.message : "更新失敗"}`);
    }
    await sleep(250);
  }

  const fetchedNews = await fetchNews();
  for (const item of fetchedNews) {
    const contentHash = createHash("sha256").update(`${item.title}|${item.url}`).digest("hex");
    await db.insert(newsItems).values({ contentHash, ...item }).onDuplicateKeyUpdate({
      set: { title: item.title, summary: item.summary, url: item.url, source: item.source, publishedAt: item.publishedAt, fetchedAt: new Date() },
    });
  }

  for (const config of MARKET_CONFIG) {
    try {
      const quote = await fetchMarketQuote(config);
      await db.insert(marketQuotes).values({
        ...quote,
        price: quote.price.toFixed(4),
        change: quote.change.toFixed(4),
        percentChange: quote.percentChange.toFixed(4),
      }).onDuplicateKeyUpdate({
        set: {
          name: quote.name,
          price: quote.price.toFixed(4),
          change: quote.change.toFixed(4),
          percentChange: quote.percentChange.toFixed(4),
          quoteDate: quote.quoteDate,
          showAsCard: quote.showAsCard,
          sortOrder: quote.sortOrder,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      errors.push(`${config.name} 行情：${error instanceof Error ? error.message : "更新失敗"}`);
    }
  }

  const status = errors.length === 0 ? "success" : fundsUpdated > 0 || fetchedNews.length > 0 ? "partial" : "failed";
  await db.update(refreshRuns).set({
    status,
    finishedAt: new Date(),
    fundsUpdated,
    newsUpdated: fetchedNews.length,
    details: errors.length > 0 ? errors.join("\n").slice(0, 10_000) : null,
  }).where(eq(refreshRuns.id, runId));

  return { status, fundsUpdated, newsUpdated: fetchedNews.length, errors };
}

const decimal = (value: string | null) => (value === null ? null : Number(value));

export async function getPublicDashboardData() {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  await ensureFundConfiguration();
  const allFunds = await db.select().from(funds).where(eq(funds.isActive, true)).orderBy(funds.fundType, funds.sortOrder);
  const performanceRows = await db.select().from(fundPerformances);
  const performanceByFundId = new Map(performanceRows.map(item => [item.fundId, item]));
  const navRows = await db.select({ fundId: fundNavHistory.fundId, navDate: fundNavHistory.navDate, nav: fundNavHistory.nav }).from(fundNavHistory).orderBy(fundNavHistory.fundId, fundNavHistory.navDate);
  const historyByFundId = new Map<number, NavPoint[]>();
  for (const row of navRows) {
    const date = row.navDate instanceof Date ? row.navDate.toISOString().slice(0, 10) : String(row.navDate).slice(0, 10);
    const current = historyByFundId.get(row.fundId) ?? [];
    current.push({ date, nav: Number(row.nav) });
    historyByFundId.set(row.fundId, current);
  }
  const rankedByYear = allFunds
    .filter(fund => performanceByFundId.get(fund.id)?.year !== null && performanceByFundId.get(fund.id)?.year !== undefined)
    .sort((left, right) => Number(performanceByFundId.get(right.id)?.year) - Number(performanceByFundId.get(left.id)?.year));
  const annualRankByFundId = new Map(rankedByYear.map((fund, index) => [fund.id, index + 1]));
  const toFund = (fund: typeof allFunds[number]) => {
    const performance = performanceByFundId.get(fund.id);
    const rawHistory = historyByFundId.get(fund.id) ?? [];
    const latestHistoryDate = rawHistory.at(-1)?.date;
    const chartHistory = latestHistoryDate ? rawHistory.filter(point => point.date >= shiftMonths(latestHistoryDate, 12)) : [];
    return {
      id: fund.id,
      name: fund.name,
      code: fund.displayCode,
      currency: fund.currency,
      nav: performance ? decimal(performance.latestNav) : null,
      asOfDate: performance?.asOfDate ?? null,
      history: sampleHistory(chartHistory),
      annualRank: annualRankByFundId.get(fund.id) ?? null,
      annualTotal: rankedByYear.length,
      perf: {
        week: performance ? decimal(performance.week) : null,
        month: performance ? decimal(performance.month) : null,
        quarter: performance ? decimal(performance.quarter) : null,
        halfYear: performance ? decimal(performance.halfYear) : null,
        year: performance ? decimal(performance.year) : null,
      },
    };
  };
  const quotes = await db.select().from(marketQuotes).orderBy(marketQuotes.sortOrder);
  const news = await db.select().from(newsItems).orderBy(desc(newsItems.publishedAt), desc(newsItems.fetchedAt)).limit(12);
  const latestRun = (await db.select().from(refreshRuns).orderBy(desc(refreshRuns.startedAt)).limit(1))[0] ?? null;

  return {
    domesticFunds: allFunds.filter(fund => fund.fundType === "domestic").map(toFund),
    foreignFunds: allFunds.filter(fund => fund.fundType === "foreign").map(toFund),
    market: quotes.map(quote => ({
      ticker: quote.ticker,
      name: quote.name,
      price: decimal(quote.price),
      change: decimal(quote.change),
      percentChange: decimal(quote.percentChange),
      quoteDate: quote.quoteDate,
      showAsCard: quote.showAsCard,
    })),
    news: news.map(item => ({ ...item, id: Number(item.id) })),
    lastRefresh: latestRun ? { status: latestRun.status, startedAt: latestRun.startedAt, finishedAt: latestRun.finishedAt, fundsUpdated: latestRun.fundsUpdated, newsUpdated: latestRun.newsUpdated } : null,
  };
}
