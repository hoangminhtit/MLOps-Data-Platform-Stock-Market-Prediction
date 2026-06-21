from fastapi import FastAPI, HTTPException

from app.config import settings
from app.database import postgres_connection
from app.prediction import PredictionResult, predict_all, predict_symbol

app = FastAPI(title=settings.app_name, version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@app.post("/predict/run-all")
def run_all_predictions() -> dict[str, list[PredictionResult]]:
    with postgres_connection() as conn:
        return {"items": predict_all(conn)}


@app.post("/predict/{symbol}", response_model=PredictionResult)
def run_prediction(symbol: str) -> PredictionResult:
    with postgres_connection() as conn:
        try:
            return predict_symbol(conn, symbol)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
