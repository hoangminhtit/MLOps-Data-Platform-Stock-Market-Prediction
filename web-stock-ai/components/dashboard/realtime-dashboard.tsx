"use client";

import { Bell, Database, Newspaper, Radio, RefreshCw, Search, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LineChart } from "@/components/dashboard/line-chart";
import { MarketHeader } from "@/components/dashboard/market-header";
import { StockWidget } from "@/components/dashboard/stock-widget";
import { clientApiBase, stockWebSocketUrl } from "@/lib/api";
import { formatTime, numberFormat, priceFormat } from "@/lib/formatters";
import type { InitialDashboardData, IntradayBar, LatestPrice, MarketSummary, Stock, StockNews } from "@/types/market";

type PriceHistory = Record<string, number[]>;
type LatestBySymbol = Record<string, LatestPrice | undefined>;

function pricesFromBars(bars: IntradayBar[]) {
  return [...bars].reverse().map((bar) => bar.close_price).slice(-32);
}

function appendPrice(history: number[], price: number | null) {
  if (price == null) return history;
  return [...history, price].slice(-32);
}

export default function RealtimeDashboard({ initialData }: { initialData: InitialDashboardData }) {
  const [stocks] = useState<Stock[]>(initialData.stocks);
  const [selectedSymbol, setSelectedSymbol] = useState(initialData.stocks[0]?.symbol ?? "AAPL");
  const [latestBySymbol, setLatestBySymbol] = useState<LatestBySymbol>({});
  const [priceHistory, setPriceHistory] = useState<PriceHistory>({});
  const [summary, setSummary] = useState<MarketSummary | null>(initialData.summary);
  const [news, setNews] = useState<StockNews[]>(initialData.news);
  const [intraday, setIntraday] = useState<IntradayBar[]>(initialData.intraday);
  const [connected, setConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (initialData.intraday.length === 0) return;
    setPriceHistory((current) => ({
      ...current,
      [selectedSymbol]: pricesFromBars(initialData.intraday),
    }));
  }, [initialData.intraday, selectedSymbol]);

  useEffect(() => {
    let active = true;

    async function loadSymbolData() {
      const [newsResponse, intradayResponse, summaryResponse] = await Promise.all([
        fetch(`${clientApiBase()}/api/stocks/${selectedSymbol}/news?limit=8`),
        fetch(`${clientApiBase()}/api/stocks/${selectedSymbol}/intraday?limit=80`),
        fetch(`${clientApiBase()}/api/stocks/analytics/market-summary`),
      ]);

      if (!active) return;
      if (newsResponse.ok) setNews((await newsResponse.json()).items ?? []);
      if (intradayResponse.ok) {
        const items = (await intradayResponse.json()).items ?? [];
        setIntraday(items);
        setPriceHistory((current) => ({ ...current, [selectedSymbol]: pricesFromBars(items) }));
      }
      if (summaryResponse.ok) setSummary(await summaryResponse.json());
    }

    loadSymbolData();
    const interval = window.setInterval(loadSymbolData, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [selectedSymbol, refreshKey]);

  useEffect(() => {
    const socket = new WebSocket(stockWebSocketUrl(selectedSymbol));

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as LatestPrice;
      setLatestBySymbol((current) => ({ ...current, [payload.symbol]: payload }));
      setPriceHistory((current) => ({
        ...current,
        [payload.symbol]: appendPrice(current[payload.symbol] ?? [], payload.price),
      }));
    };

    return () => {
      socket.close();
    };
  }, [selectedSymbol]);

  const selectedStock = stocks.find((stock) => stock.symbol === selectedSymbol);
  const latest = latestBySymbol[selectedSymbol];
  const latestPrice = latest?.price ?? null;
  const filteredStocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stocks;
    return stocks.filter((stock) =>
      [stock.symbol, stock.name, stock.exchange, stock.sector, stock.industry].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [search, stocks]);

  return (
    <main className="dashboardShell">
      <MarketHeader />

      <section className="heroSection">
        <div className="heroCopy">
          <p className="eyebrow">Realtime Dashboard</p>
          <h1>Predict Stock Price Smart</h1>
          <span>
            Theo doi gia realtime, tin tuc va snapshot warehouse tren cung mot man hinh van hanh.
          </span>
        </div>

        <div className="heroActions">
          <label className="searchBox">
            <Search size={18} />
            <input
              aria-label="Search stocks"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search symbol, company, sector..."
              value={search}
            />
          </label>
          <div className={connected ? "connection online" : "connection offline"}>
            {connected ? <Wifi size={18} /> : <WifiOff size={18} />}
            {connected ? "Live socket" : "Reconnecting"}
          </div>
        </div>
      </section>

      <section className="widgetRail" aria-label="Stock watchlist">
        {filteredStocks.map((stock) => (
          <StockWidget
            active={stock.symbol === selectedSymbol}
            history={priceHistory[stock.symbol] ?? []}
            key={stock.symbol}
            latest={latestBySymbol[stock.symbol]}
            onSelect={() => setSelectedSymbol(stock.symbol)}
            stock={stock}
          />
        ))}
      </section>

      <section className="overviewGrid" aria-label="Market summary">
        <div className="stat primary">
          <span>Last Price</span>
          <strong>{latestPrice === null ? "--" : `$${priceFormat.format(latestPrice)}`}</strong>
          <small>{selectedStock?.name ?? "Tracked stock"}</small>
        </div>
        <div className="stat">
          <span>Volume</span>
          <strong>{numberFormat.format(latest?.volume ?? 0)}</strong>
          <small>{formatTime(latest?.event_time ?? null)}</small>
        </div>
        <div className="stat">
          <span>Live Symbols</span>
          <strong>{summary?.live_symbols ?? "--"}</strong>
          <small>{summary?.tracked_symbols ?? stocks.length} tracked</small>
        </div>
        <div className="stat">
          <span>Total Volume</span>
          <strong>{numberFormat.format(summary?.total_volume ?? 0)}</strong>
          <small>latest snapshot</small>
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel chartPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">{selectedSymbol} Market Monitor</p>
              <h2>Intraday OHLCV</h2>
              <span>{selectedStock?.industry ?? "1-minute close price from ScyllaDB"}</span>
            </div>
            <button className="iconButton" onClick={() => setRefreshKey((value) => value + 1)} title="Refresh">
              <RefreshCw size={18} />
            </button>
          </div>
          <LineChart bars={intraday} />
        </div>

        <aside className="rightColumn">
          <div className="panel streamPanel">
            <div className="panelHeader">
              <div>
                <h2>Live Feed</h2>
                <span>Kafka to ScyllaDB to WebSocket</span>
              </div>
              <Radio size={18} />
            </div>
            <div className="feedList">
              <div>
                <span>Symbol</span>
                <strong>{latest?.symbol ?? selectedSymbol}</strong>
              </div>
              <div>
                <span>Event Time</span>
                <strong>{formatTime(latest?.event_time ?? null)}</strong>
              </div>
              <div>
                <span>Source</span>
                <strong>{latest?.source ?? "--"}</strong>
              </div>
            </div>
          </div>

          <div className="panel sourcePanel">
            <div className="panelHeader compact">
              <div>
                <h2>Data Source</h2>
                <span>Operational stores</span>
              </div>
              <Database size={18} />
            </div>
            <div className="sourceList">
              <span>ScyllaDB online store</span>
              <span>PostgreSQL warehouse</span>
              <span>FastAPI realtime gateway</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="panel newsPanel">
        <div className="panelHeader">
          <div>
            <h2>Market News</h2>
            <span>Loaded from PostgreSQL warehouse</span>
          </div>
          <Newspaper size={18} />
        </div>
        <div className="newsList">
          {news.length === 0 ? (
            <div className="emptyState">No warehouse news for {selectedSymbol}</div>
          ) : (
            news.map((item) => (
              <article className="newsItem" key={item.url ?? item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.content}</p>
                </div>
                <span>{item.sentiment_score === null ? "n/a" : item.sentiment_score.toFixed(2)}</span>
              </article>
            ))
          )}
        </div>
      </section>

      <div className="toast">
        <Bell size={16} />
        <span>{connected ? `${selectedSymbol} stream active` : "Waiting for live data"}</span>
      </div>
    </main>
  );
}
