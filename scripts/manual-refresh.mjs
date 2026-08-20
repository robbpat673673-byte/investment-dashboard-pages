import { refreshDashboardData } from "../server/services/dashboardRefresh.ts";

const startedAt = new Date().toISOString();
try {
  const result = await refreshDashboardData();
  console.log(JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), result }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
