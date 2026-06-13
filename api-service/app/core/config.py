from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Stock Market Data Platform"
    environment: str = "local"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

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
    log_file_name: str = "backend.log"

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

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
