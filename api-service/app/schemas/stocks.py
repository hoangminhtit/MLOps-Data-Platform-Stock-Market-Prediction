from datetime import date

from pydantic import BaseModel


class StockSummary(BaseModel):
    symbol: str
    name: str | None = None
    exchange: str | None = None
    sector: str | None = None
    industry: str | None = None


class LatestPrice(BaseModel):
    symbol: str
    price: float | None = None
    volume: int | None = None
    event_time: str | None = None
    source: str | None = None
    message: str | None = None


class IntradayBar(BaseModel):
    symbol: str
    event_date: str
    window_start: str
    window_end: str
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    volume: int


class StockNews(BaseModel):
    symbol: str
    source: str | None = None
    published_at: str | None = None
    title: str
    content: str | None = None
    url: str | None = None
    sentiment_score: float | None = None


class DailyPrice(BaseModel):
    symbol: str
    price_date: date
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    close_price: float | None = None
    volume: int | None = None


class StockMover(BaseModel):
    symbol: str
    name: str | None = None
    open_price: float | None = None
    close_price: float | None = None
    volume: int | None = None
    change_percent: float | None = None


class HighVolumeStock(BaseModel):
    symbol: str
    name: str | None = None
    close_price: float | None = None
    volume: int | None = None
