from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.storage.models import Candle


class CandleUpsertRepository:
    def upsert_many(
        self,
        session: Session,
        candles: Iterable[dict[str, Any]],
    ) -> int:
        payload: list[dict[str, Any]] = []
        seen_keys: set[tuple[str, str, Any]] = set()

        for candle in candles:
            symbol = candle["symbol"]
            timeframe = candle["timeframe"]
            open_time = candle["open_time"]

            dedupe_key = (symbol, timeframe, open_time)
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)

            payload.append(
                {
                    "id": candle.get("id"),
                    "asset_id": candle.get("asset_id"),
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "open_time": open_time,
                    "close_time": candle.get("close_time"),
                    "open": candle.get("open"),
                    "high": candle.get("high"),
                    "low": candle.get("low"),
                    "close": candle.get("close"),
                    "volume": candle.get("volume", 0.0),
                    "source": candle.get("source"),
                }
            )

        if not payload:
            return 0

        stmt = sqlite_insert(Candle).values(payload)

        stmt = stmt.on_conflict_do_update(
            index_elements=["symbol", "timeframe", "open_time"],
            set_={
                "asset_id": stmt.excluded.asset_id,
                "close_time": stmt.excluded.close_time,
                "open": stmt.excluded.open,
                "high": stmt.excluded.high,
                "low": stmt.excluded.low,
                "close": stmt.excluded.close,
                "volume": stmt.excluded.volume,
                "source": stmt.excluded.source,
            },
        )

        session.execute(stmt)
        session.commit()

        return len(payload)