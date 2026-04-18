# G:\O meu disco\python\Trader-bot\app\api\v1\endpoints\candles.py

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query

from app.core.settings import get_settings
from app.schemas.run import CandleResponse
from app.services.candle_sync import CandleSyncService
from app.storage.database import SessionLocal
from app.storage.repositories.candle_queries import CandleQueryRepository
from app.utils.datetime_utils import ensure_naive_utc, floor_open_time

router = APIRouter(prefix="/candles", tags=["candles"])


def _build_candle_response(row) -> CandleResponse:
    return CandleResponse(
        id=row.id,
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


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _normalize_timeframe(timeframe: str) -> str:
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
    normalized = timeframe.strip().lower()
    return aliases.get(normalized, normalized)


def _normalize_provider(provider: str | None) -> str:
    settings = get_settings()
    resolved = (provider or settings.market_data_provider or "mock").strip().lower()

    if not resolved:
        return "mock"

    return resolved


def _timeframe_to_delta(timeframe: str) -> timedelta:
    mapping = {
        "1m": timedelta(minutes=1),
        "3m": timedelta(minutes=3),
        "5m": timedelta(minutes=5),
        "15m": timedelta(minutes=15),
        "30m": timedelta(minutes=30),
        "45m": timedelta(minutes=45),
        "1h": timedelta(hours=1),
        "2h": timedelta(hours=2),
        "4h": timedelta(hours=4),
        "1d": timedelta(days=1),
        "1w": timedelta(weeks=1),
        "1mo": timedelta(days=30),
    }

    delta = mapping.get(timeframe)
    if delta is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported timeframe: {timeframe}",
        )

    return delta


def _resolve_sync_end(timeframe: str, requested_end_at: datetime | None) -> datetime:
    if requested_end_at is not None:
        return ensure_naive_utc(requested_end_at)

    now = ensure_naive_utc(datetime.utcnow())
    return floor_open_time(now, timeframe)


def _resolve_range(
    *,
    timeframe: str,
    mode: str,
    start_at: datetime | None,
    end_at: datetime | None,
    limit: int,
) -> tuple[datetime, datetime]:
    normalized_timeframe = _normalize_timeframe(timeframe)
    resolved_end = _resolve_sync_end(normalized_timeframe, end_at)
    delta = _timeframe_to_delta(normalized_timeframe)

    normalized_mode = (mode or "full").strip().lower()

    if normalized_mode == "incremental":
        resolved_start = ensure_naive_utc(start_at) if start_at else (resolved_end - (delta * 3))

        if resolved_start >= resolved_end:
            resolved_start = resolved_end - (delta * 3)

        return resolved_start, resolved_end

    bars = max(limit, 300)
    resolved_start = ensure_naive_utc(start_at) if start_at else (resolved_end - (delta * bars))

    if resolved_start >= resolved_end:
        resolved_start = resolved_end - (delta * bars)

    return resolved_start, resolved_end


def _ensure_local_coverage_if_enabled(
    *,
    session,
    provider_name: str,
    symbol: str,
    timeframe: str,
    start_at: datetime,
    end_at: datetime,
) -> None:
    settings = get_settings()

    if not settings.candle_cache_enabled:
        return

    if not settings.candle_cache_sync_on_read:
        return

    if start_at >= end_at:
        return

    CandleSyncService().ensure_local_coverage(
        session=session,
        symbol=symbol,
        timeframe=timeframe,
        start_at=start_at,
        end_at=end_at,
        provider_name=provider_name,
    )


@router.get("", response_model=list[CandleResponse])
def list_candles(
    symbol: str = Query(...),
    timeframe: str = Query(...),
    provider: str | None = Query(default=None),
    mode: str = Query(default="full"),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
) -> list[CandleResponse]:
    session = SessionLocal()
    try:
        normalized_symbol = _normalize_symbol(symbol)
        normalized_timeframe = _normalize_timeframe(timeframe)
        provider_name = _normalize_provider(provider)

        resolved_start_at, resolved_end_at = _resolve_range(
            timeframe=normalized_timeframe,
            mode=mode,
            start_at=start_at,
            end_at=end_at,
            limit=limit,
        )

        _ensure_local_coverage_if_enabled(
            session=session,
            provider_name=provider_name,
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            start_at=resolved_start_at,
            end_at=resolved_end_at,
        )

        rows = CandleQueryRepository().list_by_filters(
            session=session,
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            start_at=resolved_start_at,
            end_at=resolved_end_at,
            limit=limit,
            source=provider_name,
        )

        return [_build_candle_response(row) for row in rows]
    finally:
        session.close()


@router.get("/latest", response_model=CandleResponse)
def get_latest_candle(
    symbol: str = Query(...),
    timeframe: str = Query(...),
    provider: str | None = Query(default=None),
) -> CandleResponse:
    session = SessionLocal()
    try:
        settings = get_settings()

        normalized_symbol = _normalize_symbol(symbol)
        normalized_timeframe = _normalize_timeframe(timeframe)
        provider_name = _normalize_provider(provider)

        timeframe_delta = _timeframe_to_delta(normalized_timeframe)
        reconcile_bars = max(settings.candle_cache_reconcile_bars, 3)

        sync_end_at = _resolve_sync_end(normalized_timeframe, None)
        sync_start_at = sync_end_at - (timeframe_delta * reconcile_bars)

        _ensure_local_coverage_if_enabled(
            session=session,
            provider_name=provider_name,
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            start_at=sync_start_at,
            end_at=sync_end_at,
        )

        row = CandleQueryRepository().get_latest(
            session=session,
            symbol=normalized_symbol,
            timeframe=normalized_timeframe,
            source=provider_name,
        )

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No candle found for symbol={normalized_symbol}, "
                    f"timeframe={normalized_timeframe}, provider={provider_name}"
                ),
            )

        return _build_candle_response(row)
    finally:
        session.close()