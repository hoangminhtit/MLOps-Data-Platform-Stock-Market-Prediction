# Architecture Notes

These notes capture the system architecture reviewed from `architecture.png` and `plan(2).md`.

## Main Pipelines

- Realtime stock data flows from Yahoo Finance into Kafka topic `raw_stock_events`.
- Kafka events are schema-normalized, then processed by Flink for validation, enrichment, windowing and OHLCV aggregation.
- Flink writes realtime/online data to ScyllaDB.
- News, reports and company information are batch-oriented and can be scraped into ScyllaDB first.
- Airflow handles batch ETL from ScyllaDB into PostgreSQL Data Warehouse.
- PostgreSQL is the analytical warehouse, designed as a star schema for dashboard, training, prediction results and agents.
- FastAPI exposes REST and WebSocket APIs behind Nginx.
- Next.js is the frontend dashboard.
- MLflow and training DAGs belong to the ML pipeline after warehouse data is available.
- The agents layer is implemented last and should query only PostgreSQL DW with SELECT-only guardrails.

## Implementation Order

1. Platform skeleton: Docker Compose, gateway, backend, frontend, PostgreSQL, ScyllaDB.
2. Web base: health checks, gateway routing, frontend-to-backend verification.
3. Database base: ScyllaDB schema, PostgreSQL star schema, backend connectivity.
4. Realtime stock pipeline: Kafka, producer, Flink or starter consumer, ScyllaDB writes.
5. Batch news and warehouse ETL: scraper, Airflow DAGs, quality checks.
6. Realtime web APIs and WebSocket charts.
7. ML training, prediction service and MLflow tracking.
8. CI, monitoring and logging.
9. Agents layer with Text-to-SQL against PostgreSQL DW.
