import type { Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { refreshDashboardData } from "../../server/services/dashboardRefresh";

/**
 * Long-running refresh worker. Netlify returns 202 before the task completes;
 * the dashboard reads refresh_runs to show the most recently completed result.
 */
export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user?.roles.includes("admin")) return new Response("Forbidden", { status: 403 });
  await refreshDashboardData();
  return new Response(null, { status: 204 });
};

export const config = { path: "/api/admin/refresh", method: "POST", background: true };

