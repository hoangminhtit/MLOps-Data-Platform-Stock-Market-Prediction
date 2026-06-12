from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, stocks
from app.core.config import settings


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
    return app


app = create_app()
