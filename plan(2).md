# PLAN.md - System Design & Implementation Plan

## 1. Định hướng kiến trúc

Project sẽ bám sát pipeline gốc gồm 3 phần chính:

1. **Data Pipeline**
   - Thu thập dữ liệu giá realtime.
   - Thu thập tin tức, báo cáo, thông tin doanh nghiệp theo batch.
   - Lưu dữ liệu realtime vào ScyllaDB.
   - ETL dữ liệu từ ScyllaDB sang PostgreSQL Data Warehouse.

2. **Web Pipeline**
   - Frontend Next.js.
   - API Gateway.
   - Backend FastAPI.
   - API realtime/history/prediction.
   - WebSocket streaming cho frontend.

3. **Training Pipeline**
   - Airflow DAG lấy dữ liệu từ PostgreSQL Data Warehouse.
   - Train model.
   - Lưu model tốt nhất.
   - Chạy prediction.
   - Lưu prediction result về PostgreSQL Data Warehouse.

Bổ sung thêm:

4. **Agents Layer**
   - Làm cuối cùng.
   - Agent sử dụng dữ liệu từ PostgreSQL Data Warehouse.
   - PostgreSQL được thiết kế theo Star Schema để hỗ trợ Text-to-SQL và phân tích dữ liệu.

5. **Platform Layer**
   - API Gateway.
   - CI/CD.
   - Monitoring.
   - Logging.

---

## 2. Kiến trúc tổng thể sau khi chỉnh sửa

```text
                         +---------------------------+
                         |      Data Sources         |
                         +---------------------------+
                         | Yahoo Finance Realtime    |
                         | News / Reports / Info     |
                         +-------------+-------------+
                                       |
        +------------------------------+------------------------------+
        |                                                             |
        v                                                             v
+-------------------+                                      +----------------------+
| Realtime Producer |                                      | Batch Scraper         |
| Stock Price       |                                      | News / Reports / Info |
+---------+---------+                                      +----------+-----------+
          |                                                           |
          v                                                           v
+-------------------+                                      +----------------------+
| Kafka Raw Topic   |                                      | ScyllaDB              |
| raw_stock_events  |                                      | raw_news / raw_info   |
+---------+---------+                                      +----------+-----------+
          |                                                           |
          v                                                           |
+-------------------+                                                |
| Schema Registry   |                                                |
| Avro / JSON       |                                                |
+---------+---------+                                                |
          |                                                           |
          v                                                           |
+-------------------+                                                |
| Flink             |                                                |
| Transform Stream  |                                                |
+---------+---------+                                                |
          |                                                           |
          v                                                           |
+-------------------+                                                |
| ScyllaDB          |<-----------------------------------------------+
| Online Store      |
+---------+---------+
          |
          | CDC / Backend Query / Scheduled ETL
          v
+-------------------+             +-----------------------------+
| Airflow ETL       |------------>| PostgreSQL Data Warehouse   |
| 15m / Daily DAG   |             | Star Schema                 |
+-------------------+             +-------------+---------------+
                                                 |
                          +----------------------+----------------------+
                          |                                             |
                          v                                             v
                 +------------------+                         +------------------+
                 | AI Prediction    |                         | Agents Layer     |
                 | MLflow + Model   |                         | Text-to-SQL      |
                 +--------+---------+                         +--------+---------+
                          |                                             |
                          v                                             |
                 +------------------+                                   |
                 | Prediction Result|-----------------------------------+
                 | Save to DW       |
                 +------------------+

Web Flow:

+-------------+      +-------------+      +----------------+
| Frontend    |----->| API Gateway |----->| FastAPI Backend |
| Next.js     |      | Nginx/Kong  |      | REST/WebSocket  |
+-------------+      +-------------+      +-------+--------+
                                                  |
                                  +---------------+---------------+
                                  |                               |
                                  v                               v
                              ScyllaDB                    PostgreSQL DW
                         realtime/history               analytics/prediction/agent
```

---

## 3. Chỉnh lại logic Data Pipeline

### 3.1 Dữ liệu realtime stock price

Luồng realtime nên đi qua Kafka vì dữ liệu giá có tần suất cao, cần xử lý stream, giữ thứ tự và có thể có nhiều consumer.

```text
Yahoo Finance WebSocket
    ↓
Producer
    ↓
Kafka raw_stock_events
    ↓
Schema Registry
    ↓
Flink
    ↓
ScyllaDB Online Store
```

Flink xử lý:

- Validate dữ liệu.
- Chuẩn hóa schema.
- Tính OHLCV realtime.
- Tính latest price.
- Tính indicator đơn giản nếu cần.
- Ghi kết quả vào ScyllaDB.

Kafka key:

```text
key = symbol
```

Lý do:

- Event cùng mã cổ phiếu vào cùng partition.
- Giữ thứ tự event theo từng mã.
- Flink aggregate theo symbol chính xác hơn.

---

### 3.2 Dữ liệu news, reports, company info

Dữ liệu news/info **không bắt buộc phải đi qua Kafka**.

Vì news, reports, company info thường là batch hoặc near-realtime, tần suất thấp hơn stock tick data. Do đó có thể crawl và lưu trực tiếp vào ScyllaDB hoặc PostgreSQL staging.

Luồng đề xuất giai đoạn đầu:

```text
News / Reports / Company Info
    ↓
Scraper chạy mỗi 60 phút
    ↓
ScyllaDB raw_news / raw_company_info
    ↓
Airflow ETL
    ↓
PostgreSQL Data Warehouse
```

Khi nào mới cần đưa news vào Kafka?

Chỉ nên đưa vào Kafka nếu cần:

- Stream sentiment realtime.
- Nhiều service cùng consume news event.
- Alert khi có tin tức mới.
- Replay event để xử lý lại.
- Chuẩn hóa toàn bộ ingestion qua event-driven architecture.

Giai đoạn hiện tại nên làm đơn giản:

```text
News scraper -> ScyllaDB -> Airflow -> PostgreSQL DW
```

---

### 3.3 Vai trò đúng của Flink

Flink không phải chỉ xử lý Kafka, nhưng trong hệ thống này Flink nên ưu tiên xử lý **stream realtime từ Kafka**.

Lý do:

- Kafka là nguồn event realtime chính.
- Flink mạnh ở windowing, stateful processing, checkpoint.
- Dữ liệu stock price cần xử lý liên tục.
- News/info có thể xử lý bằng Airflow vì không cần realtime strict.

Flink có thể đọc từ nhiều nguồn:

```text
Kafka
File
Database CDC
Socket
API
```

Nhưng trong project này, scope hợp lý là:

```text
Kafka stock price stream -> Flink -> ScyllaDB
```

Airflow sẽ xử lý phần batch:

```text
ScyllaDB raw news/info/price -> transform -> PostgreSQL DW
```

---

## 4. Storage Design

## 4.1 ScyllaDB - Online Store

ScyllaDB dùng để lưu dữ liệu online/realtime và raw/staging.

Dùng cho:

- Raw stock price.
- Latest stock price.
- OHLCV intraday.
- Raw news.
- Raw company info.
- Raw financial reports metadata.

Không dùng ScyllaDB để query analytics phức tạp.

### Bảng stock price raw

```sql
CREATE TABLE stock_prices_raw (
    symbol text,
    event_date date,
    event_time timestamp,
    price double,
    volume bigint,
    source text,
    PRIMARY KEY ((symbol, event_date), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);
```

### Bảng latest price

```sql
CREATE TABLE stock_latest_prices (
    symbol text PRIMARY KEY,
    price double,
    volume bigint,
    event_time timestamp,
    source text
);
```

### Bảng OHLCV intraday

```sql
CREATE TABLE stock_ohlcv_1m (
    symbol text,
    event_date date,
    window_start timestamp,
    window_end timestamp,
    open_price double,
    high_price double,
    low_price double,
    close_price double,
    volume bigint,
    PRIMARY KEY ((symbol, event_date), window_start)
) WITH CLUSTERING ORDER BY (window_start DESC);
```

### Bảng raw news

```sql
CREATE TABLE raw_news (
    source text,
    crawl_date date,
    published_at timestamp,
    url text,
    title text,
    content text,
    symbols list<text>,
    PRIMARY KEY ((source, crawl_date), published_at, url)
) WITH CLUSTERING ORDER BY (published_at DESC);
```

### Bảng raw company info

```sql
CREATE TABLE raw_company_info (
    symbol text PRIMARY KEY,
    company_name text,
    exchange text,
    sector text,
    industry text,
    profile text,
    updated_at timestamp
);
```

---

## 4.2 PostgreSQL Data Warehouse - Star Schema

PostgreSQL dùng cho:

- Analytics.
- Dashboard historical.
- AI training data.
- Prediction result.
- Agents Text-to-SQL.

### Dimension tables

```text
dim_stock
dim_date
dim_sector
dim_company
dim_news_source
```

### Fact tables

```text
fact_stock_daily_prices
fact_stock_intraday_prices
fact_stock_predictions
fact_stock_news
fact_technical_indicators
fact_agent_queries
```

### Schema đề xuất

```sql
CREATE TABLE dim_stock (
    stock_id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    company_name TEXT,
    exchange VARCHAR(20),
    sector TEXT,
    industry TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    full_date DATE NOT NULL,
    day INT,
    month INT,
    quarter INT,
    year INT,
    day_of_week INT
);
```

```sql
CREATE TABLE fact_stock_daily_prices (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT REFERENCES dim_stock(stock_id),
    date_id INT REFERENCES dim_date(date_id),
    open_price NUMERIC,
    high_price NUMERIC,
    low_price NUMERIC,
    close_price NUMERIC,
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE fact_stock_predictions (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT REFERENCES dim_stock(stock_id),
    prediction_date DATE,
    target_date DATE,
    predicted_close NUMERIC,
    confidence NUMERIC,
    model_name TEXT,
    model_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE fact_stock_news (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT REFERENCES dim_stock(stock_id),
    date_id INT REFERENCES dim_date(date_id),
    published_at TIMESTAMP,
    title TEXT,
    content TEXT,
    source TEXT,
    sentiment_score NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE fact_agent_queries (
    id BIGSERIAL PRIMARY KEY,
    user_question TEXT,
    generated_sql TEXT,
    answer TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Web Pipeline

```text
Frontend Next.js
    ↓
API Gateway
    ↓
Backend FastAPI
    ↓
ScyllaDB / PostgreSQL / AI Service
```

### API Gateway

Bổ sung vào kiến trúc gốc.

Công nghệ ban đầu:

```text
Nginx
```

Có thể nâng cấp sau:

```text
Kong
```

Vai trò:

- Routing request.
- CORS.
- Rate limit cơ bản.
- Logging.
- Auth gateway nếu cần.

Route đề xuất:

```text
/                 -> frontend
/api/*            -> backend
/ws/*             -> backend websocket
/predict/*        -> ai-service
/agent/*          -> agent-service
```

### Backend FastAPI

API chính:

```text
GET /health

GET /api/stocks
GET /api/stocks/{symbol}
GET /api/stocks/{symbol}/latest
GET /api/stocks/{symbol}/intraday
GET /api/stocks/{symbol}/daily
GET /api/stocks/{symbol}/news
GET /api/stocks/{symbol}/predictions

GET /api/analytics/top-gainers
GET /api/analytics/top-losers
GET /api/analytics/high-volume
GET /api/analytics/market-summary

WS /ws/stocks/{symbol}
```

Backend đọc:

```text
ScyllaDB: latest price, intraday, realtime
PostgreSQL DW: daily analytics, predictions, news, agent data
AI Service: prediction API
```

---

## 6. Batch Pipeline - Airflow

Airflow là trung tâm xử lý batch.

### DAG 1: news_info_crawler_dag

Chạy mỗi 60 phút.

```text
crawl_news
    ↓
clean_news
    ↓
extract_symbols
    ↓
save_raw_news_to_scylladb
```

### DAG 2: stock_daily_etl_dag

Chạy mỗi 15 phút hoặc cuối ngày.

```text
extract_stock_data_from_scylladb
    ↓
transform_ohlcv_daily
    ↓
load_dim_stock
    ↓
load_dim_date
    ↓
load_fact_stock_daily_prices
    ↓
data_quality_check
```

### DAG 3: news_etl_dag

Chạy mỗi 1 giờ hoặc cuối ngày.

```text
extract_raw_news_from_scylladb
    ↓
sentiment_analysis
    ↓
map_news_to_stock
    ↓
load_fact_stock_news
```

### DAG 4: model_training_dag

Chạy theo lịch.

```text
get_training_data_from_postgres
    ↓
feature_engineering
    ↓
train_model
    ↓
evaluate_model
    ↓
save_best_model
    ↓
log_to_mlflow
```

### DAG 5: prediction_dag

Chạy theo lịch.

```text
get_recent_data_from_postgres
    ↓
call_prediction_service
    ↓
save_prediction_to_postgres
```

---

## 7. Training Pipeline

```text
PostgreSQL Data Warehouse
    ↓
Airflow DAG for Model Training
    ↓
Feature Engineering
    ↓
Model Training
    ↓
MLflow Tracking
    ↓
Save Best Model
    ↓
Prediction Service
    ↓
Save Prediction Result to PostgreSQL DW
```

### Model roadmap

```text
V1: Moving Average, Linear Regression
V2: Random Forest, XGBoost
V3: LSTM / GRU
V4: Transformer + News Sentiment
```

---

## 8. Agents Layer - Làm cuối cùng

Agents sẽ không can thiệp vào streaming pipeline.

Agents sử dụng PostgreSQL Data Warehouse theo star schema.

```text
User Question
    ↓
Frontend Chat UI
    ↓
API Gateway
    ↓
Agent Service
    ↓
Schema Context from PostgreSQL DW
    ↓
Text-to-SQL
    ↓
SQL Validation
    ↓
Query PostgreSQL DW
    ↓
Summarize Result
    ↓
Return Answer
```

### Vì sao dùng PostgreSQL DW cho agent?

- Schema rõ ràng.
- Dễ generate SQL.
- Dữ liệu đã được clean.
- Có dim/fact phục vụ phân tích.
- Không ảnh hưởng tới online store ScyllaDB.

### Agent tools

```text
query_warehouse(sql)
get_stock_profile(symbol)
get_latest_price(symbol)
get_prediction(symbol)
get_news(symbol)
generate_chart(data)
```

### Guardrails

```text
Chỉ cho phép SELECT
Không cho phép UPDATE/DELETE/DROP
Auto LIMIT
Query timeout
Log generated SQL
Log câu hỏi vào fact_agent_queries
```

---

## 9. CI/CD

CI/CD nên bổ sung vào kiến trúc nhưng triển khai theo mức độ.

### CI - nên làm sớm

Dùng GitHub Actions.

Trigger:

```text
pull_request
push
```

Các bước:

```text
Checkout code
Setup Python/Node
Install dependencies
Run lint
Run unit tests
Build Docker images
Check docker compose config
```

Service cần CI:

```text
backend
frontend
ai-service
streaming consumer
airflow dags
agent-service sau này
```

### CD - làm sau MVP

Giai đoạn đầu có thể deploy thủ công bằng Docker Compose.

Sau MVP mới thêm CD:

```text
Push main
    ↓
Build Docker images
    ↓
Push GHCR / Docker Hub
    ↓
SSH server
    ↓
docker compose pull
    ↓
docker compose up -d
```

### Kết luận

```text
CI: cần, nên làm sớm
CD: cần sau MVP
Kubernetes CD: chưa cần giai đoạn đầu
```

---

## 10. Monitoring & Logging

Bổ sung vào kiến trúc để theo dõi hệ thống.

### Monitoring

Công nghệ:

```text
Prometheus
Grafana
Kafka UI
Airflow UI
Flink Dashboard
MLflow UI
```

Metrics cần theo dõi:

```text
Kafka message rate
Kafka consumer lag
Flink throughput
Flink checkpoint status
ScyllaDB write latency
PostgreSQL query latency
Backend API latency
Airflow DAG success/failure
Prediction service latency
```

### Logging

Giai đoạn đầu:

```text
Docker logs
FastAPI structured logs
Airflow logs
```

Sau này có thể thêm:

```text
Loki + Grafana
ELK Stack
```

---

## 11. Roadmap triển khai

### Phase 0: Project skeleton

- Tạo monorepo.
- Tạo docker-compose.
- Tạo frontend, backend, gateway.
- Tạo PostgreSQL, ScyllaDB.
- Tạo README và `.env.example`.

Output:

```text
docker compose up chạy được.
```

---

### Phase 1: Web base

- Setup Next.js.
- Setup FastAPI.
- Setup Nginx Gateway.
- Tạo API health check.
- Frontend gọi backend qua gateway.

Output:

```text
Frontend -> Gateway -> Backend OK.
```

---

### Phase 2: Database base

- Tạo ScyllaDB schema.
- Tạo PostgreSQL star schema.
- Backend kết nối được 2 database.
- Insert/read dữ liệu test.

Output:

```text
ScyllaDB và PostgreSQL hoạt động.
```

---

### Phase 3: Realtime stock pipeline

- Setup Kafka.
- Tạo topic raw stock events.
- Viết stock producer.
- Tạo Schema Registry nếu dùng Avro.
- Viết Flink job hoặc consumer đơn giản.
- Ghi raw/latest/OHLCV vào ScyllaDB.

Output:

```text
Stock source -> Kafka -> Flink/Consumer -> ScyllaDB.
```

---

### Phase 4: News & Info pipeline

- Viết scraper news/info.
- Chạy scraper bằng Airflow hoặc scheduler.
- Lưu raw news/info vào ScyllaDB.
- ETL sang PostgreSQL DW.

Output:

```text
News/info -> ScyllaDB -> Airflow -> PostgreSQL DW.
```

---

### Phase 5: Realtime Web

- Backend API latest price.
- Backend API intraday.
- Backend WebSocket.
- Frontend realtime chart.

Output:

```text
Dashboard xem realtime price.
```

---

### Phase 6: Batch ETL Warehouse

- Airflow ETL ScyllaDB -> PostgreSQL.
- Load dim/fact.
- Data quality check.
- Analytics API.

Output:

```text
PostgreSQL DW có dữ liệu phân tích.
```

---

### Phase 7: AI Prediction

- AI service.
- MLflow.
- Baseline model.
- Training DAG.
- Prediction DAG.
- Save prediction to DW.

Output:

```text
Prediction result hiển thị trên frontend.
```

---

### Phase 8: CI + Monitoring

- GitHub Actions CI.
- Build/test backend.
- Build/test frontend.
- Build Docker images.
- Prometheus/Grafana cơ bản.
- Kafka UI/Airflow UI/Flink UI.

Output:

```text
Có CI và monitoring cơ bản.
```

---

### Phase 9: Agents Layer

- Agent service.
- Schema context.
- Text-to-SQL.
- SQL validation.
- Query PostgreSQL DW.
- Frontend chat UI.
- Log câu hỏi.

Output:

```text
Người dùng hỏi đáp được trên dữ liệu warehouse.
```

---

### Phase 10: CD + Hardening

- Docker image registry.
- Auto deploy bằng GitHub Actions.
- Backup database.
- Auth.
- Rate limit.
- Alerting.
- Tối ưu performance.

Output:

```text
Hệ thống deploy ổn định hơn.
```

---

## 12. Checklist MVP

### Data Pipeline

- [ ] Stock producer gửi dữ liệu realtime.
- [ ] Kafka nhận raw stock events.
- [ ] Flink/consumer xử lý và ghi ScyllaDB.
- [ ] News/info scraper lưu raw vào ScyllaDB.
- [ ] Airflow ETL sang PostgreSQL DW.

### Web Pipeline

- [ ] Frontend chạy.
- [ ] API Gateway chạy.
- [ ] Backend FastAPI chạy.
- [ ] API latest price.
- [ ] API historical price.
- [ ] WebSocket realtime.

### Training Pipeline

- [ ] PostgreSQL DW có training data.
- [ ] Training DAG chạy.
- [ ] MLflow tracking.
- [ ] Prediction service chạy.
- [ ] Prediction result lưu vào DW.

### Platform

- [ ] GitHub Actions CI.
- [ ] Monitoring cơ bản.
- [ ] Logging cơ bản.

### Agents - sau MVP

- [ ] Agent service.
- [ ] Text-to-SQL.
- [ ] Query PostgreSQL DW.
- [ ] Trả lời tiếng Việt.
- [ ] Log câu hỏi.

---

## 13. Những phần chưa cần ở giai đoạn đầu

```text
Redis
Kubernetes
ClickHouse
Advanced CDC
Multi-node ScyllaDB
Transformer model
RAG phức tạp
Full CD pipeline
```

Có thể bổ sung sau khi MVP ổn định.

---

## 14. Kết luận thiết kế

Thiết kế hợp lý nhất ở giai đoạn hiện tại:

```text
Realtime stock:
Yahoo Finance -> Kafka -> Flink -> ScyllaDB

News/info:
Scraper -> ScyllaDB -> Airflow ETL -> PostgreSQL DW

Batch analytics:
ScyllaDB -> Airflow -> PostgreSQL DW

AI prediction:
PostgreSQL DW -> Training/Prediction -> PostgreSQL DW

Web:
Frontend -> API Gateway -> Backend -> ScyllaDB/PostgreSQL

Agents:
Frontend -> API Gateway -> Agent Service -> PostgreSQL DW
```

Cách này giữ kiến trúc rõ ràng:

- Kafka/Flink chỉ dùng cho realtime stock stream.
- News/info đi batch để đơn giản và đúng nhu cầu.
- ScyllaDB là online/raw store.
- PostgreSQL là analytical warehouse theo star schema.
- Agents làm cuối và chỉ khai thác warehouse đã được chuẩn hóa.
