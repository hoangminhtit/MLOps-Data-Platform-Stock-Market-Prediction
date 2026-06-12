# MLOps Data Platform - Stock Market

Monorepo cho nền tảng dữ liệu thị trường chứng khoán theo kiến trúc trong `architecture.png` và `plan(2).md`.

## Current Scope

Phase hiện tại dựng nền tảng chạy được:

- Nginx API Gateway.
- FastAPI backend.
- Next.js frontend dashboard.
- PostgreSQL Data Warehouse schema.
- ScyllaDB online/raw store schema file.

Các phần Kafka, Flink, Airflow, MLflow, prediction service và agent service sẽ được thêm theo các phase tiếp theo.

## Project Structure

```text
backend/          FastAPI backend
frontend/         Next.js dashboard
nginx/            API Gateway config
postgres/init/    PostgreSQL star schema bootstrap
scylla/init/      ScyllaDB online store schema
docs/             Design notes and follow-up docs
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
Backend direct:     http://localhost:8000/health
Frontend direct:    http://localhost:3000
PostgreSQL:         localhost:5432
ScyllaDB CQL:       localhost:9042
```

## Initialize ScyllaDB Schema

PostgreSQL tự chạy schema trong `postgres/init` khi volume mới được tạo. ScyllaDB không tự chạy CQL từ compose, nên sau khi Scylla sẵn sàng, chạy:

```bash
docker exec -it stock_scylla cqlsh -f /schema/001_online_store.cql
```

## Useful Commands

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f gateway
docker compose down
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

Chưa chạy được stack trên máy hiện tại vì Docker Desktop/Linux engine chưa bật. Khi Docker chạy, dùng lệnh ở trên để build và start toàn bộ service.
