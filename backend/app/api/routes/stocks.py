from datetime import UTC, date, datetime

from fastapi import APIRouter

from app.repositories.postgres_stocks import get_stock, list_stocks as list_stocks_from_dw
from app.repositories.scylla_prices import (
    get_intraday_bars,
    get_latest_price as get_latest_price_from_online_store,
)
from app.schemas.stocks import IntradayBar, LatestPrice, StockSummary

router = APIRouter()

SEED_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "sector": "Technology", "industry": "Consumer Electronics"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "sector": "Technology", "industry": "Software"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "sector": "Technology", "industry": "Semiconductors"},
]


@router.get("")
async def list_stocks() -> dict[str, list[StockSummary]]:
    stocks = await list_stocks_from_dw()
    return {"items": stocks or SEED_STOCKS}


@router.get("/{symbol}")
async def get_stock_profile(symbol: str) -> StockSummary:
    stock = await get_stock(symbol)
    if stock:
        return StockSummary(**stock)

    symbol_upper = symbol.upper()
    fallback = next((item for item in SEED_STOCKS if item["symbol"] == symbol_upper), None)
    return StockSummary(**(fallback or {"symbol": symbol_upper}))


@router.get("/{symbol}/latest")
async def get_latest_price(symbol: str) -> LatestPrice:
    latest = get_latest_price_from_online_store(symbol)
    if latest:
        return LatestPrice(**latest)

    return LatestPrice(
        symbol=symbol.upper(),
        source="placeholder",
        message="No latest price found in ScyllaDB yet.",
    )


@router.get("/{symbol}/intraday")
async def get_intraday(symbol: str, event_date: date | None = None, limit: int = 120) -> dict[str, list[IntradayBar]]:
    target_date = event_date or datetime.now(UTC).date()
    safe_limit = max(1, min(limit, 500))
    bars = get_intraday_bars(symbol, target_date, safe_limit)
    return {"items": bars}
