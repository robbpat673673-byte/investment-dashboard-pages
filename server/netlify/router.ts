import { logout, verifyRequestOrigin } from "@netlify/identity";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getPublicDashboardData, getPublicFundDetail, getRSSHealthHistory } from "../services/dashboardRefresh";
import { dailySummarySystemPrompt, getDailySummaryByDate, listDailySummaries, observatorySystemPrompt, saveDailySummary } from "../services/observatory";
import { invokeNetlifyLLM } from "./llm";

const messageInput = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1200) });
const visits = new Map<string, number[]>();

function enforceQuota(key: string, limit: number) {
  const now = Date.now();
  const recent = (visits.get(key) ?? []).filter(timestamp => now - timestamp < 5 * 60_000);
  if (recent.length >= limit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "暫時達到使用上限，請稍後再試。" });
  recent.push(now);
  visits.set(key, recent);
}

/**
 * Netlify-safe tRPC router. It preserves the public dashboard contract but swaps
 * Manus OAuth and Forge LLM calls for Netlify Identity and an external LLM key.
 */
export const netlifyAppRouter = router({
  auth: router({
    me: publicProcedure.query(options => options.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      verifyRequestOrigin(ctx.req as unknown as Request);
      await logout();
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    get: publicProcedure.query(() => getPublicDashboardData()),
    newsSourceHealthHistory: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(90).default(14) }).optional()).query(({ input }) => getRSSHealthHistory(input?.limit ?? 14)),
  }),
  fund: router({
    detail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getPublicFundDetail(input.id)),
  }),
  observatory: router({
    summarizeNews: publicProcedure.input(z.object({ id: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(300), summary: z.string().trim().max(1800).default(""), source: z.string().trim().max(160), publishedAt: z.string().max(80).nullable().optional() })).mutation(async ({ input, ctx }) => {
      enforceQuota(`summary:${(ctx.req as { headers?: { get?: (name: string) => string | null } }).headers?.get?.("x-nf-client-connection-ip") ?? "anonymous"}`, 12);
      const completion = await invokeNetlifyLLM({ model: "gpt-5-mini", messages: [
        { role: "system", content: "你是財經新聞摘要助手。只根據提供的標題、公開摘要、來源與時間，使用繁體中文輸出三點：核心重點、可能影響、資料限制。不得補充未提供的事實，不提供個人化投資建議。總長度 120 字內。" },
        { role: "user", content: `來源：${input.source}\n發布時間：${input.publishedAt ?? "未提供"}\n標題：${input.title}\n公開摘要：${input.summary || "未提供"}` },
      ] });
      const summary = completion.choices[0]?.message.content;
      if (!summary?.trim()) throw new Error("新聞摘要暫時無法產生");
      return { summary: summary.trim() };
    }),
    chat: publicProcedure.input(z.object({ messages: z.array(messageInput).min(1).max(6) })).mutation(async ({ input, ctx }) => {
      enforceQuota(`chat:${(ctx.req as { headers?: { get?: (name: string) => string | null } }).headers?.get?.("x-nf-client-connection-ip") ?? "anonymous"}`, 8);
      const dashboard = await getPublicDashboardData();
      const completion = await invokeNetlifyLLM({ model: "gpt-5-mini", messages: [
        { role: "system", content: observatorySystemPrompt(dashboard.observatory.context, dashboard.observatory.dailySummary) },
        ...input.messages,
      ] });
      const answer = completion.choices[0]?.message.content;
      if (!answer?.trim()) throw new Error("觀測站暫時未能產生回覆");
      return { answer: answer.trim(), asOf: dashboard.observatory.asOf, sources: dashboard.observatory.sources };
    }),
    generateDailySummary: adminProcedure.mutation(async () => {
      const dashboard = await getPublicDashboardData();
      const completion = await invokeNetlifyLLM({ model: "gpt-5-mini", messages: [
        { role: "system", content: dailySummarySystemPrompt(dashboard.observatory.context) },
        { role: "user", content: "請生成今日每日財經摘要，嚴格依照指定三段格式。" },
      ] });
      const content = completion.choices[0]?.message.content;
      if (!content?.trim()) throw new Error("每日財經摘要暫時無法生成");
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
});

export type NetlifyAppRouter = typeof netlifyAppRouter;

