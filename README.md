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
- Stocks API ưu tiên đọc PostgreSQL DW và ScyllaDB, có fallback seed khi database chưa có dữ liệu.
- Kafka-compatible realtime stock pipeline:
  - `stock_producer` phát mock stock ticks vào topic `raw_stock_events`.
  - `stream_processor` consume topic và ghi raw/latest/OHLCV 1 phút vào ScyllaDB.
- Batch news pipeline:
  - `news_scraper` ghi raw news vào ScyllaDB.
  - `news_etl` load raw news sang PostgreSQL DW.

Các phần Airflow orchestration, Flink, MLflow, prediction service và agent service sẽ được thêm theo các phase tiếp theo.

## Project Structure

```text
api-service/          FastAPI backend REST API
web-stock-ai/         Next.js dashboard
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
Intraday API:       http://localhost:8080/api/stocks/AAPL/intraday
News API:           http://localhost:8080/api/stocks/AAPL/news
Backend direct:     http://localhost:8000/health
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

File CQL hiện cũng seed dữ liệu latest price mẫu cho `AAPL`, `MSFT`, `NVDA`.

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

## Seed PostgreSQL Data

Nếu bạn tạo volume mới, PostgreSQL tự chạy `warehouse/init/001_star_schema.sql` và `warehouse/init/002_seed_data.sql`.

Nếu stack đã chạy từ phase trước và volume PostgreSQL đã tồn tại, apply seed thủ công:

```bash
docker exec -i stock_postgres psql -U stock_user -d stock_dw -f /docker-entrypoint-initdb.d/002_seed_data.sql
```

## Useful Commands

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f gateway
docker compose logs -f stock_producer
docker compose logs -f stream_processor
docker compose logs -f news_scraper
docker compose logs -f news_etl
docker compose down
```

Backend cũng ghi log file tại:

```text
logs/backend.log
logs/producer.log
logs/stream_processor.log
logs/news_scraper.log
logs/news_etl.log
```

Nếu muốn xem log realtime:

```bash
docker compose logs -f backend
```

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
