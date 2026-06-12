from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_stocks() -> dict[str, list[dict[str, str]]]:
    # Seed response keeps the frontend and gateway testable before ingestion is wired.
    return {
        "items": [
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ"},
            {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ"},
            {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ"},
        ]
    }


@router.get("/{symbol}/latest")
async def get_latest_price(symbol: str) -> dict[str, object]:
    return {
        "symbol": symbol.upper(),
        "price": None,
        "volume": None,
        "source": "placeholder",
        "message": "Realtime pipeline is not connected yet.",
    }
