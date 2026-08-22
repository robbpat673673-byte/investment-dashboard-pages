import type { Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { desc, gte } from "drizzle-orm";
import { getDb } from "../../server/db";
import { refreshRuns } from "../../drizzle/schema";

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user?.roles.includes("admin")) return new Response("Forbidden", { status: 403 });
  const db = await getDb();
  if (!db) return Response.json({ error: "資料庫尚未連線" }, { status: 503 });
  const since = Number(new URL(request.url).searchParams.get("since") ?? 0);
  const rows = await db.select().from(refreshRuns).where(gte(refreshRuns.startedAt, new Date(Number.isFinite(since) ? since : 0))).orderBy(desc(refreshRuns.startedAt)).limit(1);
  return Response.json({ refresh: rows[0] ?? null });
};

export const config = { path: "/api/admin/refresh-status", method: "GET" };

