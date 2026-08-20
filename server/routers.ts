import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getPublicDashboardData, getPublicFundDetail, getRSSHealthHistory, refreshDashboardData } from "./services/dashboardRefresh";
import { invokeLLM } from "./_core/llm";
import { dailySummarySystemPrompt, getDailySummaryByDate, listDailySummaries, observatorySystemPrompt, saveDailySummary } from "./services/observatory";

const observatoryMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});
const observatoryChatVisits = new Map<string, number[]>();
const newsSummaryVisits = new Map<string, number[]>();

function assertObservatoryChatQuota(address: string) {
  const now = Date.now();
  const recent = (observatoryChatVisits.get(address) ?? []).filter(at => now - at < 5 * 60_000);
  if (recent.length >= 8) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "觀測站問答已達暫時使用上限，請稍後再試。" });
  recent.push(now);
  observatoryChatVisits.set(address, recent);
}

function assertNewsSummaryQuota(address: string) {
  const now = Date.now();
  const recent = (newsSummaryVisits.get(address) ?? []).filter(at => now - at < 5 * 60_000);
  if (recent.length >= 12) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "新聞摘要暫時達到使用上限，請稍後再試。" });
  recent.push(now);
  newsSummaryVisits.set(address, recent);
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dashboard: router({
    get: publicProcedure.query(async () => getPublicDashboardData()),
    manualRefresh: adminProcedure.mutation(async () => refreshDashboardData()),
    newsSourceHealthHistory: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(90).default(14) }).optional()).query(async ({ input }) => getRSSHealthHistory(input?.limit ?? 14)),
  }),

  observatory: router({
    summarizeNews: publicProcedure.input(z.object({ id: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(300), summary: z.string().trim().max(1800).default(""), source: z.string().trim().max(160), publishedAt: z.string().max(80).nullable().optional() })).mutation(async ({ input, ctx }) => {
      assertNewsSummaryQuota(ctx.req.ip || "anonymous");
      const completion = await invokeLLM({ model: "gpt-5-mini", messages: [
        { role: "system", content: "你是財經新聞摘要助手。只根據提供的標題、公開摘要、來源與時間，使用繁體中文輸出三點：核心重點、可能影響、資料限制。不得補充未提供的事實，不提供個人化投資建議。總長度 120 字內。" },
        { role: "user", content: `來源：${input.source}\n發布時間：${input.publishedAt ?? "未提供"}\n標題：${input.title}\n公開摘要：${input.summary || "未提供"}` },
      ] });
      const answer = completion.choices[0]?.message.content;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("新聞摘要暫時無法產生");
      return { summary: answer.trim() };
    }),
    chat: publicProcedure.input(z.object({ messages: z.array(observatoryMessage).min(1).max(6) })).mutation(async ({ input, ctx }) => {
      assertObservatoryChatQuota(ctx.req.ip || "anonymous");
      const dashboard = await getPublicDashboardData();
      const completion = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: observatorySystemPrompt(dashboard.observatory.context, dashboard.observatory.dailySummary) },
          ...input.messages,
        ],
      });
      const answer = completion.choices[0]?.message.content;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("觀測站暫時未能產生回覆");
      return { answer: answer.trim(), asOf: dashboard.observatory.asOf, sources: dashboard.observatory.sources };
    }),
    generateDailySummary: publicProcedure.mutation(async () => {
      const dashboard = await getPublicDashboardData();
      const completion = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: dailySummarySystemPrompt(dashboard.observatory.context) }, { role: "user", content: "請生成今日每日財經摘要，嚴格依照指定三段格式。" }] });
      const content = completion.choices[0]?.message.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("每日財經摘要暫時無法生成");
      const saved = await saveDailySummary({ content, snapshotAsOf: dashboard.observatory.asOf, sources: dashboard.observatory.sources });
      if (!saved) throw new Error("每日財經摘要保存失敗");
      return { id: saved.id, summaryDate: saved.summaryDate, generatedAt: saved.generatedAt, snapshotAsOf: saved.snapshotAsOf, content: saved.content, sources: dashboard.observatory.sources };
    }),
    summaryHistory: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(90).default(30) }).optional()).query(async ({ input }) => {
      const rows = await listDailySummaries(input?.limit ?? 30);
      return rows.map(row => ({ id: row.id, summaryDate: row.summaryDate, generatedAt: row.generatedAt, snapshotAsOf: row.snapshotAsOf, content: row.content, sources: JSON.parse(row.sourcesJson) as unknown[] }));
    }),
    summaryByDate: publicProcedure.input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(async ({ input }) => {
      const row = await getDailySummaryByDate(input.date);
      return row ? { id: row.id, summaryDate: row.summaryDate, generatedAt: row.generatedAt, snapshotAsOf: row.snapshotAsOf, content: row.content, sources: JSON.parse(row.sourcesJson) as unknown[] } : null;
    }),
  }),

  fund: router({
    detail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => getPublicFundDetail(input.id)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
