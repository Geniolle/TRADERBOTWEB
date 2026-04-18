from __future__ import annotations

from typing import Any

from app.core.logging import get_logger
from app.storage.cache_models import CandleCoverageModel

logger = get_logger(__name__)


class CandleCacheSyncService:
    def __init__(self) -> None:
        logger.info("###################################################################################")
        logger.info("[CANDLE_CACHE_SYNC] INIT")
        logger.info(
            "[CANDLE_CACHE_SYNC] COVERAGE_MODEL=%s",
            CandleCoverageModel.__name__,
        )
        logger.info(
            "[CANDLE_CACHE_SYNC] COVERAGE_TABLE=%s",
            getattr(CandleCoverageModel, "__tablename__", "N/A"),
        )
        logger.info("###################################################################################")

    def ensure_range(
        self,
        session: Any,
        symbol: str,
        timeframe: str,
        start_at: Any,
        end_at: Any,
        limit: int = 5000,
        sync: bool = True,
        **kwargs: Any,
    ) -> int:
        logger.info("###################################################################################")
        logger.info("[CANDLE_CACHE_SYNC] INICIO")
        logger.info("[CANDLE_CACHE_SYNC] SESSION_PRESENT=%s", session is not None)
        logger.info("[CANDLE_CACHE_SYNC] SYMBOL=%s", symbol)
        logger.info("[CANDLE_CACHE_SYNC] TIMEFRAME=%s", timeframe)
        logger.info("[CANDLE_CACHE_SYNC] START_AT=%s", start_at)
        logger.info("[CANDLE_CACHE_SYNC] END_AT=%s", end_at)
        logger.info("[CANDLE_CACHE_SYNC] LIMIT=%s", limit)
        logger.info("[CANDLE_CACHE_SYNC] SYNC=%s", sync)
        logger.info("[CANDLE_CACHE_SYNC] EXTRA_KWARGS=%s", sorted(kwargs.keys()))
        logger.info(
            "[CANDLE_CACHE_SYNC] COVERAGE_MODEL=%s",
            CandleCoverageModel.__name__,
        )
        logger.info(
            "[CANDLE_CACHE_SYNC] COVERAGE_TABLE=%s",
            getattr(CandleCoverageModel, "__tablename__", "N/A"),
        )

        total_written = 0

        # Mantém aqui a tua lógica real existente.
        # Esta versão apenas corrige a assinatura esperada pelo endpoint:
        # CandleCacheSyncService().ensure_range(
        #     session=session,
        #     symbol=...,
        #     timeframe=...,
        #     start_at=...,
        #     end_at=...,
        # )

        logger.info("[CANDLE_CACHE_SYNC] TOTAL_WRITTEN=%s", total_written)
        logger.info("[CANDLE_CACHE_SYNC] FIM")
        logger.info("###################################################################################")
        return total_written