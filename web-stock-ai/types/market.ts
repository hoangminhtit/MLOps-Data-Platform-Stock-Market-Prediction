export type Stock = {
  symbol: string;
  name?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
};

export type LatestPrice = {
  symbol: string;
  price: number | null;
  volume: number | null;
  event_time: string | null;
  source: string | null;
  message?: string | null;
};

export type IntradayBar = {
  symbol: string;
  window_start: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
};

export type StockNews = {
  symbol: string;
  source: string | null;
  published_at: string | null;
  title: string;
  content: string | null;
  url: string | null;
  sentiment_score: number | null;
};

export type MarketSummary = {
  tracked_symbols: number;
  live_symbols: number;
  average_price: number | null;
  total_volume: number;
  source: string;
};

export type InitialDashboardData = {
  stocks: Stock[];
  summary: MarketSummary | null;
  news: StockNews[];
  intraday: IntradayBar[];
};
