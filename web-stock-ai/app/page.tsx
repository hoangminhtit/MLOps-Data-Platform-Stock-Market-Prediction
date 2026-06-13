import { Activity, Database, Server, TrendingUp } from "lucide-react";

async function getStocks() {
  try {
    const response = await fetch("http://gateway/api/stocks", { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return payload.items ?? [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const stocks = await getStocks();

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">MLOps Data Platform</p>
          <h1>Stock Market Operations Dashboard</h1>
        </div>
        <div className="status">
          <Activity size={18} />
          Gateway route ready
        </div>
      </section>

      <section className="metrics" aria-label="Platform status">
        <div className="metric">
          <Server size={20} />
          <span>FastAPI backend</span>
          <strong>Online</strong>
        </div>
        <div className="metric">
          <Database size={20} />
          <span>Warehouse</span>
          <strong>Schema ready</strong>
        </div>
        <div className="metric">
          <TrendingUp size={20} />
          <span>Realtime stream</span>
          <strong>Next phase</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Tracked Symbols</h2>
          <span>{stocks.length} seeded</span>
        </div>
        <div className="table">
          <div className="row head">
            <span>Symbol</span>
            <span>Company</span>
            <span>Exchange</span>
          </div>
          {stocks.map((stock: { symbol: string; name: string; exchange: string }) => (
            <div className="row" key={stock.symbol}>
              <strong>{stock.symbol}</strong>
              <span>{stock.name}</span>
              <span>{stock.exchange}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
