import { TrendingDown, TrendingUp } from "lucide-react";

import { numberFormat, priceFormat } from "@/lib/formatters";
import type { LatestPrice, Stock } from "@/types/market";

function sparklinePath(values: number[]) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 80 - ((value - min) / span) * 60;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function StockWidget({
  stock,
  latest,
  history,
  active,
  onSelect,
}: {
  stock: Stock;
  latest?: LatestPrice;
  history: number[];
  active: boolean;
  onSelect: () => void;
}) {
  const first = history[0] ?? latest?.price ?? 0;
  const last = history[history.length - 1] ?? latest?.price ?? 0;
  const changePercent = first ? ((last - first) / first) * 100 : 0;
  const positive = changePercent >= 0;
  const path = sparklinePath(history);

  return (
    <button className={active ? "stockWidget active" : "stockWidget"} onClick={onSelect}>
      <div className="widgetTop">
        <div>
          <strong>{stock.symbol}</strong>
          <span>{stock.exchange ?? "US"}</span>
        </div>
        <em>{latest?.price == null ? "--" : priceFormat.format(latest.price)}</em>
      </div>

      <svg className="sparkline" viewBox="0 0 100 90" preserveAspectRatio="none" aria-label={`${stock.symbol} sparkline`}>
        <path d="M 0 48 L 100 48" className="sparkRef" />
        {path ? <path d={path} className={positive ? "sparkPath up" : "sparkPath down"} /> : null}
        {!path ? <text x="50" y="48" textAnchor="middle">Loading</text> : null}
      </svg>

      <div className="widgetFooter">
        <span className={positive ? "change up" : "change down"}>
          {positive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          {positive ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
        <span>{numberFormat.format(latest?.volume ?? 0)}</span>
      </div>
    </button>
  );
}
