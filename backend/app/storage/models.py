# G:\O meu disco\python\Trader-bot\app\storage\models.py

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.storage.database import Base


def generate_uuid() -> str:
    return str(uuid4())


class CandleModel(Base):
    __tablename__ = "candles"
    __table_args__ = (
        UniqueConstraint(
            "symbol",
            "timeframe",
            "open_time",
            "source",
            name="uq_candles_symbol_timeframe_open_time_source",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    asset_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(20), nullable=False)

    open_time: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    close_time: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)

    open: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    volume: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="unknown",
    )


class StrategyRunModel(Base):
    __tablename__ = "strategy_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    strategy_key: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    strategy_config_id: Mapped[str] = mapped_column(String(100), nullable=False)
    mode: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(20), nullable=False)

    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    status: Mapped[str] = mapped_column(String(50), nullable=False)
    total_candles_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cases_opened: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cases_closed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)


class StrategyCaseModel(Base):
    __tablename__ = "strategy_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), nullable=False)
    strategy_config_id: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(20), nullable=False)

    trigger_time: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    trigger_candle_time: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    entry_time: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    entry_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)

    target_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    invalidation_price: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    timeout_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    status: Mapped[str] = mapped_column(String(50), nullable=False)
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)

    close_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    close_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)

    bars_to_resolution: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_favorable_excursion: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )
    max_adverse_excursion: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )

    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")


class StrategyMetricsModel(Base):
    __tablename__ = "strategy_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    run_id: Mapped[str] = mapped_column(String(36), nullable=False)

    total_cases: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_fails: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_timeouts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    hit_rate: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )
    fail_rate: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )
    timeout_rate: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )

    avg_bars_to_resolution: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )
    avg_time_to_resolution_seconds: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )
    avg_mfe: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )
    avg_mae: Mapped[Decimal] = mapped_column(
        Numeric(18, 8),
        nullable=False,
        default=Decimal("0"),
    )


# Compatibilidade com imports antigos do projeto
Candle = CandleModel
StrategyRun = StrategyRunModel
StrategyCase = StrategyCaseModel
StrategyMetric = StrategyMetricsModel
StrategyMetrics = StrategyMetricsModel