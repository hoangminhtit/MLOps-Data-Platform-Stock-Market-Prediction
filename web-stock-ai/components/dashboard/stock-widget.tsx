"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { numberFormat, priceFormat } from "@/lib/formatters";
import type { LatestPrice, Stock } from "@/types/market";

function sparklinePath(values: number[]) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 80 - ((v - min) / span) * 60;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function SparklineArea({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * 100,
    y: 80 - ((v - min) / span) * 60,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} 90 L 0 90 Z`;
  const color = positive ? "#10b981" : "#ef4444";
  const gradientId = `spark-${positive ? "up" : "dn"}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg className="w-full h-[56px]" viewBox="0 0 100 90" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
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
  const hasData = latest?.price != null;

  return (
    <button
      id={`stock-widget-${stock.symbol}`}
      onClick={onSelect}
      className={[
        "glass card-hover rounded-xl p-4 flex flex-col gap-3 text-left transition-all duration-200 w-full",
        active
          ? "border-[var(--color-border-accent)] shadow-[0_0_0_1px_rgba(6,182,212,0.2),0_8px_32px_rgba(0,0,0,0.5)]"
          : "border-[var(--color-border-default)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-base text-white leading-none">{stock.symbol}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{stock.exchange ?? "HOSE"}</div>
        </div>
        {hasData ? (
          <div
            className={[
              "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
              positive
                ? "bg-[var(--color-up-soft)] text-[var(--color-up)]"
                : "bg-[var(--color-down-soft)] text-[var(--color-down)]",
            ].join(" ")}
          >
            {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {positive ? "+" : ""}{changePercent.toFixed(2)}%
          </div>
        ) : (
          <div className="text-[10px] text-[var(--color-text-muted)]">Chờ data...</div>
        )}
      </div>

      {/* Sparkline */}
      <div className="overflow-hidden rounded-lg">
        {history.length >= 2 ? (
          <SparklineArea values={history} positive={positive} />
        ) : (
          <div className="h-14 flex items-center justify-center">
            <div className="text-[10px] text-[var(--color-text-muted)] shimmer px-3 py-1 rounded">
              Đang nhận dữ liệu...
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-sm text-white tabular-nums">
          {latest?.price == null ? "---" : priceFormat.format(latest.price)}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
          Vol {latest?.volume == null ? "---" : numberFormat.format(latest.volume)}
        </span>
      </div>
    </button>
  );
}
