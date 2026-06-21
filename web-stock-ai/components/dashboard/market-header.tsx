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
    time: new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(now),
    date: new Intl.DateTimeFormat("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(now),
  };
}

export type DashboardView = "Home" | "Stocks" | "News" | "Analysis";

const NAV_ITEMS: { view: DashboardView; label: string }[] = [
  { view: "Home", label: "Dashboard" },
  { view: "Stocks", label: "Bảng Giá" },
  { view: "News", label: "Tin Tức" },
  { view: "Analysis", label: "Phân Tích" },
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
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl gradient-accent glow-accent flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-base text-white leading-none">StockAI</div>
              <div className="text-xs text-[var(--color-text-muted)] leading-none mt-0.5">
                MLOps Platform
              </div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
            {NAV_ITEMS.map(({ view, label }) => (
              <button
                key={view}
                id={`nav-${view.toLowerCase()}`}
                onClick={() => onViewChange(view)}
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  activeView === view
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-border-accent)]"
                    : "text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Market Status */}
            <div
              className={[
                "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold",
                open
                  ? "bg-[var(--color-up-soft)] text-[var(--color-up)] border border-[var(--color-up-border)]"
                  : "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[rgba(245,158,11,0.3)]",
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-[var(--color-up)] pulse-dot" : "bg-[var(--color-warning)]"}`} />
              {open ? (
                <>
                  <Play size={10} />
                  Đang Mở
                </>
              ) : (
                <>
                  <Square size={10} />
                  Đóng Cửa
                </>
              )}
            </div>

            {/* Clock */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg glass-elevated text-xs">
              <Clock size={13} className="text-[var(--color-accent)]" />
              <div>
                <div className="font-mono font-bold text-white tabular-nums">{clock.time}</div>
                <div className="text-[var(--color-text-muted)] text-[10px] leading-none mt-0.5">{clock.date}</div>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              id="mobile-menu-toggle"
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg glass-elevated text-[var(--color-text-secondary)]"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] px-4 py-3 flex flex-col gap-1 slide-up">
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
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:bg-white/5",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.06]">
            <div
              className={[
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold",
                open ? "bg-[var(--color-up-soft)] text-[var(--color-up)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-[var(--color-up)] pulse-dot" : "bg-[var(--color-warning)]"}`} />
              {open ? "Đang Mở" : "Đóng Cửa"}
            </div>
            <div className="font-mono text-xs text-[var(--color-text-secondary)]">{clock.time}</div>
          </div>
        </div>
      )}
    </header>
  );
}
