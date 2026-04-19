from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="Market Research Lab")
    app_env: str = Field(default="development")
    app_debug: bool = Field(default=True)
    app_host: str = Field(default="0.0.0.0")
    app_port: int = Field(default=8000)

    log_level: str = Field(default="INFO")
    timezone: str = Field(default="UTC")

    market_data_provider: str = Field(default="mock")

    twelvedata_api_key: str = Field(default="")
    twelvedata_base_url: str = Field(default="https://api.twelvedata.com")

    binance_api_key: str = Field(default="")
    binance_api_secret: str = Field(default="")
    binance_base_url: str = Field(default="https://api.binance.com")
    binance_trading_api_key: str = Field(default="")
    binance_trading_api_secret: str = Field(default="")
    binance_trading_base_url: str = Field(default="https://testnet.binance.vision")
    binance_trading_recv_window_ms: int = Field(default=5000)
    binance_trading_timeout_seconds: int = Field(default=30)
    binance_trading_require_testnet: bool = Field(default=True)

    database_url: str = Field(default="sqlite:///./market_research_lab.db")
    stage_test_run_command: str = Field(default="python -m app.stage_tests.runner")
    stage_test_auto_order_enabled: bool = Field(default=False)
    stage_test_auto_order_min_confirmation_score: float = Field(default=95.0)
    stage_test_auto_order_max_orders_per_run: int = Field(default=1)
    stage_test_auto_order_quote_order_qty: float = Field(default=20.0)
    stage_test_auto_order_test_mode: bool = Field(default=True)
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173"
    )

    candle_cache_enabled: bool = Field(default=True)
    candle_cache_sync_on_read: bool = Field(default=True)
    candle_cache_reconcile_bars: int = Field(default=2)

    candles_bootstrap_limit_intraday: int = Field(default=500)
    candles_bootstrap_limit_daily: int = Field(default=120)
    candles_gap_fill_max_bars: int = Field(default=5000)
    provider_quota_cooldown_minutes: int = Field(default=60)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
