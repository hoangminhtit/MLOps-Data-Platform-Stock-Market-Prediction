from fastapi import APIRouter

from app.core.config import settings
from app.db.postgres import check_postgres
from app.db.scylla import check_scylla

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, object]:
    return {
        "service": settings.app_name,
        "environment": settings.environment,
        "status": "ok",
    }


@router.get("/api/health/dependencies")
async def dependency_health_check() -> dict[str, bool]:
    return {
        "postgres": await check_postgres(),
        "scylla": check_scylla(),
    }
