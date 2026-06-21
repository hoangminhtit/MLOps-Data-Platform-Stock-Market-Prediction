"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useId } from "react";

import { numberFormat, priceFormat } from "@/lib/formatters";
import type { LatestPrice, Stock } from "@/types/market";

function SparklineArea({ values, positive }: { values: number[]; positive: boolean }) {
  const gradientId = useId();
  if (values.length < 2) return null;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const anchor = values[0] || values[values.length - 1] || 1;
  const actualSpan = maxValue - minValue;
  const minimumSpan = Math.max(Math.abs(anchor) * 0.035, 1);
  const span = Math.max(actualSpan * 1.35, minimumSpan);
  const midpoint = (minValue + maxValue) / 2;
  const min = midpoint - span / 2;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * 100,
    y: 78 - ((v - min) / span) * 56,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} 90 L 0 90 Z`;
  const color = positive ? "#10b981" : "#ef4444";

  return (
    <svg className="w-full h-[56px]" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
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
          ? "border-border-accent shadow-[0_0_0_1px_rgba(8,145,178,0.2),0_16px_36px_rgba(15,23,42,0.12)]"
          : "border-border-default",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-base text-text-primary leading-none">{stock.symbol}</div>
          <div className="text-[10px] text-text-muted mt-1">{stock.exchange ?? "HOSE"}</div>
        </div>
        {hasData ? (
          <div
            className={[
              "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
              positive ? "bg-up-soft text-up" : "bg-down-soft text-down",
            ].join(" ")}
          >
            {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            LIVE
            {positive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </div>
        ) : (
          <div className="text-[10px] text-text-muted">Waiting...</div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg">
        {history.length >= 2 ? (
          <SparklineArea values={history} positive={positive} />
        ) : (
          <div className="h-14 flex items-center justify-center">
            <div className="text-[10px] text-text-muted shimmer px-3 py-1 rounded">Waiting for stream...</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-sm text-text-primary tabular-nums">
          {latest?.price == null ? "---" : priceFormat.format(latest.price)}
        </span>
        <span className="text-[10px] text-text-muted tabular-nums">
          Vol {latest?.volume == null ? "---" : numberFormat.format(latest.volume)}
        </span>
      </div>
    </button>
  );
}
