from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    kafka_bootstrap_servers: str = "localhost:9094"
    kafka_raw_stock_topic: str = "raw_stock_events"
    kafka_consumer_group: str = "stock-scylla-writer"
    kafka_num_partitions: int = 3

    stock_symbols: str = "AAPL,MSFT,NVDA"
    producer_interval_seconds: float = 2.0

    scylla_hosts: str = "localhost"
    scylla_keyspace: str = "stock_online_store"
    scylla_local_dc: str = "datacenter1"

    log_level: str = "INFO"
    log_dir: str = "logs"
    log_file_name: str = "streaming.log"

    @property
    def symbols(self) -> list[str]:
        return [symbol.strip().upper() for symbol in self.stock_symbols.split(",") if symbol.strip()]

    @property
    def scylla_contact_points(self) -> list[str]:
        return [host.strip() for host in self.scylla_hosts.split(",") if host.strip()]

    @property
    def log_file_path(self) -> str:
        return f"{self.log_dir.rstrip('/')}/{self.log_file_name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
