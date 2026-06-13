import { formatTime, priceFormat } from "@/lib/formatters";
import type { IntradayBar } from "@/types/market";
import { useMemo } from "react";

export function LineChart({ bars }: { bars: IntradayBar[] }) {
  const points = useMemo(() => {
    const sorted = [...bars].reverse();
    const values = sorted.map((bar) => bar.close_price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    return sorted.map((bar, index) => {
      const x = sorted.length === 1 ? 0 : (index / (sorted.length - 1)) * 100;
      const y = 92 - ((bar.close_price - min) / span) * 78;
      return { x, y, label: formatTime(bar.window_start), value: bar.close_price };
    });
  }, [bars]);

  if (points.length === 0) {
    return <div className="emptyState">Waiting for intraday bars</div>;
  }

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const latest = points[points.length - 1];

  return (
    <div className="chartWrap">
      <svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Intraday close price chart">
        <path d="M 0 94 L 100 94" className="axis" />
        <path d={path} className="line" />
        <circle cx={latest.x} cy={latest.y} r="1.8" className="dot" />
      </svg>
      <div className="chartMeta">
        <span>{points[0].label}</span>
        <strong>${priceFormat.format(latest.value)}</strong>
        <span>{latest.label}</span>
      </div>
    </div>
  );
}
