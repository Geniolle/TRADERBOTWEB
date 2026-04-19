from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.models.domain.candle import Candle
from app.models.domain.strategy_config import StrategyConfig
from app.registry.strategy_registry import build_strategy_registry
from app.schemas.order import BinanceSpotOrderProposalConfirmationRequest
from app.stage_tests.strategy_mapper import (
    get_default_parameters,
    normalize_stage_test_strategy_key,
    resolve_runtime_strategy_key,
)
from app.storage.database import SessionLocal
from app.storage.models import CandleModel
from app.utils.datetime_utils import ensure_naive_utc

logger = get_logger(__name__)


class StrategyProposalValidationError(ValueError):
    pass


class StrategyProposalConfirmationService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry = build_strategy_registry()

    def confirm(self, request: BinanceSpotOrderProposalConfirmationRequest) -> dict[str, Any]:
        stage_strategy_key = normalize_stage_test_strategy_key(request.strategy_key)
        runtime_strategy_key = resolve_runtime_strategy_key(stage_strategy_key)

        if not self.registry.has(runtime_strategy_key):
            raise StrategyProposalValidationError(
                f"Strategy mapeada nao existe no registry: {runtime_strategy_key}"
            )

        symbol = self._normalize_symbol(request.symbol)
        symbol_candidates = self._build_symbol_candidates(symbol)
        timeframe = self._normalize_timeframe(request.timeframe)
        requested_source = self._normalize_source(request.source)
        default_source = self._normalize_source(self.settings.market_data_provider)
        preferred_source = requested_source or default_source

        if not symbol_candidates:
            raise StrategyProposalValidationError("symbol invalido para confirmacao.")
        if not timeframe:
            raise StrategyProposalValidationError("timeframe invalido para confirmacao.")

        max_candles = int(request.max_candles)

        session = SessionLocal()
        try:
            candles, used_source = self._load_recent_candles(
                session=session,
                symbols=symbol_candidates,
                timeframe=timeframe,
                preferred_source=preferred_source,
                max_candles=max_candles,
            )
        finally:
            session.close()

        reference_open_time = (
            ensure_naive_utc(request.candle_open_time)
            if request.candle_open_time is not None
            else None
        )

        defaults = get_default_parameters(stage_strategy_key)
        strategy_parameters = {
            **defaults,
            **(request.parameter_overrides or {}),
        }

        strategy_impl = self.registry.get(runtime_strategy_key)
        config = StrategyConfig(
            id=str(uuid4()),
            strategy_key=runtime_strategy_key,
            name=f"proposal::{stage_strategy_key}",
            timeframe=timeframe,
            parameters=strategy_parameters,
            enabled=True,
        )
        warmup_required = max(1, int(strategy_impl.warmup_period(config)))

        if len(candles) < 2:
            return self._build_result(
                confirmed=False,
                reason="not_enough_candles",
                message="Base local sem candles suficientes para validar proposta.",
                stage_strategy_key=stage_strategy_key,
                runtime_strategy_key=runtime_strategy_key,
                symbol=symbol,
                timeframe=timeframe,
                source=used_source,
                candles_used=len(candles),
                warmup_required=warmup_required,
                evaluated_candle_open_time=None,
                reference_candle_open_time=reference_open_time,
                metadata={"required_candles_min": 2},
            )

        evaluation_index = self._resolve_evaluation_index(
            candles=candles,
            reference_open_time=reference_open_time,
        )

        if evaluation_index is None:
            return self._build_result(
                confirmed=False,
                reason="reference_candle_not_found",
                message="Candle de referencia nao encontrado na janela local carregada.",
                stage_strategy_key=stage_strategy_key,
                runtime_strategy_key=runtime_strategy_key,
                symbol=symbol,
                timeframe=timeframe,
                source=used_source,
                candles_used=len(candles),
                warmup_required=warmup_required,
                evaluated_candle_open_time=None,
                reference_candle_open_time=reference_open_time,
                metadata={"max_candles_loaded": max_candles},
            )

        if evaluation_index < 1:
            return self._build_result(
                confirmed=False,
                reason="not_enough_candles_for_confirmation",
                message="Ainda nao existe candle suficiente para confirmar o setup.",
                stage_strategy_key=stage_strategy_key,
                runtime_strategy_key=runtime_strategy_key,
                symbol=symbol,
                timeframe=timeframe,
                source=used_source,
                candles_used=len(candles),
                warmup_required=warmup_required,
                evaluated_candle_open_time=candles[evaluation_index].open_time,
                reference_candle_open_time=reference_open_time,
                metadata={"evaluation_index": evaluation_index},
            )

        if (evaluation_index + 1) < warmup_required:
            return self._build_result(
                confirmed=False,
                reason="warmup_not_reached",
                message="Warmup da estrategia ainda nao foi atingido para esta validacao.",
                stage_strategy_key=stage_strategy_key,
                runtime_strategy_key=runtime_strategy_key,
                symbol=symbol,
                timeframe=timeframe,
                source=used_source,
                candles_used=len(candles),
                warmup_required=warmup_required,
                evaluated_candle_open_time=candles[evaluation_index].open_time,
                reference_candle_open_time=reference_open_time,
                metadata={
                    "evaluation_index": evaluation_index,
                    "warmup_required": warmup_required,
                },
            )

        decision = strategy_impl.check_trigger(
            candles=candles,
            index=evaluation_index,
            config=config,
        )

        decision_metadata = (
            dict(decision.metadata)
            if isinstance(decision.metadata, dict)
            else {}
        )

        message = (
            "Proposta confirmada pela estrategia e pronta para envio da ordem."
            if decision.triggered
            else "Proposta rejeitada pela confirmacao da estrategia."
        )

        return self._build_result(
            confirmed=bool(decision.triggered),
            reason=str(decision.reason or ("confirmed" if decision.triggered else "not_confirmed")),
            message=message,
            stage_strategy_key=stage_strategy_key,
            runtime_strategy_key=runtime_strategy_key,
            symbol=symbol,
            timeframe=timeframe,
            source=used_source,
            candles_used=len(candles),
            warmup_required=warmup_required,
            evaluated_candle_open_time=candles[evaluation_index].open_time,
            reference_candle_open_time=reference_open_time,
            metadata=decision_metadata,
        )

    def _build_result(
        self,
        *,
        confirmed: bool,
        reason: str,
        message: str,
        stage_strategy_key: str,
        runtime_strategy_key: str,
        symbol: str,
        timeframe: str,
        source: str | None,
        candles_used: int,
        warmup_required: int,
        evaluated_candle_open_time: datetime | None,
        reference_candle_open_time: datetime | None,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "ok": True,
            "confirmed": bool(confirmed),
            "reason": reason,
            "message": message,
            "strategy_key": stage_strategy_key,
            "runtime_strategy_key": runtime_strategy_key,
            "symbol": symbol,
            "timeframe": timeframe,
            "source": source,
            "candles_used": int(candles_used),
            "warmup_required": int(warmup_required),
            "evaluated_candle_open_time": evaluated_candle_open_time,
            "reference_candle_open_time": reference_candle_open_time,
            "metadata": metadata,
        }

    def _load_recent_candles(
        self,
        *,
        session,
        symbols: list[str],
        timeframe: str,
        preferred_source: str | None,
        max_candles: int,
    ) -> tuple[list[Candle], str | None]:
        normalized_source = self._normalize_source(preferred_source)

        rows = self._query_recent_rows(
            session=session,
            symbols=symbols,
            timeframe=timeframe,
            source=normalized_source,
            limit=max_candles,
        )

        if rows or normalized_source is None:
            return self._rows_to_candles(rows), normalized_source

        logger.warning(
            "[ORDER_PROPOSAL] sem candles para source especifico, fallback sem source | symbols=%s | timeframe=%s | source=%s",
            ",".join(symbols),
            timeframe,
            normalized_source,
        )

        fallback_rows = self._query_recent_rows(
            session=session,
            symbols=symbols,
            timeframe=timeframe,
            source=None,
            limit=max_candles,
        )

        return self._rows_to_candles(fallback_rows), None

    def _query_recent_rows(
        self,
        *,
        session,
        symbols: list[str],
        timeframe: str,
        source: str | None,
        limit: int,
    ) -> list[CandleModel]:
        if not symbols:
            return []

        query = session.query(CandleModel).filter(
            CandleModel.symbol.in_(symbols),
            CandleModel.timeframe == timeframe,
        )

        if source is not None:
            query = query.filter(CandleModel.source == source)

        return (
            query.order_by(CandleModel.open_time.desc(), CandleModel.id.desc())
            .limit(limit)
            .all()
        )

    def _rows_to_candles(self, rows: list[CandleModel]) -> list[Candle]:
        if not rows:
            return []

        ordered_rows = list(reversed(rows))

        # Quando nao existe filtro de source, podem existir duplicados no mesmo
        # open_time. Mantemos o ultimo registro de cada open_time.
        dedup_map: dict[datetime, CandleModel] = {}
        for row in ordered_rows:
            dedup_map[row.open_time] = row

        final_rows = [dedup_map[key] for key in sorted(dedup_map.keys())]

        candles: list[Candle] = []
        for row in final_rows:
            candles.append(
                Candle(
                    asset_id=row.asset_id,
                    symbol=row.symbol,
                    timeframe=row.timeframe,
                    open_time=row.open_time,
                    close_time=row.close_time,
                    open=row.open,
                    high=row.high,
                    low=row.low,
                    close=row.close,
                    volume=row.volume,
                    source=row.source,
                )
            )

        return candles

    def _resolve_evaluation_index(
        self,
        *,
        candles: list[Candle],
        reference_open_time: datetime | None,
    ) -> int | None:
        if not candles:
            return None

        if reference_open_time is None:
            return len(candles) - 1

        for index, candle in enumerate(candles):
            if candle.open_time == reference_open_time:
                return index

        for index in range(len(candles) - 1, -1, -1):
            if candles[index].open_time <= reference_open_time:
                return index

        return None

    def _normalize_symbol(self, value: str) -> str:
        return str(value or "").strip().upper()

    def _build_symbol_candidates(self, value: str) -> list[str]:
        raw = str(value or "").strip().upper()
        if not raw:
            return []

        candidates: list[str] = []

        def add(candidate: str) -> None:
            normalized = candidate.strip().upper()
            if not normalized:
                return
            if normalized not in candidates:
                candidates.append(normalized)

        add(raw)

        compact = raw
        for ch in ["/", "-", "_", " "]:
            compact = compact.replace(ch, "")
        add(compact)

        if "/" in raw:
            add(raw.replace("/", ""))
        else:
            quote_assets = (
                "FDUSD",
                "USDT",
                "USDC",
                "BUSD",
                "TUSD",
                "BTC",
                "ETH",
                "BNB",
                "TRY",
                "BRL",
                "EUR",
                "GBP",
            )
            for quote in quote_assets:
                if compact.endswith(quote) and len(compact) > len(quote):
                    base = compact[: -len(quote)]
                    add(f"{base}/{quote}")
                    break

        return candidates

    def _normalize_timeframe(self, value: str) -> str:
        normalized = str(value or "").strip().lower()
        aliases = {
            "1min": "1m",
            "3min": "3m",
            "5min": "5m",
            "15min": "15m",
            "30min": "30m",
            "60min": "1h",
            "1hr": "1h",
            "4hr": "4h",
            "1day": "1d",
        }
        return aliases.get(normalized, normalized)

    def _normalize_source(self, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = str(value).strip().lower()
        if not normalized:
            return None

        return normalized
