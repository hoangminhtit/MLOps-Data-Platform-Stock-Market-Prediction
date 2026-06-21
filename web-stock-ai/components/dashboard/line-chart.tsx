"use client";

import type { IntradayBar } from "@/types/market";

function formatPrice(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(2);
}

export function LineChart({ bars, latestPrice }: { bars: IntradayBar[]; latestPrice?: number | null }) {
  if (bars.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-border-accent border-t-accent animate-spin" />
        <p className="text-sm text-text-muted">Waiting for intraday stream...</p>
      </div>
    );
  }

  const sorted = [...bars].reverse();
  if (latestPrice != null) {
    const last = sorted[sorted.length - 1];
    if (!last || Math.abs(last.close_price - latestPrice) > 0.001) {
      sorted.push({
        ...(last ?? bars[0]),
        close_price: latestPrice,
        high_price: Math.max(last?.high_price ?? latestPrice, latestPrice),
        low_price: Math.min(last?.low_price ?? latestPrice, latestPrice),
        open_price: last?.close_price ?? latestPrice,
        window_start: new Date().toISOString(),
      });
    }
  }
  const closes = sorted.map((bar) => bar.close_price);
  const minV = Math.min(...closes);
  const maxV = Math.max(...closes);
  const span = maxV - minV || 1;

  const W = 600;
  const H = 220;
  const PL = 52;
  const PR = 12;
  const PT = 12;
  const PB = 28;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  function xPos(index: number) {
    return PL + (index / Math.max(sorted.length - 1, 1)) * chartW;
  }

  function yPos(value: number) {
    return PT + chartH - ((value - minV) / span) * chartH;
  }

  const linePath = sorted
    .map((bar, index) => `${index === 0 ? "M" : "L"} ${xPos(index).toFixed(1)} ${yPos(bar.close_price).toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${xPos(sorted.length - 1).toFixed(1)} ${(PT + chartH).toFixed(1)} L ${PL.toFixed(1)} ${(PT + chartH).toFixed(1)} Z`;

  const firstClose = sorted[0]?.close_price ?? 0;
  const lastClose = sorted[sorted.length - 1]?.close_price ?? 0;
  const isPositive = lastClose >= firstClose;
  const color = isPositive ? "#10b981" : "#ef4444";

  const yLabels = Array.from({ length: 5 }, (_, index) => {
    const val = minV + (span / 4) * index;
    return { val, y: yPos(val) };
  }).reverse();

  const xLabelStep = Math.max(1, Math.floor(sorted.length / 6));
  const xLabels = sorted
    .filter((_, index) => index === 0 || index === sorted.length - 1 || index % xLabelStep === 0)
    .map((bar) => {
      const index = sorted.indexOf(bar);
      return {
        x: xPos(index),
        label: bar.window_start ? new Date(bar.window_start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
      };
    });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ height: "220px" }} aria-label="Intraday price chart">
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yLabels.map(({ y }, index) => (
          <line key={index} x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(15,23,42,0.08)" strokeWidth="0.5" />
        ))}

        <path d={areaPath} fill="url(#chart-area-grad)" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        <circle cx={xPos(sorted.length - 1)} cy={yPos(lastClose)} r="4" fill={color} stroke="rgba(255,255,255,0.92)" strokeWidth="2" />

        {yLabels.map(({ val, y }, index) => (
          <text key={index} x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(82,97,115,0.9)" fontFamily="monospace">
            {formatPrice(val)}
          </text>
        ))}

        {xLabels.map(({ x, label }, index) => (
          <text key={index} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="rgba(82,97,115,0.75)" fontFamily="monospace">
            {label}
          </text>
        ))}

        <line x1={PL} y1={PT} x2={PL} y2={PT + chartH} stroke="rgba(15,23,42,0.12)" strokeWidth="1" />
        <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="rgba(15,23,42,0.12)" strokeWidth="1" />
      </svg>

      <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
        <span>{bars.length} one-minute bars + live price</span>
        <div className="flex items-center gap-3">
          <span>
            Min: <span className="font-mono text-text-secondary">{formatPrice(minV)}</span>
          </span>
          <span>
            Max: <span className="font-mono text-text-secondary">{formatPrice(maxV)}</span>
          </span>
          <span className={`font-mono font-bold ${isPositive ? "text-up" : "text-down"}`}>
            Intraday trend: {isPositive ? "UP" : "DOWN"} {formatPrice(lastClose)}
          </span>
        </div>
      </div>
    </div>
  );
}
