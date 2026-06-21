from datetime import UTC, date, datetime

from fastapi import APIRouter

from app.repositories.postgres_news import list_stock_news
from app.repositories.postgres_analytics import (
    list_daily_prices,
    list_high_volume,
    list_predictions,
    list_top_movers,
)
from app.repositories.postgres_stocks import get_stock, list_stocks as list_stocks_from_dw
from app.repositories.scylla_prices import (
    get_intraday_bars,
    get_latest_price as get_latest_price_from_online_store,
    list_latest_prices,
)
from app.schemas.stocks import DailyPrice, HighVolumeStock, IntradayBar, LatestPrice, StockMover, StockNews, StockPrediction, StockSummary

router = APIRouter()


@router.get("/analytics/market-summary")
async def get_market_summary() -> dict[str, object]:
    stocks = await list_stocks_from_dw()
    latest_items = list_latest_prices()
    prices = [item["price"] for item in latest_items if item.get("price") is not None]
    total_volume = sum(int(item.get("volume") or 0) for item in latest_items)
    return {
        "tracked_symbols": len(stocks),
        "live_symbols": len(latest_items),
        "average_price": round(sum(prices) / len(prices), 2) if prices else None,
        "total_volume": total_volume,
        "source": "ScyllaDB latest price store",
    }


@router.get("/analytics/top-gainers")
async def get_top_gainers(limit: int = 5) -> dict[str, list[StockMover]]:
    safe_limit = max(1, min(limit, 20))
    items = await list_top_movers("gainers", safe_limit)
    return {"items": items}


@router.get("/analytics/top-losers")
async def get_top_losers(limit: int = 5) -> dict[str, list[StockMover]]:
    safe_limit = max(1, min(limit, 20))
    items = await list_top_movers("losers", safe_limit)
    return {"items": items}


@router.get("/analytics/high-volume")
async def get_high_volume(limit: int = 5) -> dict[str, list[HighVolumeStock]]:
    safe_limit = max(1, min(limit, 20))
    items = await list_high_volume(safe_limit)
    return {"items": items}


@router.get("")
async def list_stocks() -> dict[str, list[StockSummary]]:
    stocks = await list_stocks_from_dw()
    return {"items": stocks}


@router.get("/latest")
async def list_latest(limit: int = 200) -> dict[str, list[LatestPrice]]:
    safe_limit = max(1, min(limit, 500))
    latest = list_latest_prices(safe_limit)
    return {"items": latest}


@router.get("/{symbol}")
async def get_stock_profile(symbol: str) -> StockSummary:
    stock = await get_stock(symbol)
    if stock:
        return StockSummary(**stock)

    symbol_upper = symbol.upper()
    return StockSummary(symbol=symbol_upper)


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


@router.get("/{symbol}/daily")
async def get_daily(symbol: str, limit: int = 30) -> dict[str, list[DailyPrice]]:
    safe_limit = max(1, min(limit, 365))
    prices = await list_daily_prices(symbol, safe_limit)
    return {"items": prices}


@router.get("/{symbol}/predictions")
async def get_predictions(symbol: str, limit: int = 10) -> dict[str, list[StockPrediction]]:
    safe_limit = max(1, min(limit, 100))
    predictions = await list_predictions(symbol, safe_limit)
    return {"items": predictions}


@router.get("/{symbol}/news")
async def get_news(symbol: str, limit: int = 50) -> dict[str, list[StockNews]]:
    safe_limit = max(1, min(limit, 200))
    news = await list_stock_news(symbol, safe_limit)
    return {"items": news}
