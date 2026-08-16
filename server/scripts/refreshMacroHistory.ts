import { MACRO_HISTORY_TICKERS, refreshMacroHistory } from "../services/dashboardRefresh";

async function main() {
  const result = await refreshMacroHistory(MACRO_HISTORY_TICKERS);
  console.log(JSON.stringify({ tickers: MACRO_HISTORY_TICKERS, ...result }, null, 2));
  if (result.errors.length > 0) process.exitCode = 1;
}

void main();
