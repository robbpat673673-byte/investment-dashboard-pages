import { getDb } from "../../server/db";

export default async () => {
  const db = await getDb();
  return Response.json({ ok: Boolean(db), runtime: "netlify", checkedAt: new Date().toISOString() }, { status: db ? 200 : 503 });
};

export const config = { path: "/api/health", method: "GET" };

