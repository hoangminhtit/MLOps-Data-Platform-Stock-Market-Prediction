import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StockAI — Realtime Vietnam Stock Market Platform",
  description:
    "MLOps-powered realtime stock market dashboard. Track VN30, NASDAQ, live Kafka streaming, AI predictions, and market analytics.",
  keywords: "stock market, vietnam stocks, VN30, realtime, AI prediction, MLOps",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
