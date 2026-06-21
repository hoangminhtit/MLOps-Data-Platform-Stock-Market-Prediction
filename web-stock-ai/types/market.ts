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

export type StockPrediction = {
  symbol: string;
  prediction_date: string;
  target_date: string;
  predicted_close: number | null;
  confidence: number | null;
  model_name: string | null;
  model_version: string | null;
  created_at: string | null;
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
  latestPrices: LatestPrice[];
  summary: MarketSummary | null;
  news: StockNews[];
  intraday: IntradayBar[];
  predictions: StockPrediction[];
};
