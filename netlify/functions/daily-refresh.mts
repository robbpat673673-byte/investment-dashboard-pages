import { refreshDashboardData } from "../../server/services/dashboardRefresh";

/** Runs at 00:00 UTC, equivalent to 08:00 in Asia/Taipei. */
export default async () => {
  await refreshDashboardData();
};

export const config = { schedule: "0 0 * * *", background: true };

