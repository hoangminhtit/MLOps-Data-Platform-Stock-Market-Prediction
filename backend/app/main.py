import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.api.routes import health, stocks
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(stocks.router, prefix="/api/stocks", tags=["stocks"])

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started_at = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - started_at) * 1000
        logger.info(
            "%s %s -> %s %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response

    return app


app = create_app()
