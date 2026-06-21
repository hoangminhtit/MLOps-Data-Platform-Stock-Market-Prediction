# MLOps Data Platform - Stock Market

Monorepo cho nền tảng dữ liệu thị trường chứng khoán theo kiến trúc trong `image/architecture.png` và `plan(2).md`.

## Current Scope

Phase hiện tại dựng nền tảng chạy được:

- Nginx API Gateway.
- FastAPI backend.
- Next.js frontend dashboard.
- PostgreSQL Data Warehouse schema.
- ScyllaDB online/raw store schema file.
- Backend logging ra `logs/backend.log`.
- Stocks API đọc metadata từ PostgreSQL DW và latest price từ ScyllaDB streaming store.
- Kafka-compatible realtime stock pipeline:
  - `stock_producer` phát mock stock ticks vào topic `raw_stock_events`.
  - `stream_processor` consume topic và ghi raw/latest/OHLCV 1 phút vào ScyllaDB.
- Batch news pipeline:
  - `news_scraper` ghi raw news vào ScyllaDB.
  - `news_etl` load raw news sang PostgreSQL DW.
- Batch warehouse stock ETL:
  - `stock_price_etl` load ScyllaDB OHLCV 1 phút sang PostgreSQL DW.
  - Aggregate daily OHLCV vào `fact_stock_daily_prices`.
- AI prediction MVP:
  - `ai_service` chạy baseline moving average prediction.
  - Lưu kết quả vào PostgreSQL `fact_stock_predictions`.
  - Dashboard hiển thị prediction mới nhất.
- Expanded stock universe:
  - VN-style demo symbols including `VIC`, `VHM`, `FPT`, `HPG`, `ACB`, `MBB`, `MSN`, `VJC`, and more.
  - Legacy US demo symbols `AAPL`, `MSFT`, `NVDA` remain available.
- Realtime web dashboard:
  - WebSocket `WS /ws/stocks/{symbol}`.
  - Tailwind-based user-facing dashboard.
  - Sticky market header, searchable stock widgets, live stock board, news page, analysis page, intraday chart, live feed and prediction panel.
  - UI no longer fabricates board prices; rows without stream data show waiting state.

Các phần Airflow orchestration, Flink, MLflow, prediction service và agent service sẽ được thêm theo các phase tiếp theo.

## Project Structure

```text
api-service/          FastAPI backend REST API
ai-service/           FastAPI prediction service
web-stock-ai/         Next.js dashboard
  app/                Next.js app routes and global styles
  components/         Reusable UI/dashboard components
  components/dashboard/
                      Realtime dashboard, header, chart and stock widgets
  lib/                API clients and formatting helpers
  types/              Shared frontend TypeScript types
kafka-service/        Kafka producer and stream processor
task-daily-service/   News scraper and ScyllaDB to warehouse ETL
gateway-service/      Nginx API Gateway config
warehouse/init/       PostgreSQL star schema bootstrap
scylla-service/init/  ScyllaDB online store schema
image/                Architecture image and visual assets
docs/                 Design notes and follow-up docs
logs/                 Local debug logs mounted from containers
docker-compose.yml
.env.example
report.md
```

## Run Locally

Yêu cầu: Docker Desktop phải đang chạy ở Linux containers mode.

1. Tạo file môi trường:

```bash
cp .env.example .env
```

Trên PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Build và chạy platform:

```bash
docker compose up --build
```

3. Mở các URL:

```text
Gateway / Frontend: http://localhost:8080
Backend health:     http://localhost:8080/health
Stocks API:         http://localhost:8080/api/stocks
Latest price API:   http://localhost:8080/api/stocks/AAPL/latest
All latest API:     http://localhost:8080/api/stocks/latest
Intraday API:       http://localhost:8080/api/stocks/AAPL/intraday
Daily API:          http://localhost:8080/api/stocks/AAPL/daily
News API:           http://localhost:8080/api/stocks/AAPL/news
Top gainers API:    http://localhost:8080/api/stocks/analytics/top-gainers
Top losers API:     http://localhost:8080/api/stocks/analytics/top-losers
High volume API:    http://localhost:8080/api/stocks/analytics/high-volume
Prediction API:     http://localhost:8080/api/stocks/AAPL/predictions
Run prediction:     http://localhost:8080/predict/AAPL
WebSocket:          ws://localhost:8080/ws/stocks/AAPL
Backend direct:     http://localhost:8000/health
AI service direct:  http://localhost:8100/health
Frontend direct:    http://localhost:3000
PostgreSQL:         localhost:5432
ScyllaDB CQL:       localhost:9042
Kafka external:     localhost:9094
```

## Initialize ScyllaDB Schema

PostgreSQL tự chạy schema trong `warehouse/init` khi volume mới được tạo. ScyllaDB schema được service `scylla_schema_init` tự apply khi chạy Docker Compose.

Nếu cần apply thủ công:

```bash
docker exec -it stock_scylla cqlsh -f /schema/001_online_store.cql
```

ScyllaDB schema không seed latest price. Bảng `stock_latest_prices` chỉ có dữ liệu sau khi streaming pipeline ghi vào.

## Realtime Stock Pipeline

Docker Compose chạy thêm 3 service:

```text
kafka                  Kafka broker
scylla_schema_init     applies ScyllaDB CQL schema
stock_producer         mock stock event producer
stream_processor       Kafka -> ScyllaDB writer
```

Luồng hiện tại:

```text
stock_producer -> Kafka topic raw_stock_events -> stream_processor -> ScyllaDB
```

Kiểm tra latest price sau khi pipeline chạy vài giây:

```bash
curl http://localhost:8080/api/stocks/AAPL/latest
```

Kiểm tra OHLCV intraday 1 phút:

```bash
curl http://localhost:8080/api/stocks/AAPL/intraday
```

Frontend dashboard dùng WebSocket qua gateway:

```text
Browser -> /ws/stocks/{symbol} -> Nginx -> FastAPI WebSocket -> ScyllaDB latest price
```

## News Pipeline

Docker Compose chạy thêm 2 service:

```text
news_scraper       mock news scraper -> ScyllaDB raw_news
news_etl           ScyllaDB raw_news -> PostgreSQL fact_stock_news
```

Luồng hiện tại:

```text
news_scraper -> ScyllaDB raw_news -> news_etl -> PostgreSQL DW -> Backend API
```

Kiểm tra news đã vào warehouse:

```bash
curl http://localhost:8080/api/stocks/AAPL/news
```

MVP hiện dùng synthetic mock news để pipeline chạy ổn định trong local. RSS/API thật sẽ được thay vào sau khi Airflow orchestration được thêm.

## Stock Warehouse ETL

Docker Compose chạy thêm service:

```text
stock_price_etl    ScyllaDB stock_ohlcv_1m -> PostgreSQL intraday/daily facts
```

Luồng hiện tại:

```text
stream_processor -> ScyllaDB stock_ohlcv_1m -> stock_price_etl -> PostgreSQL DW
```

Kiểm tra daily price đã vào warehouse:

```bash
curl http://localhost:8080/api/stocks/AAPL/daily
```

Kiểm tra analytics đọc từ warehouse:

```bash
curl http://localhost:8080/api/stocks/analytics/top-gainers
curl http://localhost:8080/api/stocks/analytics/top-losers
curl http://localhost:8080/api/stocks/analytics/high-volume
```

MVP hiện dùng job container chạy định kỳ để chứng minh logic ETL. Khi thêm Airflow, DAG `stock_daily_etl_dag` sẽ gọi lại cùng luồng extract/transform/load này.

## AI Prediction MVP

Docker Compose chạy thêm service:

```text
ai_service    baseline moving average prediction -> PostgreSQL fact_stock_predictions
```

Luồng hiện tại:

```text
PostgreSQL DW daily prices -> ai_service -> PostgreSQL DW predictions -> Backend API -> Frontend
```

Chạy prediction cho tất cả symbol:

```bash
curl -X POST http://localhost:8080/predict/run-all
```

Chạy prediction cho một mã:

```bash
curl -X POST http://localhost:8080/predict/AAPL
```

Đọc prediction đã lưu từ backend:

```bash
curl http://localhost:8080/api/stocks/AAPL/predictions
```

Model hiện tại là `moving_average_baseline` để chứng minh prediction path end-to-end. MLflow tracking, training DAG và model registry sẽ được thêm ở phase sau.

## Seed PostgreSQL Data

Nếu bạn tạo volume mới, PostgreSQL tự chạy `warehouse/init/001_star_schema.sql` và `warehouse/init/002_seed_data.sql`.

Nếu stack đã chạy từ phase trước và volume PostgreSQL đã tồn tại, apply seed thủ công:

```bash
docker exec -i stock_postgres psql -U stock_user -d stock_dw -f /docker-entrypoint-initdb.d/002_seed_data.sql
```

File seed hiện bổ sung nhóm symbol demo kiểu VN30 và vẫn giữ `AAPL`, `MSFT`, `NVDA` để tương thích các phase trước.

## Useful Commands

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f gateway
docker compose logs -f stock_producer
docker compose logs -f stream_processor
docker compose logs -f news_scraper
docker compose logs -f news_etl
docker compose logs -f stock_price_etl
docker compose logs -f ai_service
docker compose down
```

Backend cũng ghi log file tại:

```text
logs/backend.log
logs/producer.log
logs/stream_processor.log
logs/news_scraper.log
logs/news_etl.log
logs/stock_etl.log
```

Nếu muốn xem log realtime:

```bash
docker compose logs -f backend
```

## Frontend Notes

Khi phát triển frontend, ưu tiên mở dashboard qua gateway:

```text
http://localhost:8080
```

Mở trực tiếp qua Next dev server cũng được hỗ trợ:

```text
http://localhost:3000
```

UI realtime hiện được tổ chức trong:

```text
web-stock-ai/components/dashboard/
```

Các file chính:

```text
realtime-dashboard.tsx   Main dashboard container and data wiring
market-header.tsx        Sticky nav, market session status, Vietnam clock
stock-widget.tsx         Searchable stock cards with sparkline
line-chart.tsx           Intraday OHLCV chart
```

Nếu thấy giao diện bị mất CSS/JS và console báo 404 với `/_next/static/...`, recreate frontend để dọn cache `.next`:

```bash
docker compose up -d --force-recreate frontend gateway
```

Không nên chạy `npm run build` bằng `docker compose exec frontend ...` trên container dev đang phục vụ trang. Nếu đã chạy, recreate frontend bằng lệnh trên.

Nếu muốn tạo lại PostgreSQL schema từ đầu:

```bash
docker compose down -v
docker compose up --build
```

Lệnh trên xóa volumes Docker của project, chỉ dùng khi muốn reset dữ liệu local.

## Verification Status

Đã kiểm tra:

- `docker compose config` hợp lệ.
- Python files compile được bằng `python -m py_compile`.

Sau khi sửa Phase 2, tiếp tục dùng `docker compose up --build` để backend nhận code logging và DB repository mới.
