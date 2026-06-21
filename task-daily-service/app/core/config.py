from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    stock_symbols: str = "AAPL,MSFT,NVDA"
    news_sources: str = "mock_market_news"
    news_scrape_interval_seconds: int = 300
    news_etl_interval_seconds: int = 300
    news_etl_start_delay_seconds: int = 10
    stock_etl_interval_seconds: int = 300
    stock_etl_start_delay_seconds: int = 15

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "stock_dw"
    postgres_user: str = "stock_user"
    postgres_password: str = "stock_password"

    scylla_hosts: str = "localhost"
    scylla_keyspace: str = "stock_online_store"
    scylla_local_dc: str = "datacenter1"

    log_level: str = "INFO"
    log_dir: str = "logs"
    log_file_name: str = "batch.log"

    @property
    def symbols(self) -> list[str]:
        return [symbol.strip().upper() for symbol in self.stock_symbols.split(",") if symbol.strip()]

    @property
    def sources(self) -> list[str]:
        return [source.strip() for source in self.news_sources.split(",") if source.strip()]

    @property
    def scylla_contact_points(self) -> list[str]:
        return [host.strip() for host in self.scylla_hosts.split(",") if host.strip()]

    @property
    def postgres_dsn(self) -> str:
        return (
            f"host={self.postgres_host} port={self.postgres_port} dbname={self.postgres_db} "
            f"user={self.postgres_user} password={self.postgres_password}"
        )

    @property
    def log_file_path(self) -> str:
        return f"{self.log_dir.rstrip('/')}/{self.log_file_name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
