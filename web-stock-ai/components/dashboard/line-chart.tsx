"use client";

import type { IntradayBar } from "@/types/market";

function formatPrice(value: number) {
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}K`
    : value.toFixed(2);
}

export function LineChart({ bars }: { bars: IntradayBar[] }) {
  if (bars.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-[var(--color-border-accent)] border-t-[var(--color-accent)] animate-spin" />
        <p className="text-sm text-[var(--color-text-muted)]">Đang chờ dữ liệu intraday...</p>
      </div>
    );
  }

  const sorted = [...bars].reverse();
  const closes = sorted.map((b) => b.close_price);
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

  function xPos(i: number) {
    return PL + (i / (sorted.length - 1)) * chartW;
  }
  function yPos(v: number) {
    return PT + chartH - ((v - minV) / span) * chartH;
  }

  const linePath = sorted
    .map((b, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(b.close_price).toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${xPos(sorted.length - 1).toFixed(1)} ${(PT + chartH).toFixed(1)} L ${PL.toFixed(1)} ${(PT + chartH).toFixed(1)} Z`;

  const firstClose = sorted[0]?.close_price ?? 0;
  const lastClose = sorted[sorted.length - 1]?.close_price ?? 0;
  const isPositive = lastClose >= firstClose;
  const color = isPositive ? "#10b981" : "#ef4444";

  const labelCount = 5;
  const yLabels = Array.from({ length: labelCount }, (_, i) => {
    const val = minV + (span / (labelCount - 1)) * i;
    return { val, y: yPos(val) };
  }).reverse();

  const xLabelStep = Math.max(1, Math.floor(sorted.length / 6));
  const xLabels = sorted
    .filter((_, i) => i === 0 || i === sorted.length - 1 || i % xLabelStep === 0)
    .map((b, _, arr) => {
      const idx = sorted.indexOf(b);
      return {
        x: xPos(idx),
        label: b.window_start ? new Date(b.window_start).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "",
      };
    });

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl"
        style={{ height: "220px" }}
        aria-label="Intraday price chart"
      >
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          {/* Background grid */}
          <pattern id="chart-grid" x="0" y={PT} width={chartW / 5} height={chartH / 4} patternUnits="userSpaceOnUse" patternTransform={`translate(${PL},0)`}>
            <line x1="0" y1="0" x2={chartW / 5} y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Grid lines */}
        {yLabels.map(({ y }, i) => (
          <line key={i} x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#chart-area-grad)" />

        {/* Price line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Latest price dot */}
        {sorted.length > 0 && (
          <circle
            cx={xPos(sorted.length - 1)}
            cy={yPos(lastClose)}
            r="4"
            fill={color}
            stroke="rgba(8,12,20,0.9)"
            strokeWidth="2"
          />
        )}

        {/* Y axis labels */}
        {yLabels.map(({ val, y }, i) => (
          <text key={i} x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(148,163,184,0.8)" fontFamily="monospace">
            {formatPrice(val)}
          </text>
        ))}

        {/* X axis labels */}
        {xLabels.map(({ x, label }, i) => (
          <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.7)" fontFamily="monospace">
            {label}
          </text>
        ))}

        {/* Axes */}
        <line x1={PL} y1={PT} x2={PL} y2={PT + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </svg>

      <div className="flex items-center justify-between mt-3 text-xs text-[var(--color-text-muted)]">
        <span>{sorted.length} nến 1 phút</span>
        <div className="flex items-center gap-3">
          <span>Min: <span className="font-mono text-[var(--color-text-secondary)]">{formatPrice(minV)}</span></span>
          <span>Max: <span className="font-mono text-[var(--color-text-secondary)]">{formatPrice(maxV)}</span></span>
          <span className={`font-mono font-bold ${isPositive ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
            {isPositive ? "▲" : "▼"} {formatPrice(lastClose)}
          </span>
        </div>
      </div>
    </div>
  );
}
