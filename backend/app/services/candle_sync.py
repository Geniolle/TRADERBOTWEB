# G:\O meu disco\python\Trader-bot\app\services\candle_sync.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.providers.factory import MarketDataProviderFactory
from app.storage.repositories.candle_queries import CandleQueryRepository
from app.storage.repositories.candle_repository import CandleRepository
from app.utils.datetime_utils import ensure_naive_utc, timeframe_to_timedelta

logger = get_logger(__name__)


@dataclass
class CandleSyncResult:
    symbol: str
    timeframe: str
    provider: str
    used_provider: bool
    fetched_count: int
    reason: str


class CandleSyncService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.query_repository = CandleQueryRepository()
        self.write_repository = CandleRepository()

    def ensure_local_coverage(
        self,
        session,
        symbol: str,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
        provider_name: str | None = None,
    ) -> CandleSyncResult:
        normalized_symbol = symbol.strip().upper()
        normalized_timeframe = timeframe.strip().lower()
        normalized_start_at = ensure_naive_utc(start_at)
        normalized_end_at = ensure_naive_utc(end_at)
        provider_name_effective = (
            (provider_name or self.settings.market_data_provider or "mock").strip().lower()
        )

        logger.info("###################################################################################")
        logger.info(
            "[CANDLE_SYNC] INÍCIO | SYMBOL=%s | TIMEFRAME=%s | PROVIDER=%s | START=%s | END=%s",
            normalized_symbol,
            normalized_timeframe,
            provider_name_effective,
            normalized_start_at.isoformat(),
            normalized_end_at.isoformat(),
        )

        if not self.settings.candle_cache_enabled:
            logger.info("[CANDLE_SYNC] CACHE_DESATIVADA")
            logger.info("###################################################################################")
            return CandleSyncResult(
                symbol=normalized_symbol,
                timeframe=normalized_timeframe,
                provider=provider_name_effective,
                used_provider=False,
                fetched_count=0,
                reason="cache_disabled",
            )

        if normalized_start_at >= normalized_end_at:
            logger.info("[CANDLE_SYNC] RANGE_INVÁLIDO")
            logger.info("###################################################################################")
            return CandleSyncResult(
                symbol=normalized_symbol,
                timeframe=normalized_timeframe,
                provider=provider_name_effective,
                used_provider=False,
                fetched_count=0,
                reason="invalid_range",
            )

        rows_in_requested_range = self.query_repository.list_by_filters(
            session=session,
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            start_at=normalized_start_at,
            end_at=normalized_end_at,
            limit=5000,
            source=provider_name_effective,
        )

        latest_local = self.query_repository.get_latest(
            session=session,
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            source=provider_name_effective,
        )

        logger.info(
            "[CANDLE_SYNC] BASE_LOCAL | PROVIDER=%s | COUNT_RANGE=%s | HAS_LATEST=%s",
            provider_name_effective,
            len(rows_in_requested_range),
            latest_local is not None,
        )

        if latest_local is not None:
            latest_local_open_time = ensure_naive_utc(latest_local.open_time)
            latest_local_close_time = ensure_naive_utc(latest_local.close_time)

            logger.info(
                "[CANDLE_SYNC] ÚLTIMO_LOCAL | PROVIDER=%s | OPEN=%s | CLOSE=%s",
                provider_name_effective,
                latest_local_open_time.isoformat(),
                latest_local_close_time.isoformat(),
            )

            if latest_local_close_time >= normalized_end_at:
                logger.info("[CANDLE_SYNC] COBERTURA_LOCAL_OK | PROVIDER=%s", provider_name_effective)
                logger.info("###################################################################################")
                return CandleSyncResult(
                    symbol=normalized_symbol,
                    timeframe=normalized_timeframe,
                    provider=provider_name_effective,
                    used_provider=False,
                    fetched_count=0,
                    reason="local_coverage_ok",
                )

        provider = MarketDataProviderFactory().get_provider(provider_name_effective)

        logger.info(
            "[CANDLE_SYNC] PROVIDER_ESCOLHIDO | PROVIDER=%s",
            provider_name_effective,
        )

        if latest_local is None:
            bootstrap_limit = self._bootstrap_limit_for_timeframe(normalized_timeframe)
            timeframe_step = timeframe_to_timedelta(normalized_timeframe)
            bootstrap_start = max(
                normalized_start_at,
                normalized_end_at - (timeframe_step * bootstrap_limit),
            )

            logger.info(
                "[CANDLE_SYNC] BOOTSTRAP | PROVIDER=%s | LIMIT=%s | FETCH_START=%s | FETCH_END=%s",
                provider_name_effective,
                bootstrap_limit,
                bootstrap_start.isoformat(),
                normalized_end_at.isoformat(),
            )

            candles = provider.get_historical_candles(
                symbol=normalized_symbol,
                timeframe=normalized_timeframe,
                start_at=bootstrap_start,
                end_at=normalized_end_at,
            )

            logger.info(
                "[CANDLE_SYNC] BOOTSTRAP_RESULT | PROVIDER=%s | FETCHED=%s",
                provider_name_effective,
                len(candles),
            )

            if candles:
                self.write_repository.save_many(session=session, candles=candles)
                logger.info(
                    "[CANDLE_SYNC] BOOTSTRAP_SAVE | PROVIDER=%s | SAVED=%s",
                    provider_name_effective,
                    len(candles),
                )

            logger.info("###################################################################################")
            return CandleSyncResult(
                symbol=normalized_symbol,
                timeframe=normalized_timeframe,
                provider=provider_name_effective,
                used_provider=True,
                fetched_count=len(candles),
                reason="bootstrap_recent_window",
            )

        latest_close = ensure_naive_utc(latest_local.close_time)
        timeframe_step = timeframe_to_timedelta(normalized_timeframe)

        if latest_close >= normalized_end_at:
            logger.info("[CANDLE_SYNC] LOCAL_JÁ_ATUAL | PROVIDER=%s", provider_name_effective)
            logger.info("###################################################################################")
            return CandleSyncResult(
                symbol=normalized_symbol,
                timeframe=normalized_timeframe,
                provider=provider_name_effective,
                used_provider=False,
                fetched_count=0,
                reason="local_latest_already_current",
            )

        gap_start = latest_close
        gap_end = normalized_end_at

        missing_bars = self._count_bars_between(
            timeframe=normalized_timeframe,
            start_at=gap_start,
            end_at=gap_end,
        )

        logger.info(
            "[CANDLE_SYNC] GAP_ANALYSIS | PROVIDER=%s | GAP_START=%s | GAP_END=%s | MISSING_BARS=%s",
            provider_name_effective,
            gap_start.isoformat(),
            gap_end.isoformat(),
            missing_bars,
        )

        if missing_bars <= 0:
            logger.info("[CANDLE_SYNC] NOTHING_TO_SYNC | PROVIDER=%s", provider_name_effective)
            logger.info("###################################################################################")
            return CandleSyncResult(
                symbol=normalized_symbol,
                timeframe=normalized_timeframe,
                provider=provider_name_effective,
                used_provider=False,
                fetched_count=0,
                reason="nothing_to_sync",
            )

        max_gap_bars = max(10, self.settings.candles_gap_fill_max_bars)
        if missing_bars > max_gap_bars:
            gap_start = max(
                latest_close,
                normalized_end_at - (timeframe_step * max_gap_bars),
            )
            logger.info(
                "[CANDLE_SYNC] GAP_LIMIT_APLICADO | PROVIDER=%s | MAX_GAP_BARS=%s | NEW_GAP_START=%s",
                provider_name_effective,
                max_gap_bars,
                gap_start.isoformat(),
            )

        candles = provider.get_historical_candles(
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            start_at=gap_start,
            end_at=gap_end,
        )

        logger.info(
            "[CANDLE_SYNC] GAP_FETCH_RESULT | PROVIDER=%s | FETCHED=%s",
            provider_name_effective,
            len(candles),
        )

        if candles:
            self.write_repository.save_many(session=session, candles=candles)
            logger.info(
                "[CANDLE_SYNC] GAP_SAVE | PROVIDER=%s | SAVED=%s",
                provider_name_effective,
                len(candles),
            )

        logger.info("###################################################################################")
        return CandleSyncResult(
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            provider=provider_name_effective,
            used_provider=True,
            fetched_count=len(candles),
            reason="gap_fill_forward_only",
        )

    def _bootstrap_limit_for_timeframe(self, timeframe: str) -> int:
        if timeframe in {"1d", "1w", "1mo"}:
            return max(10, self.settings.candles_bootstrap_limit_daily)
        return max(10, self.settings.candles_bootstrap_limit_intraday)

    def _count_bars_between(
        self,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> int:
        step = timeframe_to_timedelta(timeframe)
        seconds = max(0, int((end_at - start_at).total_seconds()))
        step_seconds = max(1, int(step.total_seconds()))
        return seconds // step_seconds