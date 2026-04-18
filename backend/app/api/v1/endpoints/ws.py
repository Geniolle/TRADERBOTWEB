# G:\O meu disco\python\Trader-bot\app\api\v1\endpoints\ws.py

import asyncio
import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.settings import get_settings
from app.providers.factory import MarketDataProviderFactory
from app.providers.twelvedata import ProviderQuotaExceededError
from app.services.candle_sync import CandleSyncService
from app.storage.database import SessionLocal
from app.storage.repositories.candle_queries import CandleQueryRepository
from app.utils.datetime_utils import ensure_naive_utc, floor_open_time

router = APIRouter(tags=["ws"])


def normalize_symbol(value: str | None) -> str:
    return (value or "").strip().upper()


def normalize_timeframe(value: str | None) -> str:
    normalized = (value or "").strip().lower()

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


def normalize_provider(value: str | None) -> str:
    settings = get_settings()
    resolved = (value or settings.market_data_provider or "mock").strip().lower()

    if not resolved:
        return "mock"

    return resolved


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def timeframe_to_timedelta(timeframe: str) -> timedelta:
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
    }

    if timeframe in mapping:
        return mapping[timeframe]

    if timeframe == "1mo":
        return timedelta(days=30)

    return timedelta(minutes=5)


def timeframe_to_window(timeframe: str) -> timedelta:
    mapping = {
        "1m": timedelta(hours=24),
        "3m": timedelta(hours=24),
        "5m": timedelta(hours=24),
        "15m": timedelta(days=3),
        "30m": timedelta(days=3),
        "1h": timedelta(days=15),
        "4h": timedelta(days=15),
        "1d": timedelta(days=60),
    }
    return mapping.get(timeframe, timedelta(days=7))


def floor_time_to_bucket(value: datetime, timeframe: str) -> datetime:
    current = normalize_datetime(value)

    if timeframe == "1m":
        return current.replace(second=0, microsecond=0)

    if timeframe in {"3m", "5m", "15m", "30m"}:
        minutes = {"3m": 3, "5m": 5, "15m": 15, "30m": 30}[timeframe]
        floored_minute = (current.minute // minutes) * minutes
        return current.replace(minute=floored_minute, second=0, microsecond=0)

    if timeframe == "1h":
        return current.replace(minute=0, second=0, microsecond=0)

    if timeframe == "4h":
        floored_hour = (current.hour // 4) * 4
        return current.replace(hour=floored_hour, minute=0, second=0, microsecond=0)

    if timeframe == "1d":
        return current.replace(hour=0, minute=0, second=0, microsecond=0)

    return current.replace(second=0, microsecond=0)


def serialize_candle_row(row) -> dict:
    return {
        "id": row.id,
        "asset_id": row.asset_id,
        "symbol": row.symbol,
        "timeframe": row.timeframe,
        "open_time": row.open_time.isoformat(),
        "close_time": row.close_time.isoformat(),
        "open": str(row.open),
        "high": str(row.high),
        "low": str(row.low),
        "close": str(row.close),
        "volume": str(row.volume),
        "source": row.source,
        "provider": row.source,
    }


def sync_recent_closed_candles(symbol: str, timeframe: str, provider_name: str) -> None:
    settings = get_settings()

    if not settings.candle_cache_enabled:
        return

    if not settings.candle_cache_sync_on_read:
        return

    now = ensure_naive_utc(datetime.utcnow())
    sync_end = floor_open_time(now, timeframe)
    sync_start = sync_end - timeframe_to_window(timeframe)

    if sync_start >= sync_end:
        return

    session = SessionLocal()
    try:
        CandleSyncService().ensure_local_coverage(
            session=session,
            symbol=symbol,
            timeframe=timeframe,
            start_at=sync_start,
            end_at=sync_end,
            provider_name=provider_name,
        )
    finally:
        session.close()


def load_initial_candles(symbol: str, timeframe: str, provider_name: str) -> list[dict]:
    now = ensure_naive_utc(datetime.utcnow())
    end_at = floor_open_time(now, timeframe)
    start_at = end_at - timeframe_to_window(timeframe)

    session = SessionLocal()
    try:
        rows = CandleQueryRepository().list_by_filters(
            session=session,
            symbol=symbol,
            timeframe=timeframe,
            start_at=start_at,
            end_at=end_at,
            limit=5000,
            source=provider_name,
        )
        return [serialize_candle_row(row) for row in rows]
    finally:
        session.close()


def load_last_closed_candle(symbol: str, timeframe: str, provider_name: str):
    now = ensure_naive_utc(datetime.utcnow())
    end_at = floor_open_time(now, timeframe)
    start_at = end_at - timeframe_to_window(timeframe)

    session = SessionLocal()
    try:
        row = CandleQueryRepository().get_latest(
            session=session,
            symbol=symbol,
            timeframe=timeframe,
            source=provider_name,
        )

        if row is None:
            return None

        row_close = normalize_datetime(row.close_time)
        if row_close > end_at:
            return None

        if row.open_time < start_at:
            return None

        return row
    finally:
        session.close()


def build_tick_from_last_closed(symbol: str, timeframe: str, provider_name: str) -> dict | None:
    row = load_last_closed_candle(symbol, timeframe, provider_name)
    if row is None:
        return None

    return {
        "symbol": row.symbol,
        "timeframe": row.timeframe,
        "open_time": row.open_time.isoformat(),
        "open": float(row.open),
        "high": float(row.high),
        "low": float(row.low),
        "close": float(row.close),
        "count": 1,
        "source": row.source,
        "provider": row.source,
        "market_session": None,
        "timezone": "UTC",
        "is_delayed": True,
        "is_mock": row.source == "mock",
    }


def try_build_live_tick(symbol: str, timeframe: str, provider_name: str) -> dict | None:
    provider = MarketDataProviderFactory().get_provider(provider_name)

    now = ensure_naive_utc(datetime.utcnow())
    candle_delta = timeframe_to_timedelta(timeframe)
    current_bucket_open = floor_time_to_bucket(now, timeframe)

    request_start = current_bucket_open - candle_delta
    request_end = now

    candles = provider.get_historical_candles(
        symbol=symbol,
        timeframe=timeframe,
        start_at=request_start,
        end_at=request_end,
    )

    if not candles:
        return None

    latest = candles[-1]
    latest_open = normalize_datetime(latest.open_time)

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "open_time": latest_open.isoformat(),
        "open": float(latest.open),
        "high": float(latest.high),
        "low": float(latest.low),
        "close": float(latest.close),
        "count": 1,
        "source": latest.source,
        "provider": provider.provider_name(),
        "market_session": None,
        "timezone": "UTC",
        "is_delayed": latest_open < current_bucket_open,
        "is_mock": provider.provider_name() == "mock",
    }


async def emit_heartbeat(websocket: WebSocket, count: int) -> None:
    await websocket.send_json(
        {
            "event": "heartbeat",
            "data": {
                "count": count,
                "message": "alive",
            },
        }
    )


async def emit_provider_error(
    websocket: WebSocket,
    message: str,
    symbol: str,
    timeframe: str,
    provider_name: str | None = None,
) -> None:
    await websocket.send_json(
        {
            "event": "provider_error",
            "data": {
                "message": message,
                "symbol": symbol,
                "timeframe": timeframe,
                "provider": provider_name,
            },
        }
    )


@router.websocket("/ws")
async def websocket_feed(websocket: WebSocket) -> None:
    await websocket.accept()

    await websocket.send_json(
        {
            "event": "connected",
            "data": {
                "message": "websocket_connected",
            },
        }
    )

    heartbeat_task: asyncio.Task | None = None
    stream_task: asyncio.Task | None = None

    async def run_heartbeat() -> None:
        counter = 0
        while True:
            counter += 1
            await emit_heartbeat(websocket, counter)
            await asyncio.sleep(15)

    async def run_stream(
        symbol: str,
        timeframe: str,
        provider_name: str,
        market_type: str | None,
        catalog: str | None,
    ) -> None:
        last_tick_key = ""

        try:
            sync_recent_closed_candles(symbol, timeframe, provider_name)
        except Exception as exc:
            await emit_provider_error(
                websocket=websocket,
                message=f"Falha ao sincronizar candles iniciais: {exc}",
                symbol=symbol,
                timeframe=timeframe,
                provider_name=provider_name,
            )

        initial_candles = load_initial_candles(symbol, timeframe, provider_name)

        await websocket.send_json(
            {
                "event": "subscribed",
                "data": {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "provider": provider_name,
                    "market_type": market_type,
                    "catalog": catalog,
                },
            }
        )

        await websocket.send_json(
            {
                "event": "initial_candles",
                "data": {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "provider": provider_name,
                    "candles": initial_candles,
                },
            }
        )

        while True:
            try:
                tick = try_build_live_tick(symbol, timeframe, provider_name)
            except ProviderQuotaExceededError as exc:
                fallback_tick = build_tick_from_last_closed(symbol, timeframe, provider_name)

                if fallback_tick:
                    fallback_key = (
                        f"{fallback_tick['symbol']}|"
                        f"{fallback_tick['timeframe']}|"
                        f"{fallback_tick['open_time']}|"
                        f"{fallback_tick['close']}|"
                        f"{fallback_tick['provider']}"
                    )

                    if fallback_key != last_tick_key:
                        last_tick_key = fallback_key
                        await websocket.send_json(
                            {
                                "event": "candle_tick",
                                "data": fallback_tick,
                            }
                        )

                await emit_provider_error(
                    websocket=websocket,
                    message=str(exc),
                    symbol=symbol,
                    timeframe=timeframe,
                    provider_name=provider_name,
                )
                await asyncio.sleep(20)
                continue
            except Exception as exc:
                fallback_tick = build_tick_from_last_closed(symbol, timeframe, provider_name)

                if fallback_tick:
                    fallback_key = (
                        f"{fallback_tick['symbol']}|"
                        f"{fallback_tick['timeframe']}|"
                        f"{fallback_tick['open_time']}|"
                        f"{fallback_tick['close']}|"
                        f"{fallback_tick['provider']}"
                    )

                    if fallback_key != last_tick_key:
                        last_tick_key = fallback_key
                        await websocket.send_json(
                            {
                                "event": "candle_tick",
                                "data": fallback_tick,
                            }
                        )

                await emit_provider_error(
                    websocket=websocket,
                    message=f"Falha no stream realtime: {exc}",
                    symbol=symbol,
                    timeframe=timeframe,
                    provider_name=provider_name,
                )
                await asyncio.sleep(10)
                continue

            if tick:
                tick_key = (
                    f"{tick['symbol']}|"
                    f"{tick['timeframe']}|"
                    f"{tick['open_time']}|"
                    f"{tick['close']}|"
                    f"{tick['provider']}"
                )

                if tick_key != last_tick_key:
                    last_tick_key = tick_key
                    await websocket.send_json(
                        {
                            "event": "candle_tick",
                            "data": tick,
                        }
                    )

            await asyncio.sleep(5)

    try:
        heartbeat_task = asyncio.create_task(run_heartbeat())

        while True:
            raw_message = await websocket.receive_text()

            if raw_message == "frontend_connected":
                await websocket.send_json(
                    {
                        "event": "echo",
                        "data": {
                            "message": "frontend_connected",
                        },
                    }
                )
                continue

            try:
                payload = json.loads(raw_message)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {
                        "event": "provider_error",
                        "data": {
                            "message": "Mensagem websocket inválida.",
                        },
                    }
                )
                continue

            action = str(payload.get("action") or "").strip().lower()

            if action != "subscribe":
                await websocket.send_json(
                    {
                        "event": "provider_error",
                        "data": {
                            "message": f"Ação websocket não suportada: {action or '-'}",
                        },
                    }
                )
                continue

            symbol = normalize_symbol(payload.get("symbol"))
            timeframe = normalize_timeframe(payload.get("timeframe"))
            provider_name = normalize_provider(
                payload.get("provider") if isinstance(payload.get("provider"), str) else None
            )
            market_type = payload.get("market_type")
            catalog = payload.get("catalog")

            if not symbol or not timeframe:
                await websocket.send_json(
                    {
                        "event": "provider_error",
                        "data": {
                            "message": "Subscrição inválida: símbolo e timeframe são obrigatórios.",
                            "symbol": symbol,
                            "timeframe": timeframe,
                            "provider": provider_name,
                        },
                    }
                )
                continue

            if stream_task:
                stream_task.cancel()
                try:
                    await stream_task
                except asyncio.CancelledError:
                    pass

            stream_task = asyncio.create_task(
                run_stream(
                    symbol=symbol,
                    timeframe=timeframe,
                    provider_name=provider_name,
                    market_type=market_type if isinstance(market_type, str) else None,
                    catalog=catalog if isinstance(catalog, str) else None,
                )
            )

    except WebSocketDisconnect:
        return
    finally:
        if heartbeat_task:
            heartbeat_task.cancel()
        if stream_task:
            stream_task.cancel()