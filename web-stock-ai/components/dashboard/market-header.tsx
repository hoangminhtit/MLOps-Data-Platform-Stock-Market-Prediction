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

export function MarketHeader() {
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
  const navItems = ["Home", "Stocks", "News", "Analysis"];

  return (
    <header className="marketHeader">
      <div className="headerInner">
        <div className="headerBrand">
          <div className="logoMark">
            <Activity size={24} />
          </div>
          <div>
            <strong>StockAI</strong>
            <span>Finance</span>
          </div>
        </div>

        <nav className="desktopNav" aria-label="Primary navigation">
          {navItems.map((item, index) => (
            <a className={index === 0 ? "navLink active" : "navLink"} href="#" key={item}>
              {item}
            </a>
          ))}
        </nav>

        <div className="marketTools">
          <div className={open ? "sessionBadge open" : "sessionBadge closed"}>
            {open ? <Play size={14} /> : <Square size={14} />}
            <span>{open ? "MO" : "DONG"}</span>
          </div>
          <div className="divider" />
          <div className="clockBox">
            <Clock size={18} />
            <span>
              <strong>{clock.time}</strong>
              <small>{clock.date}</small>
            </span>
          </div>
        </div>

        <button className="mobileMenuButton" onClick={() => setMobileOpen((value) => !value)} title="Menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="mobilePanel">
          <div className="mobilePanelTop">
            <div className={open ? "sessionBadge open" : "sessionBadge closed"}>
              {open ? <Play size={14} /> : <Square size={14} />}
              <span>{open ? "MO" : "DONG"}</span>
            </div>
            <div className="clockBox">
              <Clock size={18} />
              <span>
                <strong>{clock.time}</strong>
                <small>{clock.date}</small>
              </span>
            </div>
          </div>
          {navItems.map((item, index) => (
            <a className={index === 0 ? "navLink active" : "navLink"} href="#" key={item}>
              {item}
            </a>
          ))}
        </div>
      ) : null}
    </header>
  );
}
