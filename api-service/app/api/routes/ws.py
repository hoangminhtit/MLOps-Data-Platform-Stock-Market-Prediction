import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.repositories.scylla_prices import get_latest_price

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/stocks/{symbol}")
async def stock_price_stream(websocket: WebSocket, symbol: str) -> None:
    await websocket.accept()
    symbol_upper = symbol.upper()
    logger.info("WebSocket connected symbol=%s", symbol_upper)

    try:
        while True:
            latest = await asyncio.to_thread(get_latest_price, symbol_upper)
            await websocket.send_json(
                latest
                or {
                    "symbol": symbol_upper,
                    "price": None,
                    "volume": None,
                    "event_time": None,
                    "source": "placeholder",
                    "message": "No latest price found in ScyllaDB yet.",
                }
            )
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected symbol=%s", symbol_upper)
