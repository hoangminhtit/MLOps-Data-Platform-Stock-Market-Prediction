from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Stock Prediction Service"
    stock_symbols: str = "AAPL,MSFT,NVDA"
    prediction_window_days: int = 5

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "stock_dw"
    postgres_user: str = "stock_user"
    postgres_password: str = "stock_password"

    @property
    def symbols(self) -> list[str]:
        return [symbol.strip().upper() for symbol in self.stock_symbols.split(",") if symbol.strip()]

    @property
    def postgres_dsn(self) -> str:
        return (
            f"host={self.postgres_host} port={self.postgres_port} dbname={self.postgres_db} "
            f"user={self.postgres_user} password={self.postgres_password}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
