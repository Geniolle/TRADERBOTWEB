import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from fastapi import WebSocket

from app.core.logging import get_logger
from app.storage.database import SessionLocal
from app.storage.repositories.candle_queries import CandleQueryRepository
from app.services.candle_sync import CandleSyncService
from app.utils.datetime_utils import ensure_naive_utc, timeframe_to_timedelta

logger = get_logger(__name__)


def row_to_ws_candle(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "asset_id": row.asset_id,
        "symbol": row.symbol,
        "timeframe": row.timeframe,
        "open_time": ensure_naive_utc(row.open_time).isoformat(),
        "close_time": ensure_naive_utc(row.close_time).isoformat(),
        "open": str(row.open),
        "high": str(row.high),
        "low": str(row.low),
        "close": str(row.close),
        "volume": str(row.volume),
        "source": row.source,
        "provider": row.source,
        "market_session": None,
        "timezone": "UTC",
        "is_delayed": False,
        "is_mock": row.source == "mock",
    }


@dataclass(frozen=True)
class SubscriptionKey:
    symbol: str
    timeframe: str

    @classmethod
    def from_values(cls, symbol: str, timeframe: str) -> "SubscriptionKey":
        return cls(
            symbol=symbol.strip().upper(),
            timeframe=timeframe.strip().lower(),
        )


class RealtimeSubscriptionWorker:
    def __init__(
        self,
        key: SubscriptionKey,
        manager: "RealtimeWSManager",
    ) -> None:
        self.key = key
        self.manager = manager
        self.task: asyncio.Task | None = None
        self.stop_event = asyncio.Event()
        self.last_sent_open_time: str = ""
        self.last_refresh_reason: str = ""

    def start(self) -> None:
        if self.task and not self.task.done():
            return
        self.task = asyncio.create_task(self.run())

    async def stop(self) -> None:
        self.stop_event.set()
        if self.task:
            await asyncio.gather(self.task, return_exceptions=True)

    async def run(self) -> None:
        logger.info("###################################################################################")
        logger.info(
            "[WS_WORKER] START | SYMBOL=%s | TIMEFRAME=%s",
            self.key.symbol,
            self.key.timeframe,
        )

        try:
            await self._bootstrap_and_publish_initial()

            while not self.stop_event.is_set():
                try:
                    await self._poll_and_publish()
                except Exception as exc:
                    logger.exception(
                        "[WS_WORKER] POLL_ERROR | SYMBOL=%s | TIMEFRAME=%s | ERROR=%s",
                        self.key.symbol,
                        self.key.timeframe,
                        exc,
                    )
                    await self.manager.broadcast_event(
                        self.key,
                        "provider_error",
                        {
                            "symbol": self.key.symbol,
                            "timeframe": self.key.timeframe,
                            "message": str(exc),
                        },
                    )

                try:
                    await asyncio.wait_for(
                        self.stop_event.wait(),
                        timeout=self._poll_interval_seconds(),
                    )
                except asyncio.TimeoutError:
                    pass
        finally:
            logger.info(
                "[WS_WORKER] STOP | SYMBOL=%s | TIMEFRAME=%s",
                self.key.symbol,
                self.key.timeframe,
            )
            logger.info("###################################################################################")

    async def _bootstrap_and_publish_initial(self) -> None:
        session = SessionLocal()
        try:
            now = ensure_naive_utc(datetime.utcnow())
            bootstrap_bars = self.manager.bootstrap_bars_for_timeframe(self.key.timeframe)
            start_at = now - (
                timeframe_to_timedelta(self.key.timeframe) * bootstrap_bars
            )

            logger.info(
                "[WS_WORKER] INITIAL_BOOTSTRAP | SYMBOL=%s | TIMEFRAME=%s | START=%s | END=%s | BARS=%s",
                self.key.symbol,
                self.key.timeframe,
                start_at.isoformat(),
                now.isoformat(),
                bootstrap_bars,
            )

            sync_result = CandleSyncService().ensure_local_coverage(
                session=session,
                symbol=self.key.symbol,
                timeframe=self.key.timeframe,
                start_at=start_at,
                end_at=now,
            )

            logger.info(
                "[WS_WORKER] INITIAL_BOOTSTRAP_RESULT | USED_PROVIDER=%s | FETCHED=%s | REASON=%s",
                sync_result.used_provider,
                sync_result.fetched_count,
                sync_result.reason,
            )

            rows = CandleQueryRepository().list_by_filters(
                session=session,
                symbol=self.key.symbol,
                timeframe=self.key.timeframe,
                start_at=start_at,
                end_at=now,
                limit=min(max(bootstrap_bars, 50), 1000),
            )

            logger.info(
                "[WS_WORKER] INITIAL_ROWS | COUNT=%s",
                len(rows),
            )

            payload = {
                "symbol": self.key.symbol,
                "timeframe": self.key.timeframe,
                "candles": [row_to_ws_candle(row) for row in rows],
            }

            if rows:
                self.last_sent_open_time = ensure_naive_utc(
                    rows[-1].open_time
                ).isoformat()

            await self.manager.broadcast_event(self.key, "initial_candles", payload)

            logger.info(
                "[WS_WORKER] INITIAL_PUBLISH | LAST_OPEN_TIME=%s",
                self.last_sent_open_time or "-",
            )
        finally:
            session.close()

    async def _poll_and_publish(self) -> None:
        session = SessionLocal()
        try:
            now = ensure_naive_utc(datetime.utcnow())
            latest_row_before = CandleQueryRepository().get_latest_by_symbol_timeframe(
                session=session,
                symbol=self.key.symbol,
                timeframe=self.key.timeframe,
            )
            latest_open_before = (
                ensure_naive_utc(latest_row_before.open_time).isoformat()
                if latest_row_before is not None
                else ""
            )

            recent_bars = self.manager.recent_sync_bars_for_timeframe(self.key.timeframe)
            recent_window_start = now - (
                timeframe_to_timedelta(self.key.timeframe) * recent_bars
            )

            logger.info(
                "[WS_WORKER] POLL | SYMBOL=%s | TIMEFRAME=%s | WINDOW_START=%s | WINDOW_END=%s | RECENT_BARS=%s",
                self.key.symbol,
                self.key.timeframe,
                recent_window_start.isoformat(),
                now.isoformat(),
                recent_bars,
            )

            sync_result = CandleSyncService().ensure_local_coverage(
                session=session,
                symbol=self.key.symbol,
                timeframe=self.key.timeframe,
                start_at=recent_window_start,
                end_at=now,
            )

            logger.info(
                "[WS_WORKER] POLL_SYNC_RESULT | USED_PROVIDER=%s | FETCHED=%s | REASON=%s",
                sync_result.used_provider,
                sync_result.fetched_count,
                sync_result.reason,
            )

            latest_row_after = CandleQueryRepository().get_latest_by_symbol_timeframe(
                session=session,
                symbol=self.key.symbol,
                timeframe=self.key.timeframe,
            )

            if latest_row_after is None:
                logger.info("[WS_WORKER] POLL_NO_ROWS")
                return

            latest_open_after = ensure_naive_utc(latest_row_after.open_time).isoformat()
            refresh_reason = sync_result.reason

            if (
                sync_result.used_provider
                and sync_result.fetched_count > 0
                and latest_open_after != latest_open_before
            ):
                logger.info(
                    "[WS_WORKER] REFRESH_EVENT | PREV_OPEN=%s | NEW_OPEN=%s | FETCHED=%s | REASON=%s",
                    latest_open_before or "-",
                    latest_open_after,
                    sync_result.fetched_count,
                    refresh_reason,
                )

                await self.manager.broadcast_event(
                    self.key,
                    "candles_refresh",
                    {
                        "symbol": self.key.symbol,
                        "timeframe": self.key.timeframe,
                        "count": sync_result.fetched_count,
                        "reason": refresh_reason,
                        "latest_open_time": latest_open_after,
                    },
                )

            if (
                latest_open_after != self.last_sent_open_time
                or refresh_reason != self.last_refresh_reason
            ):
                logger.info(
                    "[WS_WORKER] TICK_EVENT | LAST_SENT=%s | CURRENT=%s | REASON=%s",
                    self.last_sent_open_time or "-",
                    latest_open_after,
                    refresh_reason,
                )

                await self.manager.broadcast_event(
                    self.key,
                    "candle_tick",
                    row_to_ws_candle(latest_row_after),
                )

                self.last_sent_open_time = latest_open_after
                self.last_refresh_reason = refresh_reason
        finally:
            session.close()

    def _poll_interval_seconds(self) -> float:
        mapping = {
            "1m": 5.0,
            "3m": 10.0,
            "5m": 15.0,
            "15m": 20.0,
            "30m": 30.0,
            "45m": 30.0,
            "1h": 45.0,
            "2h": 60.0,
            "4h": 90.0,
            "1d": 180.0,
            "1w": 300.0,
            "1mo": 600.0,
        }
        return mapping.get(self.key.timeframe, 15.0)


class RealtimeWSManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._subscriptions_by_socket: dict[WebSocket, set[SubscriptionKey]] = defaultdict(set)
        self._sockets_by_subscription: dict[SubscriptionKey, set[WebSocket]] = defaultdict(set)
        self._workers: dict[SubscriptionKey, RealtimeSubscriptionWorker] = {}
        self._heartbeat_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self._heartbeat_count = 0

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()

        async with self._lock:
            self._connections.add(websocket)
            if self._heartbeat_task is None or self._heartbeat_task.done():
                self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        logger.info(
            "[WS_MANAGER] CONNECT | ACTIVE_CONNECTIONS=%s",
            len(self._connections),
        )

        await self._send_event(
            websocket,
            "connected",
            {"message": "WebSocket connected"},
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

            subscriptions = list(self._subscriptions_by_socket.get(websocket, set()))
            for key in subscriptions:
                self._subscriptions_by_socket[websocket].discard(key)
                self._sockets_by_subscription[key].discard(websocket)

                logger.info(
                    "[WS_MANAGER] UNSUBSCRIBE_SOCKET | SYMBOL=%s | TIMEFRAME=%s | REMAINING=%s",
                    key.symbol,
                    key.timeframe,
                    len(self._sockets_by_subscription[key]),
                )

                if not self._sockets_by_subscription[key]:
                    worker = self._workers.pop(key, None)
                    if worker is not None:
                        await worker.stop()
                    self._sockets_by_subscription.pop(key, None)

                    logger.info(
                        "[WS_MANAGER] WORKER_REMOVED | SYMBOL=%s | TIMEFRAME=%s",
                        key.symbol,
                        key.timeframe,
                    )

            self._subscriptions_by_socket.pop(websocket, None)

        logger.info(
            "[WS_MANAGER] DISCONNECT | ACTIVE_CONNECTIONS=%s",
            len(self._connections),
        )

    async def handle_message(self, websocket: WebSocket, raw_message: str) -> None:
        raw_message = (raw_message or "").strip()
        if not raw_message:
            return

        logger.info("[WS_MANAGER] MESSAGE | RAW=%s", raw_message)

        if raw_message == "frontend_connected":
            await self._send_event(
                websocket,
                "echo",
                {"message": "frontend_connected"},
            )
            return

        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            await self._send_event(
                websocket,
                "provider_error",
                {"message": "Invalid websocket payload"},
            )
            return

        action = str(payload.get("action", "")).strip().lower()
        if action != "subscribe":
            await self._send_event(
                websocket,
                "provider_error",
                {"message": "Unsupported websocket action"},
            )
            return

        symbol = str(payload.get("symbol", "")).strip().upper()
        timeframe = str(payload.get("timeframe", "")).strip().lower()

        if not symbol or not timeframe:
            await self._send_event(
                websocket,
                "provider_error",
                {"message": "symbol and timeframe are required"},
            )
            return

        key = SubscriptionKey.from_values(symbol, timeframe)

        async with self._lock:
            self._subscriptions_by_socket[websocket].add(key)
            self._sockets_by_subscription[key].add(websocket)

            if key not in self._workers:
                worker = RealtimeSubscriptionWorker(key=key, manager=self)
                self._workers[key] = worker
                worker.start()

                logger.info(
                    "[WS_MANAGER] WORKER_CREATED | SYMBOL=%s | TIMEFRAME=%s",
                    key.symbol,
                    key.timeframe,
                )

        logger.info(
            "[WS_MANAGER] SUBSCRIBED | SYMBOL=%s | TIMEFRAME=%s | LISTENERS=%s",
            key.symbol,
            key.timeframe,
            len(self._sockets_by_subscription[key]),
        )

        await self._send_event(
            websocket,
            "subscribed",
            {
                "symbol": key.symbol,
                "timeframe": key.timeframe,
                "message": "Subscription registered",
            },
        )

    async def broadcast_event(
        self,
        key: SubscriptionKey,
        event_name: str,
        data: dict[str, Any],
    ) -> None:
        sockets = list(self._sockets_by_subscription.get(key, set()))

        logger.info(
            "[WS_MANAGER] BROADCAST | EVENT=%s | SYMBOL=%s | TIMEFRAME=%s | TARGETS=%s",
            event_name,
            key.symbol,
            key.timeframe,
            len(sockets),
        )

        for socket in sockets:
            await self._send_event(socket, event_name, data)

    async def _send_event(
        self,
        websocket: WebSocket,
        event_name: str,
        data: dict[str, Any],
    ) -> None:
        try:
            await websocket.send_json(
                {
                    "event": event_name,
                    "data": data,
                }
            )
        except Exception:
            await self.disconnect(websocket)

    async def _heartbeat_loop(self) -> None:
        while True:
            await asyncio.sleep(10)
            async with self._lock:
                if not self._connections:
                    return

                self._heartbeat_count += 1
                sockets = list(self._connections)

            logger.info(
                "[WS_MANAGER] HEARTBEAT | COUNT=%s | CONNECTIONS=%s",
                self._heartbeat_count,
                len(sockets),
            )

            for socket in sockets:
                await self._send_event(
                    socket,
                    "heartbeat",
                    {
                        "count": self._heartbeat_count,
                        "message": "alive",
                    },
                )

    def bootstrap_bars_for_timeframe(self, timeframe: str) -> int:
        if timeframe in {"1d", "1w", "1mo"}:
            return 120
        return 240

    def recent_sync_bars_for_timeframe(self, timeframe: str) -> int:
        mapping = {
            "1m": 10,
            "3m": 8,
            "5m": 8,
            "15m": 6,
            "30m": 4,
            "45m": 4,
            "1h": 4,
            "2h": 3,
            "4h": 3,
            "1d": 2,
            "1w": 2,
            "1mo": 2,
        }
        return mapping.get(timeframe, 6)


realtime_ws_manager = RealtimeWSManager()