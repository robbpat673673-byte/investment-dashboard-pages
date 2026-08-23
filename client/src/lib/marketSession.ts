export type MarketSessionState = "open" | "preopen" | "break" | "closed";

export type MarketSession = {
  timezone: string;
  timezoneLabel: string;
  scheduleLabel: string;
  localTime: string;
  state: MarketSessionState;
  stateLabel: string;
  detail: string;
};

type MarketSchedule = Omit<MarketSession, "localTime" | "state" | "stateLabel" | "detail"> & { sessions: Array<[number, number]> };

const schedules: Record<string, MarketSchedule> = {
  "^DJI": { timezone: "America/New_York", timezoneLabel: "美東時間 ET", scheduleLabel: "09:30–16:00", sessions: [[9 * 60 + 30, 16 * 60]] },
  "^IXIC": { timezone: "America/New_York", timezoneLabel: "美東時間 ET", scheduleLabel: "09:30–16:00", sessions: [[9 * 60 + 30, 16 * 60]] },
  "^GSPC": { timezone: "America/New_York", timezoneLabel: "美東時間 ET", scheduleLabel: "09:30–16:00", sessions: [[9 * 60 + 30, 16 * 60]] },
  "^SOX": { timezone: "America/New_York", timezoneLabel: "美東時間 ET", scheduleLabel: "09:30–16:00", sessions: [[9 * 60 + 30, 16 * 60]] },
  "^N225": { timezone: "Asia/Tokyo", timezoneLabel: "日本時間 JST", scheduleLabel: "09:00–11:30／12:30–15:30", sessions: [[9 * 60, 11 * 60 + 30], [12 * 60 + 30, 15 * 60 + 30]] },
  "^HSI": { timezone: "Asia/Hong_Kong", timezoneLabel: "香港時間 HKT", scheduleLabel: "09:30–12:00／13:00–16:00", sessions: [[9 * 60 + 30, 12 * 60], [13 * 60, 16 * 60]] },
  "^TWII": { timezone: "Asia/Taipei", timezoneLabel: "台北時間 CST", scheduleLabel: "09:00–13:30", sessions: [[9 * 60, 13 * 60 + 30]] },
  "^KS11": { timezone: "Asia/Seoul", timezoneLabel: "韓國時間 KST", scheduleLabel: "09:00–15:30", sessions: [[9 * 60, 15 * 60 + 30]] },
};

function zonedParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
}

export function getMarketSession(ticker: string, now = new Date()): MarketSession {
  const schedule = schedules[ticker] ?? { timezone: "Asia/Taipei", timezoneLabel: "台北時間 CST", scheduleLabel: "依交易所公告", sessions: [] };
  const parts = zonedParts(now, schedule.timezone);
  const localTime = new Intl.DateTimeFormat("zh-TW", { timeZone: schedule.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const isWeekday = !["Sat", "Sun"].includes(parts.weekday);
  const minutes = parts.hour * 60 + parts.minute;
  const active = schedule.sessions.some(([start, end]) => minutes >= start && minutes < end);
  if (!isWeekday) return { ...schedule, localTime, state: "closed", stateLabel: "週末休市", detail: "依標準交易時段；特殊休市以交易所公告為準" };
  if (active) return { ...schedule, localTime, state: "open", stateLabel: "開盤中", detail: "依標準交易時段；特殊休市以交易所公告為準" };
  const firstOpen = schedule.sessions[0]?.[0];
  const lastClose = schedule.sessions.at(-1)?.[1];
  if (firstOpen !== undefined && minutes < firstOpen) return { ...schedule, localTime, state: "preopen", stateLabel: "尚未開盤", detail: "依標準交易時段；特殊休市以交易所公告為準" };
  if (schedule.sessions.length > 1 && minutes < schedule.sessions[1][0]) return { ...schedule, localTime, state: "break", stateLabel: "午間休市", detail: "依標準交易時段；特殊休市以交易所公告為準" };
  if (lastClose !== undefined && minutes >= lastClose) return { ...schedule, localTime, state: "closed", stateLabel: "已收盤", detail: "依標準交易時段；特殊休市以交易所公告為準" };
  return { ...schedule, localTime, state: "closed", stateLabel: "交易時段未定義", detail: "請以交易所公告為準" };
}
