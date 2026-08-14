import { refreshDashboardData } from "../services/dashboardRefresh";

refreshDashboardData()
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "failed" ? 1 : 0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
