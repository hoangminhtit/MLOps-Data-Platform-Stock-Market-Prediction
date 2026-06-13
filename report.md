# Implementation Report

## 2026-06-12

### Completed

- Reviewed `architecture.png` and `plan(2).md`.
- Created initial monorepo structure for the platform.
- Added Docker Compose services:
  - Nginx API Gateway.
  - FastAPI backend.
  - Next.js frontend.
  - PostgreSQL Data Warehouse.
  - ScyllaDB online/raw store.
- Added FastAPI health endpoints and initial stocks API placeholders.
- Added Next.js dashboard that calls the stocks API through the gateway.
- Added PostgreSQL star schema bootstrap SQL.
- Added ScyllaDB online store CQL schema.
- Added `.env.example`, `.gitignore`, and README run instructions.
- Added `docs/architecture_notes.md` to preserve the reviewed architecture decisions.

### Verification

- `docker compose config`: passed.
- `python -m py_compile` for backend files: passed.
- `docker compose up --build -d`: blocked because Docker Desktop/Linux engine is not running on this machine. Error: `dockerDesktopLinuxEngine` pipe not found.

### Notes

- This is Phase 0/1 foundation work. Kafka, Flink, Airflow, MLflow, prediction service, monitoring and agents are not implemented yet.
- PostgreSQL schema is auto-applied by the official Docker image on first volume creation.
- ScyllaDB schema is provided in `scylla-service/init/001_online_store.cql` and must be applied with `cqlsh` after Scylla starts.

### Next Suggested Step

- Run `docker compose up --build` and verify:
  - `GET /health`
  - `GET /api/stocks`
  - frontend dashboard through `http://localhost:8080`

## 2026-06-13

### Completed

- Added `logs/` folder and mounted it into the backend container.
- Added backend logging configuration with console logs and rotating file logs at `logs/backend.log`.
- Added request logging middleware for method, path, status code and latency.
- Added PostgreSQL stock repository for `dim_stock`, `dim_company`, and `dim_sector`.
- Added ScyllaDB latest price repository for `stock_latest_prices`.
- Updated stocks API:
  - `GET /api/stocks` reads PostgreSQL DW first, then falls back to seed data.
  - `GET /api/stocks/{symbol}` returns stock profile from PostgreSQL or fallback seed data.
  - `GET /api/stocks/{symbol}/latest` reads ScyllaDB latest price or returns an empty placeholder response.
- Added PostgreSQL seed file `warehouse/init/002_seed_data.sql` for `AAPL`, `MSFT`, and `NVDA`.
- Added sample ScyllaDB latest price seed statements to `scylla-service/init/001_online_store.cql`.
- Configured ScyllaDB client protocol and local datacenter settings to reduce noisy driver warnings.
- Updated README with logs, seed, and run instructions.

### Verification

- `docker compose up --build -d`: passed.
- `GET http://localhost:8080/health`: passed.
- `GET http://localhost:8080/api/health/dependencies`: returned `postgres=True`, `scylla=True`.
- `GET http://localhost:8080/api/stocks`: returned seeded PostgreSQL stocks.
- `GET http://localhost:8080/api/stocks/AAPL/latest`: returned seeded ScyllaDB latest price.
- `GET http://localhost:8080`: returned 200 from frontend through gateway.
- `logs/backend.log`: created and receiving request logs.

### Notes

- Existing PostgreSQL Docker volumes do not automatically run newly added init SQL files. Apply `002_seed_data.sql` manually or recreate volumes.
- Existing ScyllaDB volumes also need the CQL file applied manually with `cqlsh`.

## 2026-06-13 - Phase 3

### Completed

- Added Kafka broker service to Docker Compose.
- Added `kafka-service/` package for realtime data pipeline code.
- Added `stock_producer` service:
  - Produces mock JSON stock tick events for `AAPL`, `MSFT`, and `NVDA`.
  - Uses Kafka key `symbol` to keep per-symbol event ordering.
  - Writes logs to `logs/producer.log`.
- Added `stream_processor` service:
  - Consumes Kafka topic `raw_stock_events`.
  - Writes raw ticks to `stock_prices_raw`.
  - Updates `stock_latest_prices`.
  - Maintains 1-minute OHLCV rows in `stock_ohlcv_1m`.
  - Writes logs to `logs/stream_processor.log`.
- Added backend endpoint `GET /api/stocks/{symbol}/intraday` for ScyllaDB OHLCV bars.
- Updated README with Kafka pipeline run/debug commands.

### Notes

- This is a Flink-lite implementation for MVP validation. It proves the realtime path before adding Flink and Schema Registry.
- Producer currently uses generated mock prices. Yahoo Finance/WebSocket integration should replace this after the local pipeline is stable.

### Verification

- `docker compose up --build -d`: passed with Kafka, producer and stream processor.
- Kafka topic list includes `raw_stock_events`.
- `stock_producer` is running and connected to Kafka.
- `stream_processor` is running and processing events continuously.
- Direct ScyllaDB query confirmed rows in:
  - `stock_prices_raw`
  - `stock_latest_prices`
  - `stock_ohlcv_1m`
- `GET http://localhost:8080/api/stocks/AAPL/latest`: returned latest price from `mock-producer`.
- `GET http://localhost:8080/api/stocks/AAPL/intraday`: returned OHLCV 1-minute bars from ScyllaDB.
- Log files created:
  - `logs/producer.log`
  - `logs/stream_processor.log`

## 2026-06-13 - Phase 4

### Completed

- Added `task-daily-service/` package for batch-oriented jobs.
- Added `news_scraper` service:
  - Generates deterministic mock news for `AAPL`, `MSFT`, and `NVDA`.
  - Writes raw news to ScyllaDB `raw_news`.
  - Writes logs to `logs/news_scraper.log`.
- Added `news_etl` service:
  - Reads ScyllaDB `raw_news`.
  - Upserts `dim_date` and `dim_news_source`.
  - Loads stock-linked articles into PostgreSQL `fact_stock_news`.
  - Applies a simple keyword-based sentiment score.
  - Writes logs to `logs/news_etl.log`.
- Added backend repository for stock news from PostgreSQL DW.
- Added backend endpoint `GET /api/stocks/{symbol}/news`.
- Added `scylla_schema_init` service so ScyllaDB CQL schema is applied automatically during Compose startup.
- Added a configurable `NEWS_ETL_START_DELAY_SECONDS` to avoid first-run races with the scraper.
- Updated README with News Pipeline run/debug commands.

### Notes

- This is an Airflow-lite implementation for MVP validation. The jobs are long-running containers now; Airflow DAGs should orchestrate the same logic later.
- News data is synthetic by default to keep local dev deterministic and independent of external RSS/API availability.

### Verification

- `docker compose config --quiet`: passed.
- `python -m py_compile` for backend and batch files: passed.
- `scylla_schema_init`: completed successfully and applied CQL schema.
- `news_scraper`: wrote 3 raw news items into ScyllaDB.
- `news_etl`: loaded 3 news facts into PostgreSQL DW on first run.
- `GET http://localhost:8080/api/stocks/AAPL/news`: returned warehouse news.

## 2026-06-13 - Phase 5

### Completed

- Added FastAPI WebSocket endpoint `WS /ws/stocks/{symbol}`.
- Added backend market summary endpoint `GET /api/stocks/analytics/market-summary`.
- Replaced the placeholder frontend with a realtime stock operations dashboard:
  - Watchlist.
  - Latest price cards.
  - Live WebSocket connection status.
  - Intraday OHLCV line chart.
  - Live feed panel.
  - Warehouse news panel.
- Kept the UI implementation original while using the referenced stock dashboard only as broad inspiration.

### Verification

- `python -m py_compile` for backend route changes: passed.
- `docker compose config --quiet`: passed.
- `docker compose up --build -d backend frontend gateway`: passed.
- `GET http://localhost:8080`: returned 200.
- `GET http://localhost:8080/api/stocks/analytics/market-summary`: returned live market summary.
- `GET http://localhost:8080/api/stocks/AAPL/latest`: returned latest price from `mock-producer`.
- `WS ws://localhost:8080/ws/stocks/AAPL`: returned realtime latest price JSON through Nginx gateway.
- `docker compose exec frontend npm run build`: passed.

### Follow-up Fix

- Reorganized `web-stock-ai` into:
  - `components/dashboard/`
  - `lib/`
  - `types/`
- Fixed direct `localhost:3000` development mode:
  - Client API calls use `localhost:8080` when opened from port `3000`.
  - WebSocket calls use `ws://localhost:8080` when opened from port `3000`.
- Updated frontend Docker command to remove stale `.next` before `next dev`, preventing stale production build assets from causing `/_next/static/*` 404s.
- Verified `localhost:3000` and `localhost:8080` return 200.
- Verified Next static assets return 200.
- Full stack is running with realtime and batch services together.
- Fixed Kafka topic creation race where producer could fail if processor created `raw_stock_events` first.
- `GET http://localhost:8080/api/stocks/AAPL/latest`: returned latest price from `mock-producer` after the race fix.

## 2026-06-13 - Structure Refactor

### Completed

- Reorganized root folders into service-oriented boundaries:
  - `api-service/`
  - `web-stock-ai/`
  - `kafka-service/`
  - `task-daily-service/`
  - `gateway-service/`
  - `warehouse/`
  - `scylla-service/`
  - `image/`
- Updated Docker Compose build contexts and mounted schema/config paths.
- Updated README and architecture notes to reflect the new layout.

### Verification

- `docker compose config --quiet`: passed.
- `python -m py_compile` with new service paths: passed.
- Rebuilt and started services from the new folder layout.
- `GET http://localhost:8080/health`: passed.
- `GET http://localhost:8080/api/stocks/AAPL/latest`: returned realtime price from `mock-producer`.
- `GET http://localhost:8080/api/stocks/AAPL/news`: returned warehouse news.

## 2026-06-13 - Realtime Dashboard UI Refresh

### Completed

- Improved `web-stock-ai` UI based on `ui.md` while keeping the implementation original.
- Replaced the dark operations layout with a light fintech dashboard:
  - Sticky market header.
  - Home/Stocks/News/Analysis navigation placeholder.
  - Vietnam realtime clock.
  - Market open/closed session badge.
  - Hero search area.
  - Searchable stock widgets with sparkline.
  - Realtime connection badge.
  - Intraday chart, live feed, data source and news panels.
- Kept frontend structure organized under `web-stock-ai/components/dashboard`.
- Updated README with the new dashboard component layout and run notes.

### Verification

- `docker compose config --quiet`: passed.
- `docker compose exec frontend npm run build`: passed.
- Recreated `frontend` and `gateway` after build to restore Next dev mode cache.
- `GET http://localhost:3000`: returned 200.
- `GET http://localhost:8080`: returned 200.
- Next static assets from `/_next/static/*`: returned 200.
