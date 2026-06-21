"use client";

import { Activity, Clock, Menu, Play, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function getMarketOpenState(now: Date) {
  const vietnamTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const day = vietnamTime.getDay();
  const minutes = vietnamTime.getHours() * 60 + vietnamTime.getMinutes();
  return day >= 1 && day <= 5 && minutes >= 570 && minutes <= 900;
}

function formatClock(now: Date | null) {
  if (!now) return { time: "--:--:--", date: "--/--" };
  return {
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(now),
    date: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(now),
  };
}

export type DashboardView = "Home" | "Stocks" | "News" | "Analytics";

const NAV_ITEMS: { view: DashboardView; label: string }[] = [
  { view: "Home", label: "Home" },
  { view: "Stocks", label: "Stocks" },
  { view: "News", label: "News" },
  { view: "Analytics", label: "Analytics" },
];

export function MarketHeader({
  activeView,
  onViewChange,
}: {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const current = new Date();
      setNow(current);
      setOpen(getMarketOpenState(current));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const clock = useMemo(() => formatClock(now), [now]);

  return (
    <header className="sticky top-0 z-50 glass border-b border-border-default">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl gradient-accent glow-accent flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-base text-text-primary leading-none">StockAI</div>
              <div className="text-xs text-text-muted leading-none mt-0.5">MLOps Platform</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
            {NAV_ITEMS.map(({ view, label }) => (
              <button
                key={view}
                id={`nav-${view.toLowerCase()}`}
                onClick={() => onViewChange(view)}
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  activeView === view
                    ? "bg-accent-soft text-accent border border-border-accent shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className={[
                "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold",
                open
                  ? "bg-up-soft text-up border border-up-border"
                  : "bg-warning-soft text-warning border border-[rgba(245,158,11,0.3)]",
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-up pulse-dot" : "bg-warning"}`} />
              {open ? (
                <>
                  <Play size={10} />
                  Open
                </>
              ) : (
                <>
                  <Square size={10} />
                  Closed
                </>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-elevated text-xs">
              <Clock size={13} className="text-accent" />
              <div>
                <div className="font-mono font-bold text-text-primary tabular-nums">{clock.time}</div>
                <div className="text-text-muted text-[10px] leading-none mt-0.5">{clock.date}</div>
              </div>
            </div>

            <button
              id="mobile-menu-toggle"
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg glass-elevated text-text-secondary"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border-default px-4 py-3 flex flex-col gap-1 slide-up">
          {NAV_ITEMS.map(({ view, label }) => (
            <button
              key={view}
              onClick={() => {
                onViewChange(view);
                setMobileOpen(false);
              }}
              className={[
                "w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                activeView === view
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:bg-bg-card-hover",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border-default">
            <div
              className={[
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold",
                open ? "bg-up-soft text-up" : "bg-warning-soft text-warning",
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-up pulse-dot" : "bg-warning"}`} />
              {open ? "Open" : "Closed"}
            </div>
            <div className="font-mono text-xs text-text-secondary">{clock.time}</div>
          </div>
        </div>
      )}
    </header>
  );
}
