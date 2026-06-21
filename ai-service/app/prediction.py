from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from statistics import mean, pstdev

from psycopg import Connection
from pydantic import BaseModel

from app.config import settings

MODEL_NAME = "moving_average_baseline"
MODEL_VERSION = "v1"


class PredictionResult(BaseModel):
    symbol: str
    prediction_date: date
    target_date: date
    predicted_close: float
    confidence: float
    model_name: str = MODEL_NAME
    model_version: str = MODEL_VERSION


def ensure_prediction_index(conn: Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_stock_predictions_unique_target
            ON fact_stock_predictions (stock_id, prediction_date, target_date, model_name, model_version)
            """
        )
    conn.commit()


def get_recent_closes(conn: Connection, symbol: str, limit: int) -> tuple[int, list[float]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.stock_id, p.close_price
            FROM fact_stock_daily_prices p
            JOIN dim_stock s ON s.stock_id = p.stock_id
            WHERE s.symbol = %s AND p.close_price IS NOT NULL
            ORDER BY p.date_id DESC
            LIMIT %s
            """,
            (symbol.upper(), max(1, limit)),
        )
        rows = cur.fetchall()

    if not rows:
        raise ValueError(f"No daily prices found for symbol={symbol.upper()}")

    stock_id = rows[0][0]
    closes = [float(row[1]) for row in rows]
    return stock_id, closes


def confidence_from_closes(closes: list[float]) -> float:
    if len(closes) < 2:
        return 0.55
    avg = mean(closes)
    if avg == 0:
        return 0.5
    volatility = pstdev(closes) / avg
    return round(max(0.5, min(0.95, 0.9 - volatility)), 4)


def save_prediction(conn: Connection, stock_id: int, result: PredictionResult) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fact_stock_predictions
            (stock_id, prediction_date, target_date, predicted_close, confidence, model_name, model_version)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (stock_id, prediction_date, target_date, model_name, model_version) DO UPDATE SET
                predicted_close = EXCLUDED.predicted_close,
                confidence = EXCLUDED.confidence,
                created_at = CURRENT_TIMESTAMP
            """,
            (
                stock_id,
                result.prediction_date,
                result.target_date,
                Decimal(str(result.predicted_close)),
                Decimal(str(result.confidence)),
                result.model_name,
                result.model_version,
            ),
        )
    conn.commit()


def predict_symbol(conn: Connection, symbol: str) -> PredictionResult:
    ensure_prediction_index(conn)
    stock_id, closes = get_recent_closes(conn, symbol, settings.prediction_window_days)
    predicted_close = round(mean(closes), 4)
    today = datetime.now(UTC).date()
    result = PredictionResult(
        symbol=symbol.upper(),
        prediction_date=today,
        target_date=today + timedelta(days=1),
        predicted_close=predicted_close,
        confidence=confidence_from_closes(closes),
    )
    save_prediction(conn, stock_id, result)
    return result


def predict_all(conn: Connection) -> list[PredictionResult]:
    results: list[PredictionResult] = []
    for symbol in settings.symbols:
        try:
            results.append(predict_symbol(conn, symbol))
        except ValueError:
            continue
    return results
