CREATE TABLE IF NOT EXISTS dim_sector (
    sector_id SERIAL PRIMARY KEY,
    sector_name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_company (
    company_id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    exchange VARCHAR(20),
    industry TEXT,
    sector_id INT REFERENCES dim_sector(sector_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dim_stock (
    stock_id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    company_id INT REFERENCES dim_company(company_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dim_date (
    date_id INT PRIMARY KEY,
    full_date DATE UNIQUE NOT NULL,
    day INT NOT NULL,
    month INT NOT NULL,
    quarter INT NOT NULL,
    year INT NOT NULL,
    day_of_week INT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_news_source (
    source_id SERIAL PRIMARY KEY,
    source_name TEXT UNIQUE NOT NULL,
    source_url TEXT
);

CREATE TABLE IF NOT EXISTS fact_stock_daily_prices (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT NOT NULL REFERENCES dim_stock(stock_id),
    date_id INT NOT NULL REFERENCES dim_date(date_id),
    open_price NUMERIC,
    high_price NUMERIC,
    low_price NUMERIC,
    close_price NUMERIC,
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (stock_id, date_id)
);

CREATE TABLE IF NOT EXISTS fact_stock_intraday_prices (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT NOT NULL REFERENCES dim_stock(stock_id),
    event_time TIMESTAMP NOT NULL,
    open_price NUMERIC,
    high_price NUMERIC,
    low_price NUMERIC,
    close_price NUMERIC,
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fact_stock_news (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT REFERENCES dim_stock(stock_id),
    source_id INT REFERENCES dim_news_source(source_id),
    date_id INT REFERENCES dim_date(date_id),
    published_at TIMESTAMP,
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    sentiment_score NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fact_stock_predictions (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT NOT NULL REFERENCES dim_stock(stock_id),
    prediction_date DATE NOT NULL,
    target_date DATE NOT NULL,
    predicted_close NUMERIC,
    confidence NUMERIC,
    model_name TEXT,
    model_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fact_technical_indicators (
    id BIGSERIAL PRIMARY KEY,
    stock_id INT NOT NULL REFERENCES dim_stock(stock_id),
    date_id INT NOT NULL REFERENCES dim_date(date_id),
    indicator_name TEXT NOT NULL,
    indicator_value NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fact_agent_queries (
    id BIGSERIAL PRIMARY KEY,
    user_question TEXT NOT NULL,
    generated_sql TEXT,
    answer TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
