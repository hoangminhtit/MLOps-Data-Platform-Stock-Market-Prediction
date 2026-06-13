import type { InitialDashboardData } from "@/types/market";

export function clientApiBase() {
  if (typeof window !== "undefined" && window.location.port === "3000") {
    return "http://localhost:8080";
  }
  return "";
}

export function stockWebSocketUrl(symbol: string) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.port === "3000" ? "localhost:8080" : window.location.host;
  return `${protocol}://${host}/ws/stocks/${symbol}`;
}

export async function getInitialDashboardData(): Promise<InitialDashboardData> {
  const fallback: InitialDashboardData = {
    stocks: [],
    summary: null,
    news: [],
    intraday: [],
  };

  try {
    const [stocksResponse, summaryResponse, newsResponse, intradayResponse] = await Promise.all([
      fetch("http://gateway/api/stocks", { cache: "no-store" }),
      fetch("http://gateway/api/stocks/analytics/market-summary", { cache: "no-store" }),
      fetch("http://gateway/api/stocks/AAPL/news", { cache: "no-store" }),
      fetch("http://gateway/api/stocks/AAPL/intraday?limit=60", { cache: "no-store" }),
    ]);

    return {
      stocks: stocksResponse.ok ? (await stocksResponse.json()).items ?? [] : [],
      summary: summaryResponse.ok ? await summaryResponse.json() : null,
      news: newsResponse.ok ? (await newsResponse.json()).items ?? [] : [],
      intraday: intradayResponse.ok ? (await intradayResponse.json()).items ?? [] : [],
    };
  } catch {
    return fallback;
  }
}
