CREATE KEYSPACE IF NOT EXISTS stock_online_store
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE stock_online_store;

CREATE TABLE IF NOT EXISTS stock_prices_raw (
    symbol text,
    event_date date,
    event_time timestamp,
    price double,
    volume bigint,
    source text,
    PRIMARY KEY ((symbol, event_date), event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);

CREATE TABLE IF NOT EXISTS stock_latest_prices (
    symbol text PRIMARY KEY,
    price double,
    volume bigint,
    event_time timestamp,
    source text
);

CREATE TABLE IF NOT EXISTS stock_ohlcv_1m (
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

CREATE TABLE IF NOT EXISTS raw_news (
    source text,
    crawl_date date,
    published_at timestamp,
    url text,
    title text,
    content text,
    symbols list<text>,
    PRIMARY KEY ((source, crawl_date), published_at, url)
) WITH CLUSTERING ORDER BY (published_at DESC);

CREATE TABLE IF NOT EXISTS raw_company_info (
    symbol text PRIMARY KEY,
    company_name text,
    exchange text,
    sector text,
    industry text,
    profile text,
    updated_at timestamp
);
