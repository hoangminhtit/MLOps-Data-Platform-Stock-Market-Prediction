"use client";

import {
  Activity,
  BarChart3,
  BrainCircuit,
  Database,
  Newspaper,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LineChart } from "@/components/dashboard/line-chart";
import { type DashboardView, MarketHeader } from "@/components/dashboard/market-header";
import { StockWidget } from "@/components/dashboard/stock-widget";
import { clientApiBase, stockWebSocketUrl } from "@/lib/api";
import { formatTime, numberFormat, priceFormat } from "@/lib/formatters";
import type {
  InitialDashboardData,
  IntradayBar,
  LatestPrice,
  MarketSummary,
  Stock,
  StockNews,
  StockPrediction,
} from "@/types/market";

type PriceHistory = Record<string, number[]>;
type LatestBySymbol = Record<string, LatestPrice | undefined>;

function appendPrice(history: number[], price: number | null) {
  if (price == null) return history;
  return [...history, price].slice(-40);
}

function sortDisplayStocks(stocks: Stock[]) {
  return [...stocks].sort((left, right) => {
    const leftRank = left.exchange === "HOSE" ? 0 : 1;
    const rightRank = right.exchange === "HOSE" ? 0 : 1;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.symbol.localeCompare(right.symbol);
  });
}

function latestMap(items: LatestPrice[]) {
  return items.reduce<LatestBySymbol>((acc, item) => {
    acc[item.symbol] = item;
    return acc;
  }, {});
}

function initialHistoryFromLatest(items: LatestPrice[]) {
  return items.reduce<PriceHistory>((acc, item) => {
    if (item.price != null) acc[item.symbol] = [item.price];
    return acc;
  }, {});
}

function formatNullablePrice(value: number | null | undefined) {
  return value == null ? "--" : priceFormat.format(value);
}

function formatSigned(value: number | null) {
  if (value == null) return "--";
  return `${value >= 0 ? "+" : ""}${priceFormat.format(value)}`;
}

function rowFromLive(stock: Stock, latest: LatestPrice | undefined, history: number[]) {
  const price = latest?.price ?? null;
  const ref = history[0] ?? null;
  const high = history.length ? Math.max(...history) : price;
  const low = history.length ? Math.min(...history) : price;
  const change = price != null && ref != null ? price - ref : null;
  const percent = change != null && ref ? (change / ref) * 100 : null;
  const ceiling = ref != null ? ref * 1.07 : null;
  const floor = ref != null ? ref * 0.93 : null;
  return { stock, latest, price, ref, high, low, change, percent, ceiling, floor, hasLive: price != null };
}

export default function RealtimeDashboard({ initialData }: { initialData: InitialDashboardData }) {
  const sortedInitialStocks = useMemo(() => sortDisplayStocks(initialData.stocks), [initialData.stocks]);
  const [stocks] = useState<Stock[]>(sortedInitialStocks);
  const [selectedSymbol, setSelectedSymbol] = useState(sortedInitialStocks[0]?.symbol ?? "VIC");
  const [activeView, setActiveView] = useState<DashboardView>("Home");
  const [latestBySymbol, setLatestBySymbol] = useState<LatestBySymbol>(() => latestMap(initialData.latestPrices));
  const [priceHistory, setPriceHistory] = useState<PriceHistory>(() => initialHistoryFromLatest(initialData.latestPrices));
  const [summary, setSummary] = useState<MarketSummary | null>(initialData.summary);
  const [news, setNews] = useState<StockNews[]>(initialData.news);
  const [predictions, setPredictions] = useState<StockPrediction[]>(initialData.predictions);
  const [intraday, setIntraday] = useState<IntradayBar[]>(initialData.intraday);
  const [connected, setConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All Sectors");

  useEffect(() => {
    let active = true;

    async function loadSymbolData() {
      const [latestResponse, newsResponse, intradayResponse, summaryResponse, predictionsResponse] = await Promise.all([
        fetch(`${clientApiBase()}/api/stocks/latest`),
        fetch(`${clientApiBase()}/api/stocks/${selectedSymbol}/news?limit=8`),
        fetch(`${clientApiBase()}/api/stocks/${selectedSymbol}/intraday?limit=80`),
        fetch(`${clientApiBase()}/api/stocks/analytics/market-summary`),
        fetch(`${clientApiBase()}/api/stocks/${selectedSymbol}/predictions?limit=3`),
      ]);

      if (!active) return;
      if (latestResponse.ok) {
        const items = ((await latestResponse.json()).items ?? []) as LatestPrice[];
        setLatestBySymbol((current) => ({ ...current, ...latestMap(items) }));
        setPriceHistory((current) => {
          const next = { ...current };
          for (const item of items) {
            next[item.symbol] = appendPrice(next[item.symbol] ?? [], item.price);
          }
          return next;
        });
      }
      if (newsResponse.ok) setNews((await newsResponse.json()).items ?? []);
      if (predictionsResponse.ok) setPredictions((await predictionsResponse.json()).items ?? []);
      if (intradayResponse.ok) {
        const items = (await intradayResponse.json()).items ?? [];
        setIntraday(items);
      }
      if (summaryResponse.ok) setSummary(await summaryResponse.json());
    }

    loadSymbolData();
    const interval = window.setInterval(loadSymbolData, 10000);
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

    return () => socket.close();
  }, [selectedSymbol]);

  const selectedStock = stocks.find((stock) => stock.symbol === selectedSymbol);
  const latest = latestBySymbol[selectedSymbol];
  const prediction = predictions[0];
  const sectors = useMemo(
    () => ["All Sectors", ...Array.from(new Set(stocks.map((stock) => stock.sector).filter((value): value is string => Boolean(value))))],
    [stocks],
  );
  const filteredStocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stocks.filter((stock) => {
      const matchesQuery =
        !query ||
        [stock.symbol, stock.name, stock.exchange, stock.sector, stock.industry].some((value) =>
          value?.toLowerCase().includes(query),
        );
      const matchesSector = sectorFilter === "All Sectors" || stock.sector === sectorFilter;
      return matchesQuery && matchesSector;
    });
  }, [search, sectorFilter, stocks]);

  const stockRows = useMemo(
    () => filteredStocks.map((stock) => rowFromLive(stock, latestBySymbol[stock.symbol], priceHistory[stock.symbol] ?? [])),
    [filteredStocks, latestBySymbol, priceHistory],
  );
  const liveRows = stockRows.filter((row) => row.hasLive);
  const bullish = liveRows.filter((row) => (row.percent ?? 0) > 0).length;
  const bearish = liveRows.filter((row) => (row.percent ?? 0) < 0).length;
  const averageChange = liveRows.length
    ? liveRows.reduce((sum, row) => sum + (row.percent ?? 0), 0) / liveRows.length
    : null;

  return (
    <main className="min-h-screen bg-bg-base text-text-primary">
      <MarketHeader activeView={activeView} onViewChange={setActiveView} />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border-accent bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
              <Activity size={14} />
              {activeView === "Home" ? "Realtime market" : activeView}
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-text-primary sm:text-5xl">
              {activeView === "News"
                ? "Market News"
                : activeView === "Analytics"
                  ? "Market Analytics"
                  : activeView === "Stocks"
                    ? "Live Stock Board"
                    : "StockAI Realtime Trading Intelligence"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
              Data on this screen is read from Kafka to ScyllaDB streaming latest prices and PostgreSQL warehouse facts.
              Missing rows are shown as waiting for stream, not fabricated.
            </p>
          </div>

          <div className="grid gap-3">
            <label className="glass flex h-12 items-center gap-3 rounded-xl px-4">
              <Search size={18} className="text-text-secondary" />
              <input
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search symbol, company, sector..."
                value={search}
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <div className={connected ? "text-up" : "text-warning"}>
                <div className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold">
                  {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
                  {connected ? "Live socket" : "Waiting for socket"}
                </div>
              </div>
              <button
                className="glass card-hover inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-text-secondary"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      {activeView === "Home" ? (
        <HomeView
          filteredStocks={filteredStocks}
          intraday={intraday}
          latest={latest}
          latestBySymbol={latestBySymbol}
          news={news}
          prediction={prediction}
          priceHistory={priceHistory}
          selectedStock={selectedStock}
          selectedSymbol={selectedSymbol}
          setSelectedSymbol={setSelectedSymbol}
          summary={summary}
        />
      ) : null}

      {activeView === "Stocks" ? (
        <StocksView
          sectors={sectors}
          sectorFilter={sectorFilter}
          setSectorFilter={setSectorFilter}
          rows={stockRows}
          setSelectedSymbol={setSelectedSymbol}
        />
      ) : null}

      {activeView === "News" ? <NewsView news={news} sectors={sectors} selectedStock={selectedStock} selectedSymbol={selectedSymbol} /> : null}

      {activeView === "Analytics" ? (
        <AnalyticsView
          averageChange={averageChange}
          bearish={bearish}
          bullish={bullish}
          liveRows={liveRows}
          rows={stockRows}
          stocks={stocks}
          summary={summary}
        />
      ) : null}

      <div className="fixed bottom-4 right-4 z-30 hidden rounded-full border border-border-default bg-bg-card/90 px-4 py-2 text-xs font-bold text-text-secondary shadow-2xl backdrop-blur sm:block">
        <span className="text-accent">{selectedSymbol}</span> selected
      </div>
    </main>
  );
}

function HomeView({
  filteredStocks,
  intraday,
  latest,
  latestBySymbol,
  news,
  prediction,
  priceHistory,
  selectedStock,
  selectedSymbol,
  setSelectedSymbol,
  summary,
}: {
  filteredStocks: Stock[];
  intraday: IntradayBar[];
  latest: LatestPrice | undefined;
  latestBySymbol: LatestBySymbol;
  news: StockNews[];
  prediction: StockPrediction | undefined;
  priceHistory: PriceHistory;
  selectedStock: Stock | undefined;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  summary: MarketSummary | null;
}) {
  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {filteredStocks.slice(0, 5).map((stock) => (
          <StockWidget
            active={stock.symbol === selectedSymbol}
            history={priceHistory[stock.symbol] ?? []}
            key={stock.symbol}
            latest={latestBySymbol[stock.symbol]}
            onSelect={() => setSelectedSymbol(stock.symbol)}
            stock={stock}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-2xl p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-accent">{selectedSymbol}</p>
              <h2 className="mt-1 text-xl font-black text-text-primary">{selectedStock?.name ?? "Streaming symbol"}</h2>
              <p className="mt-1 text-sm text-text-secondary">{selectedStock?.industry ?? "Waiting for metadata"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Latest price</p>
              <p className="mt-1 font-mono text-2xl font-black text-text-primary">{formatNullablePrice(latest?.price)}</p>
            </div>
          </div>
          <LineChart bars={intraday} latestPrice={latest?.price} />
        </div>

        <aside className="grid gap-4">
          <MetricCard label="Live symbols" value={summary?.live_symbols ?? 0} sub={`${summary?.tracked_symbols ?? 0} tracked`} />
          <MetricCard label="Total volume" value={numberFormat.format(summary?.total_volume ?? 0)} sub="streaming latest store" />
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-text-primary">Prediction</h3>
                <p className="text-xs text-text-secondary">from warehouse baseline</p>
              </div>
              <BrainCircuit className="text-accent" size={20} />
            </div>
            {prediction ? (
              <div className="mt-5">
                <p className="text-xs text-text-muted">Target {prediction.target_date}</p>
                <p className="mt-1 font-mono text-3xl font-black text-text-primary">{formatNullablePrice(prediction.predicted_close)}</p>
                <p className="mt-2 text-xs text-text-secondary">
                  confidence {prediction.confidence == null ? "--" : `${Math.round(prediction.confidence * 100)}%`}
                </p>
              </div>
            ) : (
              <EmptyState text="No prediction saved yet." />
            )}
          </div>
        </aside>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-black text-text-primary">Latest warehouse news</h2>
            <p className="text-sm text-text-secondary">News is shown only when loaded by batch pipeline.</p>
          </div>
          <Newspaper className="text-accent" size={20} />
        </div>
        <NewsList news={news} selectedSymbol={selectedSymbol} compact />
      </div>
    </section>
  );
}

function StocksView({
  rows,
  sectors,
  sectorFilter,
  setSectorFilter,
  setSelectedSymbol,
}: {
  rows: ReturnType<typeof rowFromLive>[];
  sectors: string[];
  sectorFilter: string;
  setSectorFilter: (sector: string) => void;
  setSelectedSymbol: (symbol: string) => void;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-xl bg-accent px-4 py-2 text-sm font-black text-bg-base">Live board</span>
          <span className="rounded-xl border border-border-default px-4 py-2 text-sm font-bold text-text-secondary">
            {rows.filter((row) => row.hasLive).length}/{rows.length} streaming
          </span>
        </div>
        <select
          className="h-10 rounded-xl border border-border-default bg-bg-card px-3 text-sm font-bold text-text-primary outline-none"
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value)}
        >
          {sectors.map((sector) => (
            <option key={sector}>{sector}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-2xl">
        <div className="max-h-[68vh] overflow-auto scrollbar-thin">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 bg-bg-elevated text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-right">Reference</th>
                <th className="px-4 py-3 text-right">Latest</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3 text-right">High</th>
                <th className="px-4 py-3 text-right">Low</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const positive = (row.percent ?? 0) >= 0;
                return (
                  <tr
                    className="border-t border-border-default transition-colors hover:bg-bg-card-hover"
                    key={row.stock.symbol}
                    onClick={() => setSelectedSymbol(row.stock.symbol)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-black text-text-primary">{row.stock.symbol}</div>
                      <div className="text-xs text-text-muted">{row.stock.name ?? row.stock.exchange}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{formatNullablePrice(row.ref)}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-text-primary">{formatNullablePrice(row.price)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${positive ? "text-up" : "text-down"}`}>{formatSigned(row.change)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${positive ? "text-up" : "text-down"}`}>
                      {row.percent == null ? "--" : `${row.percent >= 0 ? "+" : ""}${row.percent.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{formatNullablePrice(row.high)}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{formatNullablePrice(row.low)}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{row.latest?.volume == null ? "--" : numberFormat.format(row.latest.volume)}</td>
                    <td className="px-4 py-3 text-center">
                      {row.hasLive ? (
                        <span className="rounded-full bg-up-soft px-3 py-1 text-xs font-black text-up">LIVE</span>
                      ) : (
                        <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-black text-warning">WAITING</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function NewsView({
  news,
  sectors,
  selectedStock,
  selectedSymbol,
}: {
  news: StockNews[];
  sectors: string[];
  selectedStock: Stock | undefined;
  selectedSymbol: string;
}) {
  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 lg:grid-cols-[1fr_340px] sm:px-6">
      <div className="glass rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-black text-bg-base">All</span>
          {sectors.slice(1, 7).map((sector) => (
            <span className="rounded-full border border-border-default px-3 py-1 text-xs font-bold text-text-secondary" key={sector}>
              {sector}
            </span>
          ))}
        </div>
        <NewsList news={news} selectedSymbol={selectedSymbol} />
      </div>
      <aside className="glass h-fit rounded-2xl p-5">
        <h2 className="font-black text-text-primary">News coverage</h2>
        <p className="mt-1 text-sm text-text-secondary">{selectedStock?.name ?? selectedSymbol}</p>
        <div className="mt-6 grid place-items-center rounded-2xl border border-border-default bg-bg-surface p-8">
          <div className="grid h-32 w-32 place-items-center rounded-full border-[18px] border-accent text-2xl font-black text-text-primary">
            {news.length}
          </div>
        </div>
      </aside>
    </section>
  );
}

function AnalyticsView({
  averageChange,
  bearish,
  bullish,
  liveRows,
  rows,
  stocks,
  summary,
}: {
  averageChange: number | null;
  bearish: number;
  bullish: number;
  liveRows: ReturnType<typeof rowFromLive>[];
  rows: ReturnType<typeof rowFromLive>[];
  stocks: Stock[];
  summary: MarketSummary | null;
}) {
  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 sm:px-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tracked" value={stocks.length} sub="metadata symbols" />
        <MetricCard label="Live" value={liveRows.length} sub="streaming latest" tone="accent" />
        <MetricCard label="Bullish" value={bullish} sub="from live change" tone="up" />
        <MetricCard label="Bearish" value={bearish} sub="from live change" tone="down" />
        <MetricCard label="Avg change" value={averageChange == null ? "--" : `${averageChange.toFixed(2)}%`} sub="live symbols" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-accent">Market breadth</p>
              <h2 className="mt-1 text-xl font-black text-text-primary">Live direction</h2>
            </div>
            <BarChart3 className="text-accent" />
          </div>
          <div className="grid gap-3">
            <DirectionBar label="Bullish" value={bullish} total={Math.max(liveRows.length, 1)} tone="up" />
            <DirectionBar label="Bearish" value={bearish} total={Math.max(liveRows.length, 1)} tone="down" />
            <DirectionBar label="Waiting" value={rows.length - liveRows.length} total={Math.max(rows.length, 1)} tone="muted" />
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-accent">Liquidity</p>
              <h2 className="mt-1 text-xl font-black text-text-primary">Streaming volume leaders</h2>
            </div>
            <Database className="text-accent" />
          </div>
          <div className="grid gap-3">
            {[...liveRows]
              .sort((a, b) => (b.latest?.volume ?? 0) - (a.latest?.volume ?? 0))
              .slice(0, 8)
              .map((row) => (
                <div className="grid grid-cols-[56px_1fr_auto] items-center gap-3" key={row.stock.symbol}>
                  <span className="font-black text-text-primary">{row.stock.symbol}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, ((row.latest?.volume ?? 0) / Math.max(summary?.total_volume ?? 1, 1)) * 500)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-text-secondary">{numberFormat.format(row.latest?.volume ?? 0)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: "accent" | "up" | "down" }) {
  const toneClass = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "accent" ? "text-accent" : "text-text-primary";
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-black ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{sub}</p>
    </div>
  );
}

function DirectionBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: "up" | "down" | "muted" }) {
  const width = `${Math.round((value / total) * 100)}%`;
  const color = tone === "up" ? "bg-up" : tone === "down" ? "bg-down" : "bg-text-muted";
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-bold text-text-primary">{label}</span>
        <span className="font-mono text-text-secondary">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-bg-elevated">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
      {text}
    </div>
  );
}

function NewsList({ news, selectedSymbol, compact = false }: { news: StockNews[]; selectedSymbol: string; compact?: boolean }) {
  if (news.length === 0) {
    return <EmptyState text={`No warehouse news for ${selectedSymbol}.`} />;
  }

  return (
    <div className={compact ? "grid gap-3 md:grid-cols-2" : "grid gap-3"}>
      {news.map((item) => (
        <article className="rounded-xl border border-border-default bg-bg-surface p-4" key={item.url ?? item.title}>
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-black text-accent">{item.symbol}</span>
            <span className="text-xs text-text-muted">{item.published_at ? formatTime(item.published_at) : "--"}</span>
          </div>
          <h3 className="font-bold leading-snug text-text-primary">{item.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">{item.content}</p>
        </article>
      ))}
    </div>
  );
}
