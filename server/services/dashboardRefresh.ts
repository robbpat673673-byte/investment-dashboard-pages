import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  fundNavHistory,
  fundPerformances,
  fundDistributions,
  funds,
  marketHistory,
  marketQuotes,
  newsItems,
  refreshRuns,
} from "../../drizzle/schema";
import { calculatePerformances, cleanText, parseHistoryPayload, safeUrl, sampleHistory, shiftMonths, type NavPoint } from "./dashboardCalculations";
import { buildPublicFundDetail } from "./fundDetail";
import { buildObservatorySnapshot } from "./observatory";

type FundConfig = {
  fundType: "domestic" | "foreign";
  name: string;
  displayCode: string | null;
  mcode: string;
  isin?: string;
  currency: string;
  sortOrder: number;
};

const FUND_CONFIG: FundConfig[] = [
  { fundType: "domestic", name: "野村台灣運籌基金", displayCode: "NOM006", mcode: "ACKH03-006018", isin: "TW000T3218Y2", currency: "TWD", sortOrder: 1 },
  { fundType: "domestic", name: "合庫台灣基金", displayCode: "COB001", mcode: "ACCB01-047001", currency: "TWD", sortOrder: 2 },
  { fundType: "domestic", name: "野村鴻運基金", displayCode: "NOM001", mcode: "AC0001-006034", currency: "TWD", sortOrder: 3 },
  { fundType: "domestic", name: "安聯台灣科技基金", displayCode: "ALI006", mcode: "ACDD04-005003", isin: "TW000T3604Y3", currency: "TWD", sortOrder: 4 },
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
  { fundType: "domestic", name: "富邦台美雙星多重資產基金NB配息(台幣)", displayCode: "4603", mcode: "ACFP143-4603", currency: "TWD", sortOrder: 16 },
  { fundType: "foreign", name: "富蘭克林美國科技基金", displayCode: null, mcode: "FLZ07-1302", currency: "USD", sortOrder: 1 },
  { fundType: "foreign", name: "安聯收益成長基金", displayCode: null, mcode: "TLZ63-1156", currency: "USD", sortOrder: 2 },
  { fundType: "foreign", name: "貝萊德世界礦業基金", displayCode: null, mcode: "SHZ19-3051", currency: "USD", sortOrder: 3 },
  { fundType: "foreign", name: "摩根新興市場債券基金", displayCode: null, mcode: "JFZ92-0180", currency: "USD", sortOrder: 4 },
  { fundType: "foreign", name: "聯博全球高收益債券基金", displayCode: null, mcode: "ALZ60-1616", currency: "USD", sortOrder: 5 },
  { fundType: "foreign", name: "摩根大通亞洲增長基金", displayCode: null, mcode: "JFH17-0186", currency: "USD", sortOrder: 6 },
  { fundType: "foreign", name: "富達基金－全球動能多元基金(B股C月配息美元)", displayCode: null, mcode: "FTZA69-2J35", currency: "USD", sortOrder: 7 },
  { fundType: "foreign", name: "貝萊德環球資產配置基金B10美元(總報酬穩定配息)", displayCode: "AU07", mcode: "SHZY14-AU07", currency: "USD", sortOrder: 8 },
  { fundType: "foreign", name: "貝萊德環球資產配置基金B11美元(強化穩定配息)", displayCode: "AU32", mcode: "SHZA50-AU32", currency: "USD", sortOrder: 9 },
  { fundType: "foreign", name: "貝萊德全球智慧數據股票入息基金B6美元(穩定配息)", displayCode: "AU08", mcode: "SHZY7-AU08", currency: "USD", sortOrder: 10 },
  { fundType: "foreign", name: "施羅德環球基金系列－環球收益成長(美元)U月配固定", displayCode: "AC08", mcode: "PYZT8-AC08", currency: "USD", sortOrder: 11 },
  { fundType: "foreign", name: "聯博－全球多元收益基金ED月配級別美元", displayCode: "AB13", mcode: "ALBL2-AB13", currency: "USD", sortOrder: 12 },
  { fundType: "foreign", name: "貝萊德全球智慧數據股票入息基金B2美元", displayCode: "AU17", mcode: "SHZZ2-AU17", currency: "USD", sortOrder: 13 },
  { fundType: "foreign", name: "摩根投資基金－多重收益基金F股(美元對沖)(穩定月配)", displayCode: "AI20", mcode: "JFZN8-AI20", currency: "USD", sortOrder: 14 },
  { fundType: "foreign", name: "富達基金－全球優質債券基金(B股C月配息美元)", displayCode: "AP05", mcode: "FTZA31-AP05", currency: "USD", sortOrder: 15 },
];

const MARKET_CONFIG = [
  { ticker: "^DJI", name: "道瓊指數", showAsCard: true, sortOrder: 1 },
  { ticker: "^IXIC", name: "那斯達克綜合指數", showAsCard: true, sortOrder: 2 },
  { ticker: "^GSPC", name: "S&P 500", showAsCard: true, sortOrder: 3 },
  { ticker: "^N225", name: "日經225", showAsCard: true, sortOrder: 4 },
  { ticker: "^HSI", name: "恒生指數", showAsCard: true, sortOrder: 5 },
  { ticker: "^TWII", name: "加權指數", showAsCard: true, sortOrder: 6 },
  { ticker: "^KS11", name: "KOSPI", showAsCard: true, sortOrder: 7 },
  { ticker: "^SOX", name: "費城半導體指數", showAsCard: true, sortOrder: 8 },
  { ticker: "TSM", name: "台積電ADR", showAsCard: false, sortOrder: 9 },
  { ticker: "NVDA", name: "輝達", showAsCard: false, sortOrder: 10 },
  { ticker: "GC=F", name: "黃金期貨", showAsCard: false, sortOrder: 11 },
  { ticker: "CL=F", name: "WTI 原油期貨", showAsCard: false, sortOrder: 12 },
  { ticker: "BZ=F", name: "布蘭特原油期貨", showAsCard: false, sortOrder: 13 },
  { ticker: "HG=F", name: "銅期貨", showAsCard: false, sortOrder: 14 },
  { ticker: "NG=F", name: "天然氣期貨", showAsCard: false, sortOrder: 15 },
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
  for (const fund of FUND_CONFIG) {
    const bankCode = fund.mcode.split("-")[1] ?? null;
    await db.insert(funds).values({ ...fund, bankCode }).onDuplicateKeyUpdate({
      set: {
        name: fund.name,
        displayCode: fund.displayCode,
        isin: fund.isin ?? null,
        bankCode,
        currency: fund.currency,
        sortOrder: fund.sortOrder,
        isActive: true,
      },
    });
  }
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

type DistributionPoint = { recordDate: string | null; exDate: string; payoutDate: string | null; amount: number; annualizedYield: number | null; currency: string; sourceUrl: string };

function parseMoneyDate(value: string) {
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function parseFundDistributions(payload: string, sourceUrl: string): DistributionPoint[] {
  const parsed = new Map<string, DistributionPoint>();
  for (const row of payload.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(match => cleanText(match[1], 120));
    if (cells.length < 8) continue;
    const exDate = parseMoneyDate(cells[1] ?? "");
    const amount = Number((cells[4] ?? "").replace(/,/g, ""));
    if (!exDate || !Number.isFinite(amount) || amount <= 0) continue;
    parsed.set(exDate, {
      recordDate: parseMoneyDate(cells[0] ?? ""),
      exDate,
      payoutDate: parseMoneyDate(cells[2] ?? ""),
      amount,
      annualizedYield: Number.isFinite(Number(cells[5])) ? Number(cells[5]) : null,
      currency: cells[6] || "",
      sourceUrl,
    });
  }
  return Array.from(parsed.values());
}

async function fetchFundDistributions(fund: { mcode: string; fundType: "domestic" | "foreign" }) {
  if (fund.fundType !== "domestic") return [];
  const sourceUrl = `https://www.moneydj.com/funddj/yp/funddividend.djhtm?a=${encodeURIComponent(fund.mcode.split("-", 1)[0].toLowerCase())}`;
  return parseFundDistributions(await fetchText(sourceUrl), sourceUrl);
}

async function fetchMarketHistory(ticker: string): Promise<NavPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
  const payload = JSON.parse(await fetchText(url)) as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> } };
  const chart = payload.chart?.result?.[0];
  const closes = chart?.indicators?.quote?.[0]?.close ?? [];
  const timestamps = chart?.timestamp ?? [];
  return closes.map((nav, index) => ({ nav, timestamp: timestamps[index] }))
    .filter((point): point is { nav: number; timestamp: number } => typeof point.nav === "number" && Number.isFinite(point.nav) && typeof point.timestamp === "number")
    .map(point => ({ date: new Date(point.timestamp * 1000).toISOString().slice(0, 10), nav: point.nav }));
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
      const distributions = await fetchFundDistributions(fund);
      if (distributions.length > 0) {
        await db.insert(fundDistributions).values(distributions.map(item => ({
          fundId: fund.id,
          recordDate: item.recordDate ? databaseDate(item.recordDate) : null,
          exDate: databaseDate(item.exDate),
          payoutDate: item.payoutDate ? databaseDate(item.payoutDate) : null,
          amount: item.amount.toFixed(6),
          annualizedYield: item.annualizedYield === null ? null : item.annualizedYield.toFixed(4),
          currency: item.currency || fund.currency,
          sourceUrl: item.sourceUrl,
        }))).onDuplicateKeyUpdate({ set: { amount: sql`VALUES(amount)`, annualizedYield: sql`VALUES(annualizedYield)`, payoutDate: sql`VALUES(payoutDate)`, sourcedAt: new Date() } });
      }
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

  try {
    const benchmarkHistory = await fetchMarketHistory("^GSPC");
    for (let index = 0; index < benchmarkHistory.length; index += 250) {
      await db.insert(marketHistory).values(benchmarkHistory.slice(index, index + 250).map(point => ({ ticker: "^GSPC", pointDate: databaseDate(point.date), close: point.nav.toFixed(6), source: "Yahoo Finance" }))).onDuplicateKeyUpdate({ set: { close: sql`VALUES(close)`, sourcedAt: new Date() } });
    }
  } catch (error) {
    errors.push(`S&P 500 歷史：${error instanceof Error ? error.message : "更新失敗"}`);
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
      fundType: fund.fundType,
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
        ytd: performance ? decimal(performance.ytd) : null,
      },
      isin: fund.isin,
      bankCode: fund.bankCode,
    };
  };
  const quotes = await db.select().from(marketQuotes).orderBy(marketQuotes.sortOrder);
  const news = await db.select().from(newsItems).orderBy(desc(newsItems.publishedAt), desc(newsItems.fetchedAt)).limit(12);
  const latestRun = (await db.select().from(refreshRuns).orderBy(desc(refreshRuns.startedAt)).limit(1))[0] ?? null;

  const publicMarket = quotes.map(quote => ({
    ticker: quote.ticker,
    name: quote.name,
    price: decimal(quote.price),
    change: decimal(quote.change),
    percentChange: decimal(quote.percentChange),
    quoteDate: quote.quoteDate,
    showAsCard: quote.showAsCard,
  }));
  const publicNews = news.map(item => ({ ...item, id: Number(item.id) }));

  return {
    domesticFunds: allFunds.filter(fund => fund.fundType === "domestic").map(toFund),
    foreignFunds: allFunds.filter(fund => fund.fundType === "foreign").map(toFund),
    market: publicMarket,
    news: publicNews,
    lastRefresh: latestRun ? { status: latestRun.status, startedAt: latestRun.startedAt, finishedAt: latestRun.finishedAt, fundsUpdated: latestRun.fundsUpdated, newsUpdated: latestRun.newsUpdated } : null,
    observatory: buildObservatorySnapshot(publicMarket, publicNews, latestRun?.finishedAt ?? null),
  };
}

/** 回傳單檔基金公開詳細資料；歷史淨值保留完整資料以供詳細頁檢視。 */
export async function getPublicFundDetail(fundId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const fund = (await db.select().from(funds).where(and(eq(funds.id, fundId), eq(funds.isActive, true))).limit(1))[0];
  if (!fund) return null;

  const performance = (await db.select().from(fundPerformances).where(eq(fundPerformances.fundId, fund.id)).limit(1))[0] ?? null;
  const navRows = await db
    .select({ navDate: fundNavHistory.navDate, nav: fundNavHistory.nav, sourcedAt: fundNavHistory.sourcedAt })
    .from(fundNavHistory)
    .where(eq(fundNavHistory.fundId, fund.id))
    .orderBy(fundNavHistory.navDate);
  const distributionRows = await db.select().from(fundDistributions).where(eq(fundDistributions.fundId, fund.id)).orderBy(fundDistributions.exDate);
  const benchmarkRows = await db.select().from(marketHistory).where(eq(marketHistory.ticker, "^GSPC")).orderBy(marketHistory.pointDate);
  const history = navRows.map(row => ({
    date: row.navDate instanceof Date ? row.navDate.toISOString().slice(0, 10) : String(row.navDate).slice(0, 10),
    nav: Number(row.nav),
  }));
  return buildPublicFundDetail({
    id: fund.id,
    name: fund.name,
    code: fund.displayCode,
    fundType: fund.fundType,
    currency: fund.currency,
    isin: fund.isin,
    bankCode: fund.bankCode,
    latestNav: performance ? decimal(performance.latestNav) : null,
    asOfDate: performance?.asOfDate ?? null,
    history,
    distributions: distributionRows.map(item => ({
      exDate: item.exDate instanceof Date ? item.exDate.toISOString().slice(0, 10) : String(item.exDate).slice(0, 10),
      amount: Number(item.amount),
      annualizedYield: decimal(item.annualizedYield),
      payoutDate: item.payoutDate instanceof Date ? item.payoutDate.toISOString().slice(0, 10) : item.payoutDate ? String(item.payoutDate).slice(0, 10) : null,
      sourceUrl: item.sourceUrl,
    })),
    benchmarkHistory: benchmarkRows.map(item => ({ date: item.pointDate instanceof Date ? item.pointDate.toISOString().slice(0, 10) : String(item.pointDate).slice(0, 10), nav: Number(item.close) })),
    lastSyncedAt: navRows.at(-1)?.sourcedAt ?? null,
  });
}
